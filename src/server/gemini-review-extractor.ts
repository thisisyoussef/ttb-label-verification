import {
  ApiError,
  GoogleGenAI,
  MediaResolution,
  ServiceTier,
  type GenerateContentParameters
} from '@google/genai';

import type { ReviewError } from '../shared/contracts/review';
import type { ExtractionMode } from './ai-provider-policy';
import type { LlmEndpointSurface } from './llm-policy';
import { applyReviewExtractorGuardrails } from './review-extractor-guardrails';
import type { NormalizedReviewIntake } from './review-intake';
import {
  buildReviewExtractionPrompt,
  normalizeReviewExtractionModelOutput,
  reviewExtractionModelOutputJsonSchema,
  reviewExtractionModelOutputSchema
} from './review-extraction-model-output';
import {
  createReviewExtractionFailure,
  finalizeReviewExtraction,
  type ReviewExtractor,
  type ReviewExtractorContext
} from './review-extraction';

const DEFAULT_GEMINI_VISION_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_GEMINI_TIMEOUT_MS = 5000;

type GeminiMediaResolution = 'low' | 'medium' | 'high';
type GeminiServiceTier = 'standard' | 'priority' | 'flex';

export interface GeminiReviewExtractionConfig {
  apiKey: string;
  visionModel: string;
  timeoutMs?: number;
  mediaResolution?: GeminiMediaResolution;
  serviceTier?: GeminiServiceTier;
  thinkingBudget?: number;
}

type GeminiReviewExtractionConfigFailure = {
  success: false;
  status: number;
  error: ReviewError;
};

type GeminiReviewExtractionConfigSuccess = {
  success: true;
  value: GeminiReviewExtractionConfig;
};

export type GeminiReviewExtractionConfigResult =
  | GeminiReviewExtractionConfigFailure
  | GeminiReviewExtractionConfigSuccess;

type GenerateContentClient = {
  generateContent: (request: GenerateContentParameters) => Promise<{
    text?: string;
    modelVersion?: string;
    sdkHttpResponse?: {
      headers?: Record<string, string>;
    };
    usageMetadata?: {
      promptTokenCount?: number;
      thoughtsTokenCount?: number;
    };
  }>;
};

export function readGeminiReviewExtractionConfig(
  env: Record<string, string | undefined>
): GeminiReviewExtractionConfigResult {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      status: 503,
      error: {
        kind: 'adapter',
        message: 'Cloud label reading is not set up on this workstation. Contact your administrator.',
        retryable: false
      }
    };
  }

  const visionModel = env.GEMINI_VISION_MODEL?.trim() || DEFAULT_GEMINI_VISION_MODEL;

  return {
    success: true,
    value: {
      apiKey,
      visionModel,
      timeoutMs: readGeminiTimeoutMs(env.GEMINI_TIMEOUT_MS),
      mediaResolution: readGeminiMediaResolution(env.GEMINI_MEDIA_RESOLUTION),
      serviceTier: readGeminiServiceTier(env.GEMINI_SERVICE_TIER),
      thinkingBudget: readGeminiThinkingBudget({
        rawValue: env.GEMINI_THINKING_BUDGET,
        visionModel
      })
    }
  };
}

