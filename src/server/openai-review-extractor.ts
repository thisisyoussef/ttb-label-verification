import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { wrapOpenAI } from 'langsmith/wrappers';

import type { ReviewError } from '../shared/contracts/review';
import type { ExtractionMode } from './ai-provider-policy';
import type { LlmEndpointSurface } from './llm-policy';
import { applyReviewExtractorGuardrails } from './review-extractor-guardrails';
import type { NormalizedReviewIntake } from './review-intake';
import {
  buildReviewExtractionPrompt,
  buildOcrAugmentedExtractionPrompt,
  buildVerificationExtractionPrompt,
  isVerificationModeEnabled,
  normalizeReviewExtractionModelOutput,
  reviewExtractionModelOutputSchema
} from './review-extraction-model-output';
import {
  createReviewExtractionFailure,
  finalizeReviewExtraction,
  type ReviewExtractor,
  type ReviewExtractorContext
} from './review-extraction';

const MODEL_OUTPUT_SCHEMA_NAME = 'ttb_label_extraction';
const DEFAULT_OPENAI_VISION_MODEL = 'gpt-5.4-mini';
const DEFAULT_OPENAI_MAX_ATTEMPTS = 3;

type OpenAiImageDetail = 'low' | 'high' | 'auto' | 'original';
type OpenAiServiceTier = 'auto' | 'default' | 'flex' | 'scale' | 'priority';

export interface ReviewExtractionConfig {
  apiKey: string;
  visionModel: string;
  store: false;
  imageDetail?: OpenAiImageDetail;
  serviceTier?: OpenAiServiceTier;
  /**
   * Maximum number of attempts per extraction request. Defaults to 3.
   * Retries on transient network/5xx failures with exponential backoff.
   */
  maxAttempts?: number;
}

/**
 * Returns the effective per-request retry budget for OpenAI. Clamps to [1, 5].
 */
function readOpenAiMaxAttempts(
  config: Pick<ReviewExtractionConfig, 'maxAttempts'>,
  rawEnv?: string | undefined
): number {
  if (typeof config.maxAttempts === 'number' && config.maxAttempts > 0) {
    return Math.min(config.maxAttempts, 5);
  }
  const trimmed = rawEnv?.trim();
  if (trimmed) {
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, 5);
    }
  }
  return DEFAULT_OPENAI_MAX_ATTEMPTS;
}

type ReviewExtractionConfigFailure = {
  success: false;
  status: number;
  error: ReviewError;
};

type ReviewExtractionConfigSuccess = {
  success: true;
  value: ReviewExtractionConfig;
};

export type ReviewExtractionConfigResult =
  | ReviewExtractionConfigFailure
  | ReviewExtractionConfigSuccess;

type ResponsesParseRequest = Parameters<OpenAI['responses']['parse']>[0];

type ResponsesParseClient = {
  parse: (request: ResponsesParseRequest) => Promise<{ output_parsed?: unknown }>;
};

export function readReviewExtractionConfig(
  env: Record<string, string | undefined>
): ReviewExtractionConfigResult {
  const apiKey = env.OPENAI_API_KEY?.trim();
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

  const storeValue = env.OPENAI_STORE?.trim().toLowerCase();
  if (storeValue && storeValue !== 'false') {
    return {
      success: false,
      status: 500,
      error: {
        kind: 'adapter',
        message: 'This workstation is not configured correctly for label reading. Contact your administrator.',
        retryable: false
      }
    };
  }

  return {
    success: true,
    value: {
      apiKey,
      visionModel: env.OPENAI_VISION_MODEL?.trim() || DEFAULT_OPENAI_VISION_MODEL,
      store: false,
      imageDetail: readOpenAiImageDetail(env.OPENAI_VISION_DETAIL) ?? 'auto',
      serviceTier: readOpenAiServiceTier(env.OPENAI_SERVICE_TIER)
    }
  };
}

export function buildReviewExtractionRequest(input: {
  intake: NormalizedReviewIntake;
  config: ReviewExtractionConfig;
  context?: {
    surface: LlmEndpointSurface;
    extractionMode: ExtractionMode;
  };
}): ResponsesParseRequest {
  const surface = input.context?.surface ?? '/api/review';
  const extractionMode = input.context?.extractionMode ?? 'cloud';
  const ocrText = input.intake.ocrText;

  const verificationPrompt = isVerificationModeEnabled()
    ? buildVerificationExtractionPrompt({
        surface,
        extractionMode,
        fields: input.intake.fields,
        ocrText
      })
    : null;

  const promptText = verificationPrompt
    ?? (ocrText
      ? buildOcrAugmentedExtractionPrompt({ surface, extractionMode, ocrText })
      : buildReviewExtractionPrompt({ surface, extractionMode }));

  return {
    model: input.config.visionModel,
    store: input.config.store,
    service_tier: input.config.serviceTier,
    text: {
      format: zodTextFormat(
        reviewExtractionModelOutputSchema,
        MODEL_OUTPUT_SCHEMA_NAME
      )
    },
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: promptText
          },
          buildLabelInputContent({
            intake: input.intake,
            config: input.config
          })
        ]
      }
    ]
  };
}

