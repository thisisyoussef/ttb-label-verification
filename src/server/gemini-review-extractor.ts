import {
  ApiError,
  GoogleGenAI,
  MediaResolution,
  ServiceTier,
  type GenerateContentParameters
} from '@google/genai';
import sharp from 'sharp';

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
  reviewExtractionModelOutputJsonSchema,
  reviewExtractionModelOutputSchema
} from './review-extraction-model-output';
import {
  createReviewExtractionFailure,
  finalizeReviewExtraction,
  ReviewExtractionFailure,
  type ReviewExtractor,
  type ReviewExtractorContext
} from './review-extraction';

// Measured 2026-04-17 on our 28-label corpus:
// Flash Lite: 27/28 correct, avg 5.0s, p95 7.3s.
// Flash: 23/28 correct, avg 6.5s, p95 9.9s.
const DEFAULT_GEMINI_VISION_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_GEMINI_TIMEOUT_MS = 5000;
const DEFAULT_GEMINI_MAX_ATTEMPTS = 3;

type GeminiMediaResolution = 'low' | 'medium' | 'high';
type GeminiServiceTier = 'standard' | 'priority' | 'flex';

export interface GeminiReviewExtractionConfig {
  apiKey: string;
  visionModel: string;
  timeoutMs?: number;
  mediaResolution?: GeminiMediaResolution;
  serviceTier?: GeminiServiceTier;
  thinkingBudget?: number;
  /**
   * Maximum number of attempts per extraction request. Defaults to 3.
   * Retries fire only on retryable failures (429, 5xx, timeout) with
   * short exponential backoff (200ms, 400ms, 800ms). Non-retryable
   * failures (auth, schema) fall through immediately to the factory's
   * cross-provider fallback chain.
   */
  maxAttempts?: number;
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

type GenerateContentResult = {
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

type GenerateContentClient = {
  generateContent: (request: GenerateContentParameters) => Promise<GenerateContentResult>;
  generateContentStream?: (
    request: GenerateContentParameters
  ) => Promise<AsyncGenerator<GenerateContentResult>>;
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
      }),
      maxAttempts: readGeminiMaxAttempts(
        { maxAttempts: undefined },
        env.GEMINI_MAX_ATTEMPTS
      )
    }
  };
}

// Returns the effective per-request retry budget. Reads env as a fallback
// and clamps to [1, 5] to avoid runaway retries.
// Default prescale is OFF; on the 2026-04-17 corpus, 1024px downscaling
// did not improve latency over Gemini's low-resolution path and slightly
// hurt accuracy.
const DEFAULT_GEMINI_PRESCALE_EDGE = 0;

// Resize image labels to at most N px on the longest edge before Gemini.
// PDFs, already-small images, and sharp decode failures fall back untouched.
async function maybePrescaleIntakeForGemini(
  intake: NormalizedReviewIntake
): Promise<NormalizedReviewIntake> {
  const labels = intake.labels.length > 0 ? intake.labels : [intake.label];
  if (labels.every((label) => label.mimeType === 'application/pdf')) {
    return intake;
  }
  const raw = process.env.GEMINI_PRESCALE_EDGE?.trim();
  const configured =
    raw === undefined || raw === ''
      ? DEFAULT_GEMINI_PRESCALE_EDGE
      : Number.parseInt(raw, 10);
  if (!Number.isFinite(configured) || configured <= 0) {
    return intake;
  }
  const prescaledLabels = await Promise.all(
    labels.map(async (label) => {
      if (label.mimeType === 'application/pdf') {
        return label;
      }

      try {
        const pipeline = sharp(label.buffer, { failOn: 'none' });
        const metadata = await pipeline.metadata();
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        const longestEdge = Math.max(width, height);
        if (longestEdge === 0 || longestEdge <= configured) {
          return label;
        }
        const resizedBuffer = await pipeline
          .resize({
            width: width >= height ? configured : undefined,
            height: height > width ? configured : undefined,
            withoutEnlargement: true,
            fit: 'inside'
          })
          .toBuffer();
        return {
          ...label,
          buffer: resizedBuffer
        };
      } catch {
        return label;
      }
    })
  );

  return {
    ...intake,
    label: prescaledLabels[0]!,
    labels: prescaledLabels
  };
}

