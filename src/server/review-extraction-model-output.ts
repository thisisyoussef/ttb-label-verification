import { z } from 'zod';

import {
  beverageTypeSchema,
  type ReviewExtractionFields,
  type WarningVisualSignals
} from '../shared/contracts/review';
import { type ReviewExtractionModelOutput } from './review-extraction';

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

export const apiWarningVisualSignalsSchema = z.object({
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

export const reviewExtractionModelOutputSchema = z.object({
  beverageTypeHint: beverageTypeSchema.nullable(),
  fields: apiReviewExtractionFieldsSchema,
  warningSignals: apiWarningVisualSignalsSchema,
  imageQuality: z.object({
    score: z.number().min(0).max(1),
    issues: z.array(z.string()).default([]),
    noTextDetected: z.boolean(),
    note: z.string().nullable()
  }),
  summary: z.string().default('Structured extraction completed successfully.')
});

export const reviewExtractionModelOutputJsonSchema = z.toJSONSchema(
  reviewExtractionModelOutputSchema
);

export function buildReviewExtractionPrompt() {
  return [
    'You observe. You do not judge.',
    'Extract label facts from this alcohol beverage label and return structured output only.',
    'Never make a final compliance judgment.',
    'Never compare extracted text against any "correct" or "expected" value.',
    'Only report what is visibly supported by the submitted label image.',
    'For every field, mark present=true only when the label image supports the extraction. If a field is absent, set present=false and omit the value.',
    'Use confidence between 0 and 1.',
    'Assess image quality, and set noTextDetected=true only when no readable label text can be extracted.',
    'Estimate warning visual signals for all-caps prefix, bold prefix, continuous paragraph, and visual separation.',
    'Provide a beverageTypeHint only when the label content supports it; otherwise use unknown.',
    'Populate the structured fields exactly as named, including governmentWarning when warning text is visible.'
  ].join(' ');
}

export function normalizeReviewExtractionModelOutput(
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