export function createOpenAIReviewExtractor(input: {
  config: ReviewExtractionConfig;
  client?: ResponsesParseClient;
}): ReviewExtractor {
  const client =
    input.client ??
    (() => {
      const liveClient = wrapOpenAI(
        new OpenAI({
          apiKey: input.config.apiKey
        })
      ) as OpenAI;
      const responses = liveClient.responses;

      return {
        parse: responses.parse.bind(responses)
      } satisfies ResponsesParseClient;
    })();

  return async (intake, context) => {
    const requestAssemblyStartedAt = performance.now();
    let request: ResponsesParseRequest;

    try {
      request = buildReviewExtractionRequest({
        intake,
        config: input.config,
        context: {
          surface: context?.surface ?? '/api/review',
          extractionMode: context?.extractionMode ?? 'cloud'
        }
      });
    } catch (error) {
      recordOpenAiLatency(context, 'request-assembly', 'fast-fail', requestAssemblyStartedAt);
      throw error;
    }

    recordOpenAiLatency(context, 'request-assembly', 'success', requestAssemblyStartedAt);

    const providerWaitStartedAt = performance.now();
    let response: { output_parsed?: unknown };

    // Bounded retry on transient failures — same pattern as Gemini.
    // After maxAttempts, the error propagates to the factory's cross-
    // provider fallback chain (OpenAI → Gemini → Ollama, or reverse).
    const maxAttempts = readOpenAiMaxAttempts(
      input.config,
      process.env.OPENAI_MAX_ATTEMPTS
    );
    response = { output_parsed: undefined };
    let succeeded = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await client.parse(request);
        succeeded = true;
        break;
      } catch (error) {
        if (attempt === maxAttempts) {
          recordOpenAiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
          throw createReviewExtractionFailure({
            status: 502,
            kind: 'network',
            message: 'We could not reach the extraction service right now.',
            retryable: true
          });
        }
        const backoffMs = Math.min(200 * Math.pow(2, attempt - 1), 800);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
    if (!succeeded) {
      recordOpenAiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'network',
        message: 'We could not reach the extraction service right now.',
        retryable: true
      });
    }

    const parsedOutput = reviewExtractionModelOutputSchema.safeParse(
      response.output_parsed
    );
    if (!parsedOutput.success) {
      recordOpenAiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'We could not extract label fields from this upload.',
        retryable: true
      });
    }

    const guardrailResult = applyReviewExtractorGuardrails({
      surface: context?.surface ?? '/api/review',
      extractionMode: context?.extractionMode ?? 'cloud',
      output: parsedOutput.data
    });
    if (!guardrailResult.success) {
      recordOpenAiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
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
        model: input.config.visionModel,
        extracted: normalizeReviewExtractionModelOutput(guardrailResult.value)
      });
      recordOpenAiLatency(context, 'provider-wait', 'success', providerWaitStartedAt);
      return extraction;
    } catch {
      recordOpenAiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 500,
        kind: 'adapter',
        message: 'We could not finish reading this label. Try again or use a different image.',
        retryable: false
      });
    }
  };
}

function buildLabelInputContent(input: {
  intake: NormalizedReviewIntake;
  config: ReviewExtractionConfig;
}) {
  const base64Data = input.intake.label.buffer.toString('base64');

  if (input.intake.label.mimeType === 'application/pdf') {
    return {
      type: 'input_file' as const,
      filename: input.intake.label.originalName,
      file_data: `data:${input.intake.label.mimeType};base64,${base64Data}`
    };
  }
  return {
    type: 'input_image' as const,
    detail: input.config.imageDetail ?? 'auto',
    image_url: `data:${input.intake.label.mimeType};base64,${base64Data}`
  };
}

function readOpenAiImageDetail(
  rawValue: string | undefined
): OpenAiImageDetail | undefined {
  const normalizedValue = rawValue?.trim().toLowerCase();
  switch (normalizedValue) {
    case 'auto':
    case 'high':
    case 'low':
    case 'original':
      return normalizedValue;
    default:
      return undefined;
  }
}

function readOpenAiServiceTier(
  rawValue: string | undefined
): OpenAiServiceTier | undefined {
  const normalizedValue = rawValue?.trim().toLowerCase();
  switch (normalizedValue) {
    case 'auto':
    case 'default':
    case 'flex':
    case 'priority':
    case 'scale':
      return normalizedValue;
    default:
      return undefined;
  }
}

function recordOpenAiLatency(
  context: ReviewExtractorContext | undefined,
  stage: 'request-assembly' | 'provider-wait',
  outcome: 'success' | 'fast-fail',
  startedAt: number
) {
  context?.latencyCapture?.recordSpan({
    stage,
    provider: 'openai',
    attempt: context.latencyAttempt,
    outcome,
    durationMs: performance.now() - startedAt
  });
}