export function buildGeminiReviewExtractionRequest(input: {
  intake: NormalizedReviewIntake;
  config: GeminiReviewExtractionConfig;
  context?: {
    surface: LlmEndpointSurface;
    extractionMode: ExtractionMode;
  };
}): GenerateContentParameters {
  return {
    model: input.config.visionModel,
    contents: [
      {
        text: buildReviewExtractionPrompt({
          surface: input.context?.surface ?? '/api/review',
          extractionMode: input.context?.extractionMode ?? 'cloud'
        })
      },
      {
        inlineData: {
          mimeType: input.intake.label.mimeType,
          data: input.intake.label.buffer.toString('base64')
        }
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: reviewExtractionModelOutputJsonSchema,
      mediaResolution: toGeminiMediaResolution(
        resolveGeminiMediaResolution({
          configuredMediaResolution: input.config.mediaResolution,
          mimeType: input.intake.label.mimeType
        })
      ),
      serviceTier: input.config.serviceTier
        ? toGeminiServiceTier(input.config.serviceTier)
        : undefined,
      thinkingConfig:
        input.config.thinkingBudget === undefined
          ? undefined
          : {
              thinkingBudget: input.config.thinkingBudget
            }
    }
  };
}

export function createGeminiReviewExtractor(input: {
  config: GeminiReviewExtractionConfig;
  client?: GenerateContentClient;
}): ReviewExtractor {
  const client =
    input.client ??
    (() => {
      const ai = new GoogleGenAI({
        apiKey: input.config.apiKey
      });

      return {
        generateContent: (request) => ai.models.generateContent(request)
      } satisfies GenerateContentClient;
    })();

  return async (intake, context) => {
    const requestAssemblyStartedAt = performance.now();
    let request: GenerateContentParameters;

    try {
      request = buildGeminiReviewExtractionRequest({
        intake,
        config: input.config,
        context: {
          surface: context?.surface ?? '/api/review',
          extractionMode: context?.extractionMode ?? 'cloud'
        }
      });
    } catch (error) {
      recordGeminiLatency(context, 'request-assembly', 'fast-fail', requestAssemblyStartedAt);
      throw error;
    }

    recordGeminiLatency(context, 'request-assembly', 'success', requestAssemblyStartedAt);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.config.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS
    );

    const providerWaitStartedAt = performance.now();
    let response: {
      text?: string;
      modelVersion?: string;
      sdkHttpResponse?: {
        headers?: Record<string, string>;
      };
      usageMetadata?: {
        promptTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    };
    try {
      response = await client.generateContent({
        ...request,
        config: {
          ...request.config,
          abortSignal: controller.signal
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw normalizeGeminiRuntimeFailure(error);
    }
    clearTimeout(timeout);

    recordGeminiProviderMetadata(context, response);

    const responseText = response.text?.trim();
    if (!responseText) {
      recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'The label reading service returned an empty result. Try again.',
        retryable: true
      });
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(responseText);
    } catch {
      recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'We could not read the response from the label reading service. Try again.',
        retryable: true
      });
    }

    const normalizedOutput = reviewExtractionModelOutputSchema.safeParse(parsedOutput);
    if (!normalizedOutput.success) {
      recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'We could not read the response from the label reading service. Try again.',
        retryable: true
      });
    }

    const guardrailResult = applyReviewExtractorGuardrails({
      surface: context?.surface ?? '/api/review',
      extractionMode: context?.extractionMode ?? 'cloud',
      output: normalizedOutput.data
    });
    if (!guardrailResult.success) {
      recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: guardrailResult.status,
        kind: guardrailResult.error.kind,
        message: guardrailResult.error.message,
        retryable: guardrailResult.error.retryable
      });
    }

    try {
      const extraction = finalizeReviewExtraction({
        intake,
        model: response.modelVersion ?? input.config.visionModel,
        extracted: normalizeReviewExtractionModelOutput(guardrailResult.value)
      });
      recordGeminiLatency(context, 'provider-wait', 'success', providerWaitStartedAt);
      return extraction;
    } catch {
      recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 500,
        kind: 'adapter',
        message: 'We could not finish reading this label. Try again or use a different image.',
        retryable: false
      });
    }
  };
}

function readGeminiTimeoutMs(rawValue: string | undefined) {
  const parsedValue = Number(rawValue?.trim());
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_GEMINI_TIMEOUT_MS;
  }

  return Math.round(parsedValue);
}

function readGeminiThinkingBudget(input: {
  rawValue: string | undefined;
  visionModel: string;
}) {
  const normalizedValue = input.rawValue?.trim();
  if (!normalizedValue) {
    return defaultGeminiThinkingBudget(input.visionModel);
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue) || parsedValue < -1) {
    return defaultGeminiThinkingBudget(input.visionModel);
  }

  return Math.round(parsedValue);
}

function readGeminiMediaResolution(
  rawValue: string | undefined
): GeminiMediaResolution | undefined {
  const normalizedValue = rawValue?.trim().toLowerCase();
  switch (normalizedValue) {
    case 'low':
    case 'medium':
    case 'high':
      return normalizedValue;
    default:
      return undefined;
  }
}