// Collect streamed Gemini chunks into a flat response that matches
// `generateContent`. Validation still runs on the full accumulated JSON.
async function collectStreamedResponse(
  streamPromise: Promise<AsyncGenerator<GenerateContentResult>>,
  onFieldProgress?: (field: { name: string; value: unknown }) => void
): Promise<GenerateContentResult> {
  const stream = await streamPromise;
  let combinedText = '';
  let modelVersion: string | undefined;
  let sdkHttpResponse: GenerateContentResult['sdkHttpResponse'];
  let usageMetadata: GenerateContentResult['usageMetadata'];
  // Field scanner only spun up when a progress callback is wired.
  // Pulls completed `fields.XXX: {...}` subobjects out of the
  // streaming buffer and surfaces them for progressive UI work.
  const scanner = onFieldProgress
    ? (await import('./partial-json-field-scanner')).createFieldScanner()
    : null;
  for await (const chunk of stream) {
    if (typeof chunk.text === 'string' && chunk.text.length > 0) {
      combinedText += chunk.text;
      if (scanner && onFieldProgress) {
        for (const field of scanner.feed(chunk.text)) {
          try {
            onFieldProgress(field);
          } catch {
            // Progress callback errors must never break collection —
            // the caller's SSE emit can fail, we keep accumulating.
          }
        }
      }
    }
    if (chunk.modelVersion && !modelVersion) {
      modelVersion = chunk.modelVersion;
    }
    if (chunk.sdkHttpResponse && !sdkHttpResponse) {
      sdkHttpResponse = chunk.sdkHttpResponse;
    }
    if (chunk.usageMetadata) {
      // Final chunk carries the authoritative usage metadata; keep the
      // latest seen.
      usageMetadata = chunk.usageMetadata;
    }
  }
  return {
    text: combinedText,
    modelVersion,
    sdkHttpResponse,
    usageMetadata
  };
}

function readGeminiMaxAttempts(
  config: Pick<GeminiReviewExtractionConfig, 'maxAttempts'>,
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
  return DEFAULT_GEMINI_MAX_ATTEMPTS;
}

