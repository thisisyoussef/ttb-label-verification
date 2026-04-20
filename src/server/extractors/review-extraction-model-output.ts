import { z } from 'zod';

import {
  beverageTypeSchema,
  type ReviewExtractionFields,
  type WarningVisualSignals
} from '../../shared/contracts/review';
import type { ExtractionMode } from '../llm/ai-provider-policy';
import type { LlmEndpointSurface } from '../llm/llm-policy';
import {
  buildReviewExtractionPrompt as buildPolicyPrompt,
  buildOcrAugmentedExtractionPrompt as buildOcrAugmentedPolicyPrompt,
  buildVerificationExtractionPrompt as buildVerificationPolicyPrompt,
  isVerificationModeEnabled
} from '../review/review-prompt-policy';
import { type ReviewExtractionModelOutput } from './review-extraction';

const apiExtractionFieldSchema = z.object({
  present: z.boolean(),
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  note: z.string().nullable(),
  // Verification-mode outputs — populated only when the extractor runs
  // with VERIFICATION_MODE=on AND the applicant declared the field.
  // Nullable so the model can omit them under the standard prompt.
  visibleText: z.string().nullable().optional(),
  alternativeReading: z.string().nullable().optional(),
  // Multi-image attribution. Zero-indexed ordinal of the uploaded image
  // the value was read from. `null` on single-image intakes, when the
  // value spans images, or when the model can't attribute. No
  // front/back semantics — strictly upload order.
  evidenceImage: z.number().int().min(0).nullable().optional()
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

export type ReviewExtractionModelOutputSchema = z.infer<
  typeof reviewExtractionModelOutputSchema
>;

export function buildReviewExtractionPrompt(input: {
  surface: LlmEndpointSurface;
  extractionMode: ExtractionMode;
}) {
  const base = buildPolicyPrompt(input);
  if (process.env.EXTRACTION_FEW_SHOT?.trim().toLowerCase() === 'enabled') {
    return `${base}\n\n${FEW_SHOT_EXAMPLES}`;
  }
  return base;
}

// Text-only few-shot appendix. Each example shows a real label description
// and the EXPECTED structured output shape. We avoid sending actual example
// images to keep token cost under control — the VLM already knows how to
// read pixels, but benefits from seeing the canonical output format on
// real COLA-style labels.
//
// Examples chosen from the golden set to span the three beverage families.
const FEW_SHOT_EXAMPLES = [
  'FEW-SHOT EXAMPLES (these are illustrative outputs from other labels — use them as templates; do NOT copy their values):',
  '',
  'Example 1 — distilled spirits:',
  'Label shows: "PERSIAN EMPIRE — ARAK — 40% Alc./Vol. — Product of Canada — 750 mL"',
  'Expected output shape:',
  '{"beverageTypeHint":"distilled-spirits","fields":{"brandName":{"value":"Persian Empire","confidence":0.95,"present":true},"fancifulName":{"value":"Arak","confidence":0.92,"present":true},"classType":{"value":"Arak","confidence":0.90,"present":true},"alcoholContent":{"value":"40% Alc./Vol.","confidence":0.97,"present":true},"netContents":{"value":"750 mL","confidence":0.95,"present":true},"countryOfOrigin":{"value":"Canada","confidence":0.90,"present":true}}}',
  '',
  'Example 2 — wine with vintage + appellation:',
  'Label shows: "LEITZ — KLOSTERLAY — RHEINGAU — RIESLING — 2020 — 750 mL — 12.5% Alc./Vol."',
  'Expected output shape:',
  '{"beverageTypeHint":"wine","fields":{"brandName":{"value":"Leitz","confidence":0.95,"present":true},"fancifulName":{"value":"Klosterlay","confidence":0.92,"present":true},"classType":{"value":"Riesling","confidence":0.90,"present":true},"alcoholContent":{"value":"12.5% Alc./Vol.","confidence":0.96,"present":true},"netContents":{"value":"750 mL","confidence":0.95,"present":true},"appellation":{"value":"Rheingau","confidence":0.88,"present":true},"vintage":{"value":"2020","confidence":0.92,"present":true},"countryOfOrigin":{"value":"Germany","confidence":0.85,"present":true}}}',
  '',
  'Example 3 — malt beverage:',
  'Label shows: "HARPOON — IPA — India Pale Ale — 5.9% Alc./Vol. — 12 FL OZ — Brewed by Harpoon Brewery, Boston, MA"',
  'Expected output shape (notice: NEVER use "ABV" on malt beverage labels — the field is still captured as "5.9% Alc./Vol." preserved as printed):',
  '{"beverageTypeHint":"malt-beverage","fields":{"brandName":{"value":"Harpoon","confidence":0.95,"present":true},"fancifulName":{"value":"IPA","confidence":0.92,"present":true},"classType":{"value":"India Pale Ale","confidence":0.92,"present":true},"alcoholContent":{"value":"5.9% Alc./Vol.","confidence":0.96,"present":true},"netContents":{"value":"12 FL OZ","confidence":0.94,"present":true},"applicantAddress":{"value":"Harpoon Brewery, Boston, MA","confidence":0.88,"present":true}}}',
  '',
  'KEY REMINDERS from these examples:',
  '  - Preserve casing, punctuation, and unit notation exactly as printed on the label.',
  '  - If a field is NOT visible, emit value:null and present:false.',
  '  - Confidence values reflect your certainty, not the label\'s quality.',
  '  - Government warning: always include the full extracted warning text when present.'
].join('\n');

export function buildOcrAugmentedExtractionPrompt(input: {
  surface: LlmEndpointSurface;
  extractionMode: ExtractionMode;
  ocrText: string;
}) {
  return buildOcrAugmentedPolicyPrompt(input);
}

/**
 * Thin wrapper around the policy-level verification prompt. Returns
 * `{ preImage, postImage }` when there are identifier fields to
 * verify; `null` otherwise so callers fall back to the standard
 * extraction prompt. Callers must place the label image BETWEEN the
 * two text halves for the recency-anchored structure to work.
 */
export function buildVerificationExtractionPrompt(input: {
  surface: LlmEndpointSurface;
  extractionMode: ExtractionMode;
  fields: Parameters<typeof buildVerificationPolicyPrompt>[0]['fields'];
  ocrText?: string;
}): { preImage: string; postImage: string } | null {
  return buildVerificationPolicyPrompt({
    surface: input.surface,
    extractionMode: input.extractionMode,
    fields: input.fields,
    ocrText: input.ocrText
  });
}

/** Re-export so extractors don't import `review-prompt-policy` directly. */
export { isVerificationModeEnabled };

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
    note: field.note ?? undefined,
    visibleText: field.visibleText ?? undefined,
    alternativeReading: field.alternativeReading ?? undefined,
    evidenceImage: field.evidenceImage ?? undefined
  };
}