function readGeminiServiceTier(
  rawValue: string | undefined
): GeminiServiceTier | undefined {
  const normalizedValue = rawValue?.trim().toLowerCase();
  switch (normalizedValue) {
    case 'standard':
    case 'priority':
    case 'flex':
      return normalizedValue;
    default:
      return undefined;
  }
}

function defaultGeminiThinkingBudget(visionModel: string) {
  return /gemini-2\.5-flash/i.test(visionModel) ? 0 : undefined;
}

function resolveGeminiMediaResolution(input: {
  configuredMediaResolution?: GeminiMediaResolution;
  mimeType: string;
}): GeminiMediaResolution {
  if (input.configuredMediaResolution) {
    return input.configuredMediaResolution;
  }

  return input.mimeType === 'application/pdf' ? 'medium' : 'low';
}

function toGeminiMediaResolution(
  mediaResolution: GeminiMediaResolution
): MediaResolution {
  switch (mediaResolution) {
    case 'low':
      return MediaResolution.MEDIA_RESOLUTION_LOW;
    case 'medium':
      return MediaResolution.MEDIA_RESOLUTION_MEDIUM;
    case 'high':
      return MediaResolution.MEDIA_RESOLUTION_HIGH;
  }
}

function toGeminiServiceTier(serviceTier: GeminiServiceTier): ServiceTier {
  switch (serviceTier) {
    case 'flex':
      return ServiceTier.FLEX;
    case 'priority':
      return ServiceTier.PRIORITY;
    case 'standard':
      return ServiceTier.STANDARD;
  }
}

function normalizeGeminiRuntimeFailure(error: unknown) {
  if (isAbortLikeError(error)) {
    return createReviewExtractionFailure({
      status: 504,
      kind: 'timeout',
      message: 'Gemini extraction timed out.',
      retryable: true
    });
  }

  if (error instanceof ApiError) {
    if (error.status === 408 || error.status === 504) {
      return createReviewExtractionFailure({
        status: error.status,
        kind: 'timeout',
        message: 'Gemini extraction timed out.',
        retryable: true
      });
    }

    if (error.status === 429 || error.status >= 500) {
      return createReviewExtractionFailure({
        status: error.status,
        kind: 'network',
        message: 'We could not reach the extraction service right now.',
        retryable: true
      });
    }

    return createReviewExtractionFailure({
      status: error.status,
      kind: 'adapter',
      message: 'Gemini rejected this extraction request.',
      retryable: false
    });
  }

  return createReviewExtractionFailure({
    status: 502,
    kind: 'network',
    message: 'We could not reach the extraction service right now.',
    retryable: true
  });
}

function isAbortLikeError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

function recordGeminiLatency(
  context: ReviewExtractorContext | undefined,
  stage: 'request-assembly' | 'provider-wait',
  outcome: 'success' | 'fast-fail',
  startedAt: number
) {
  context?.latencyCapture?.recordSpan({
    stage,
    provider: 'gemini',
    attempt: context.latencyAttempt,
    outcome,
    durationMs: performance.now() - startedAt
  });
}

function recordGeminiProviderMetadata(
  context: ReviewExtractorContext | undefined,
  response: {
    sdkHttpResponse?: {
      headers?: Record<string, string>;
    };
    usageMetadata?: {
      promptTokenCount?: number;
      thoughtsTokenCount?: number;
    };
  }
) {
  context?.latencyCapture?.recordProviderMetadata({
    provider: 'gemini',
    attempt: context.latencyAttempt,
    serviceTier: readHttpHeader(
      response.sdkHttpResponse?.headers,
      'x-gemini-service-tier'
    ),
    promptTokenCount: response.usageMetadata?.promptTokenCount,
    thoughtsTokenCount: response.usageMetadata?.thoughtsTokenCount
  });
}

function readHttpHeader(
  headers: Record<string, string> | undefined,
  key: string
) {
  if (!headers) {
    return undefined;
  }

  const normalizedKey = key.toLowerCase();
  for (const [headerKey, headerValue] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === normalizedKey) {
      return headerValue;
    }
  }

  return undefined;
}