export function buildGeminiReviewExtractionRequest(input: {
  intake: NormalizedReviewIntake;
  config: GeminiReviewExtractionConfig;
  context?: {
    surface: LlmEndpointSurface;
    extractionMode: ExtractionMode;
  };
}): GenerateContentParameters {
  const surface = input.context?.surface ?? '/api/review';
  const extractionMode = input.context?.extractionMode ?? 'cloud';
  const ocrText = input.intake.ocrText;

  // When verification-mode is enabled and the applicant declared
  // identifier fields, send a prompt that asks the model to verify
  // them against the label. Falls back to the standard extraction
  // prompt when the flag is off or no identifiers were declared.
  const verificationPrompt = isVerificationModeEnabled()
    ? buildVerificationExtractionPrompt({
        surface,
        extractionMode,
        fields: input.intake.fields,
        ocrText
      })
    : null;

  const imageParts = (input.intake.labels.length > 0
    ? input.intake.labels
    : [input.intake.label]).map((label) => ({
    inlineData: {
      mimeType: label.mimeType,
      data: label.buffer.toString('base64')
    }
  }));

  // Verification-mode uses a [preImage text, image, postImage text]
  // structure so the numeric re-anchor is the LAST thing the model
  // reads. Standard path sends a single text block before the image.
  const contents = verificationPrompt
      ? [
        { text: verificationPrompt.preImage },
        ...imageParts,
        { text: verificationPrompt.postImage }
      ]
    : [
        {
          text: ocrText
            ? buildOcrAugmentedExtractionPrompt({ surface, extractionMode, ocrText })
            : buildReviewExtractionPrompt({ surface, extractionMode })
        },
        ...imageParts
      ];

  return {
    model: input.config.visionModel,
    contents,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: reviewExtractionModelOutputJsonSchema,
      mediaResolution: toGeminiMediaResolution(
        resolveGeminiMediaResolution({
          configuredMediaResolution: input.config.mediaResolution,
          mimeType: (input.intake.labels[0] ?? input.intake.label).mimeType
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
        generateContent: (request) => ai.models.generateContent(request),
        generateContentStream: (request) => ai.models.generateContentStream(request)
      } satisfies GenerateContentClient;
    })();

  return async (intake, context) => {
    const requestAssemblyStartedAt = performance.now();
    let request: GenerateContentParameters;

    // Pre-downscale the label image to 1024px longest edge before sending
    // to Gemini. Fewer pixels → fewer visual tokens → lower inference time.
    // TTB labels are printed text (not fine handwriting) so 1024px preserves
    // every detail the VLM needs. PDFs are left alone (they're text-heavy).
    // Disable with GEMINI_PRESCALE_EDGE=0.
    const prescaledIntake = await maybePrescaleIntakeForGemini(intake);

    try {
      request = buildGeminiReviewExtractionRequest({
        intake: prescaledIntake,
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
    // Retry transient Gemini failures (429/5xx/timeout) before falling
    // through to the next provider. Factory-level cross-provider fallback
    // kicks in after the per-provider retry budget is exhausted.
    //
    // Streaming path (opt-in via GEMINI_STREAM=enabled):
    // Collects chunks as they arrive and accumulates text. Final validation
    // still runs on the complete JSON because our Zod schema + guardrails
    // need a full object. Wire-level streaming reduces time-to-first-byte
    // and sets up the pipeline for future progressive-UI work where the
    // client can render field-level judgments as tokens arrive.
    //
    // Default OFF: measured on cola-cloud-all (2026-04-17) — two runs —
    // streaming stayed within correctness noise (24-26/28) but showed a
    // slightly worse p95 tail (11.2s vs 7.3-7.7s non-streaming). The
    // single-label flow doesn't benefit because our validation is 0-6ms
    // and already overlaps nothing. Progressive UI is where streaming
    // unlocks real value — enable when that frontend work lands.
    const streamEnabled =
      process.env.GEMINI_STREAM?.trim().toLowerCase() === 'enabled' &&
      typeof client.generateContentStream === 'function';
    const maxAttempts = readGeminiMaxAttempts(input.config);
    let lastFailure: ReviewExtractionFailure | null = null;
    let succeeded = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (streamEnabled && client.generateContentStream) {
          response = await collectStreamedResponse(
            client.generateContentStream({
              ...request,
              config: {
                ...request.config,
                abortSignal: controller.signal
              }
            }),
            context?.onVlmFieldProgress
          );
        } else {
          response = await client.generateContent({
            ...request,
            config: {
              ...request.config,
              abortSignal: controller.signal
            }
          });
        }
        succeeded = true;
        break;
      } catch (error) {
        const normalized = normalizeGeminiRuntimeFailure(error);
        lastFailure = normalized;
        // Only retry on retryable failures; fail fast on auth/schema errors.
        // 429 (quota / rate-limit) is treated as retryable at the chain
        // level (so the factory falls through to the next provider) but
        // NOT retryable on this same provider — hammering an exhausted
        // quota with 200/400/800ms backoffs just burns the cross-mode
        // fallback window (550ms) and forces a cloud->cloud "fallback"
        // that can't actually succeed.
        const rateLimited = normalized.status === 429;
        if (!normalized.error.retryable || rateLimited || attempt === maxAttempts) {
          clearTimeout(timeout);
          recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
          throw normalized;
        }
        // Exponential backoff with a small cap — 200ms, 400ms, 800ms
        const backoffMs = Math.min(200 * Math.pow(2, attempt - 1), 800);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
    if (!succeeded) {
      clearTimeout(timeout);
      recordGeminiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw lastFailure ?? normalizeGeminiRuntimeFailure(new Error('retry-exhausted'));
    }
    // TypeScript can't narrow across the loop
    response = response!;
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
