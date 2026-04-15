import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { wrapOpenAI } from 'langsmith/wrappers';

import type { ReviewError } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import {
  buildReviewExtractionPrompt,
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
const DEFAULT_OPENAI_VISION_MODEL = 'gpt-5.4';

export interface ReviewExtractionConfig {
  apiKey: string;
  visionModel: string;
  store: false;
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
        message: 'Live extraction is not configured for this environment.',
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
        message: 'OpenAI extraction must run with OPENAI_STORE=false.',
        retryable: false
      }
    };
  }

  return {
    success: true,
    value: {
      apiKey,
      visionModel: env.OPENAI_VISION_MODEL?.trim() || DEFAULT_OPENAI_VISION_MODEL,
      store: false
    }
  };
}

export function buildReviewExtractionRequest(input: {
  intake: NormalizedReviewIntake;
  config: ReviewExtractionConfig;
}): ResponsesParseRequest {
  return {
    model: input.config.visionModel,
    store: input.config.store,
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
            text: buildReviewExtractionPrompt()
          },
          buildLabelInputContent(input.intake)
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
        config: input.config
      });
    } catch (error) {
      recordOpenAiLatency(context, 'request-assembly', 'fast-fail', requestAssemblyStartedAt);
      throw error;
    }

    recordOpenAiLatency(context, 'request-assembly', 'success', requestAssemblyStartedAt);

    const providerWaitStartedAt = performance.now();
    let response: { output_parsed?: unknown };

    try {
      response = await client.parse(request);
    } catch {
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

    try {
      const extraction = finalizeReviewExtraction({
        intake,
        model: input.config.visionModel,
        extracted: normalizeReviewExtractionModelOutput(parsedOutput.data)
      });
      recordOpenAiLatency(context, 'provider-wait', 'success', providerWaitStartedAt);
      return extraction;
    } catch {
      recordOpenAiLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 500,
        kind: 'adapter',
        message: 'We could not normalize the OpenAI extraction output.',
        retryable: false
      });
    }
  };
}

// PDFs are converted to PNG upstream by pdf-label-converter.ts,
// so this function always receives an image buffer.
function buildLabelInputContent(intake: NormalizedReviewIntake) {
  const base64Data = intake.label.buffer.toString('base64');

  return {
    type: 'input_image' as const,
    detail: 'high' as const,
    image_url: `data:${intake.label.mimeType};base64,${base64Data}`
  };
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
