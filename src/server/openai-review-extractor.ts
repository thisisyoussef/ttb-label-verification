import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import {
  beverageTypeSchema,
  type ReviewExtractionFields,
  type ReviewError,
  type WarningVisualSignals
} from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import {
  createReviewExtractionFailure,
  finalizeReviewExtraction,
  type ReviewExtractionModelOutput,
  type ReviewExtractor
} from './review-extraction';

const MODEL_OUTPUT_SCHEMA_NAME = 'ttb_label_extraction';
const DEFAULT_OPENAI_VISION_MODEL = 'gpt-5.4';

const apiExtractionFieldSchema = z.object({
  present: z.boolean(),
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  note: z.string().nullable()
});

const apiExtractionVarietalSchema = z.object({
  name: z.string(),
  percentage: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  note: z.string().nullable()
});

const apiWarningVisualSignalsSchema = z.object({
  prefixAllCaps: z.object({
    status: z.enum(['yes', 'no', 'uncertain']),
    confidence: z.number().min(0).max(1),
    note: z.string().nullable()
  }),
  prefixBold: z.object({
    status: z.enum(['yes', 'no', 'uncertain']),
    confidence: z.number().min(0).max(1),
    note: z.string().nullable()
  }),
  continuousParagraph: z.object({
    status: z.enum(['yes', 'no', 'uncertain']),
    confidence: z.number().min(0).max(1),
    note: z.string().nullable()
  }),
  separateFromOtherContent: z.object({
    status: z.enum(['yes', 'no', 'uncertain']),
    confidence: z.number().min(0).max(1),
    note: z.string().nullable()
  })
});

const apiReviewExtractionFieldsSchema = z.object({
  brandName: apiExtractionFieldSchema,
  fancifulName: apiExtractionFieldSchema,
  classType: apiExtractionFieldSchema,
  alcoholContent: apiExtractionFieldSchema,
  netContents: apiExtractionFieldSchema,
  applicantAddress: apiExtractionFieldSchema,
  countryOfOrigin: apiExtractionFieldSchema,
  ageStatement: apiExtractionFieldSchema,
  sulfiteDeclaration: apiExtractionFieldSchema,
  appellation: apiExtractionFieldSchema,
  vintage: apiExtractionFieldSchema,
  governmentWarning: apiExtractionFieldSchema,
  varietals: z.array(apiExtractionVarietalSchema)
});

const reviewExtractionModelOutputSchema = z.object({
  beverageTypeHint: beverageTypeSchema.nullable(),
  fields: apiReviewExtractionFieldsSchema,
  warningSignals: apiWarningVisualSignalsSchema,
  imageQuality: z.object({
    score: z.number().min(0).max(1),
    issues: z.array(z.string()).default([]),
    noTextDetected: z.boolean(),
    note: z.string().nullable()
  }),
  summary: z.string()
});

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
            text: buildUserPrompt()
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
      const liveClient = new OpenAI({
        apiKey: input.config.apiKey
      }).responses;

      return {
        parse: liveClient.parse.bind(liveClient)
      } satisfies ResponsesParseClient;
    })();

  return async (intake) => {
    let response: { output_parsed?: unknown };

    try {
      response = await client.parse(
        buildReviewExtractionRequest({
          intake,
          config: input.config
        })
      );
    } catch {
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
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'We could not extract label fields from this upload.',
        retryable: true
      });
    }

    return finalizeReviewExtraction({
      intake,
      model: input.config.visionModel,
      extracted: normalizeModelOutput(parsedOutput.data)
    });
  };
}

function buildUserPrompt() {
  return [
    'Extract label facts from this alcohol beverage label.',
    'Return structured output only.',
    'Do not make a final compliance judgment.',
    'For every field, mark present=true only when the label image supports the extraction.',
    'If a field is absent, set present=false and omit the value.',
    'Use confidence between 0 and 1.',
    'Assess image quality, and set noTextDetected=true only when no readable label text can be extracted.',
    'Estimate warning visual signals for all-caps prefix, bold prefix, continuous paragraph, and visual separation.',
    'Provide a beverageTypeHint only when the label content supports it; otherwise use unknown.'
  ].join(' ');
}

function buildLabelInputContent(intake: NormalizedReviewIntake) {
  const base64Data = intake.label.buffer.toString('base64');

  if (intake.label.mimeType === 'application/pdf') {
    return {
      type: 'input_file' as const,
      filename: intake.label.originalName,
      file_data: `data:${intake.label.mimeType};base64,${base64Data}`
    };
  }

  return {
    type: 'input_image' as const,
    detail: 'high' as const,
    image_url: `data:${intake.label.mimeType};base64,${base64Data}`
  };
}

function normalizeModelOutput(
  input: z.infer<typeof reviewExtractionModelOutputSchema>
): ReviewExtractionModelOutput {
  return {
    beverageTypeHint: input.beverageTypeHint ?? undefined,
    fields: normalizeModelFields(input.fields),
    warningSignals: normalizeWarningSignals(input.warningSignals),
    imageQuality: {
      score: input.imageQuality.score,
      issues: input.imageQuality.issues,
      noTextDetected: input.imageQuality.noTextDetected,
      note: input.imageQuality.note ?? undefined
    },
    summary: input.summary
  };
}

function normalizeModelFields(
  fields: z.infer<typeof apiReviewExtractionFieldsSchema>
): ReviewExtractionFields {
  return {
    brandName: normalizeExtractionField(fields.brandName),
    fancifulName: normalizeExtractionField(fields.fancifulName),
    classType: normalizeExtractionField(fields.classType),
    alcoholContent: normalizeExtractionField(fields.alcoholContent),
    netContents: normalizeExtractionField(fields.netContents),
    applicantAddress: normalizeExtractionField(fields.applicantAddress),
    countryOfOrigin: normalizeExtractionField(fields.countryOfOrigin),
    ageStatement: normalizeExtractionField(fields.ageStatement),
    sulfiteDeclaration: normalizeExtractionField(fields.sulfiteDeclaration),
    appellation: normalizeExtractionField(fields.appellation),
    vintage: normalizeExtractionField(fields.vintage),
    governmentWarning: normalizeExtractionField(fields.governmentWarning),
    varietals: fields.varietals.map((varietal) => ({
      name: varietal.name,
      percentage: varietal.percentage ?? undefined,
      confidence: varietal.confidence,
      note: varietal.note ?? undefined
    }))
  };
}

function normalizeWarningSignals(
  signals: z.infer<typeof apiWarningVisualSignalsSchema>
): WarningVisualSignals {
  return {
    prefixAllCaps: normalizeVisualSignal(signals.prefixAllCaps),
    prefixBold: normalizeVisualSignal(signals.prefixBold),
    continuousParagraph: normalizeVisualSignal(signals.continuousParagraph),
    separateFromOtherContent: normalizeVisualSignal(signals.separateFromOtherContent)
  };
}

function normalizeVisualSignal(
  signal: z.infer<typeof apiWarningVisualSignalsSchema.shape.prefixAllCaps>
) {
  return {
    status: signal.status,
    confidence: signal.confidence,
    note: signal.note ?? undefined
  };
}

function normalizeExtractionField(
  field: z.infer<typeof apiExtractionFieldSchema>
) {
  return {
    present: field.present,
    value: field.value ?? undefined,
    confidence: field.confidence,
    note: field.note ?? undefined
  };
}
