import { ApiError, GoogleGenAI, type GenerateContentParameters } from '@google/genai';

import type { ReviewError } from '../shared/contracts/review';
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
  type ReviewExtractor
} from './review-extraction';

const DEFAULT_GEMINI_VISION_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_GEMINI_TIMEOUT_MS = 3000;

export interface GeminiReviewExtractionConfig {
  apiKey: string;
  visionModel: string;
  timeoutMs?: number;
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
        message: 'Gemini extraction is not configured for this environment.',
        retryable: false
      }
    };
  }

  return {
    success: true,
    value: {
      apiKey,
      visionModel: env.GEMINI_VISION_MODEL?.trim() || DEFAULT_GEMINI_VISION_MODEL,
      timeoutMs: readGeminiTimeoutMs(env.GEMINI_TIMEOUT_MS)
    }
  };
}

export function buildGeminiReviewExtractionRequest(input: {
  intake: NormalizedReviewIntake;
  config: GeminiReviewExtractionConfig;
}): GenerateContentParameters {
  return {
    model: input.config.visionModel,
    contents: [
      {
        text: buildReviewExtractionPrompt()
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
      responseJsonSchema: reviewExtractionModelOutputJsonSchema
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

  return async (intake) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.config.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS
    );

    let response: { text?: string; modelVersion?: string };
    try {
      const request = buildGeminiReviewExtractionRequest({
        intake,
        config: input.config
      });
      response = await client.generateContent({
        ...request,
        config: {
          ...request.config,
          abortSignal: controller.signal
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      throw normalizeGeminiRuntimeFailure(error);
    }
    clearTimeout(timeout);

    const responseText = response.text?.trim();
    if (!responseText) {
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'Gemini returned an empty structured response.',
        retryable: true
      });
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(responseText);
    } catch {
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'Gemini returned malformed structured output.',
        retryable: true
      });
    }

    const normalizedOutput = reviewExtractionModelOutputSchema.safeParse(parsedOutput);
    if (!normalizedOutput.success) {
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'Gemini returned malformed structured output.',
        retryable: true
      });
    }

    try {
      return finalizeReviewExtraction({
        intake,
        model: response.modelVersion ?? input.config.visionModel,
        extracted: normalizeReviewExtractionModelOutput(normalizedOutput.data)
      });
    } catch {
      throw createReviewExtractionFailure({
        status: 500,
        kind: 'adapter',
        message: 'We could not normalize the Gemini extraction output.',
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
