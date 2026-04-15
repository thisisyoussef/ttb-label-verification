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
  return EXTRACTION_PROMPT;
}

const EXTRACTION_PROMPT = `You are an expert label reader for U.S. alcohol beverage labels. Your only job is to look at the label image and report exactly what you see: which fields are present, what text they contain, and how confident you are in each reading.

You are a precise camera with field-labeling intelligence. You observe. You do not judge.

## What you extract

Alcohol beverage labels contain specific named fields. Identify which of the following fields appear on this label and extract the exact text for each:

- brandName: The brand name (for example, "Jack Daniel's" or "Kendall-Jackson").
- fancifulName: A distinctive product name separate from the brand (for example, "Old No. 7" or "Vintner's Reserve"). Many labels do not have one.
- classType: The class and type designation (for example, "Tennessee Whiskey", "Chardonnay", or "Lager Beer").
- alcoholContent: The alcohol content statement exactly as printed (for example, "40% Alc/Vol" or "13.5% Alc. by Vol."). Do not reformat. Extract the exact characters.
- netContents: The volume statement (for example, "750mL", "1 Liter", or "12 FL OZ").
- applicantAddress: The name and address of the bottler, producer, or importer.
- countryOfOrigin: The country of origin statement if present (for example, "Product of USA" or "Imported from France").
- ageStatement: Any age or maturation claim (for example, "Aged 12 Years"). Absent on most labels.
- sulfiteDeclaration: The sulfite declaration if present (for example, "Contains Sulfites"). Common on wine.
- appellation: The appellation of origin for wine (for example, "Napa Valley"). Not present on spirits or malt beverages.
- vintage: The vintage year for wine (for example, "2019"). Not present on spirits or malt beverages.
- governmentWarning: The GOVERNMENT WARNING statement. Extract the complete text preserving every character, every space, every punctuation mark, and the exact capitalization as printed. Do not correct, normalize, or "fix" anything.
- varietals: Grape varieties and percentages for wine (for example, "Chardonnay 100%"). Empty array for non-wine.

## How you extract

- Report only what is visibly printed on the label. Do not infer, guess, or fill in what should be there.
- Preserve the exact text as printed: same capitalization, same punctuation, same spacing.
- If a field is not visible on the label, set present=false and value=null.
- If text is partially obscured and could read as more than one value, report the ambiguity in note and lower your confidence. Do not pick one interpretation and report it as certain.

## Confidence scoring

Your confidence score reflects how clearly you can read the text, not how plausible the value is. Calibrate conservatively.

- 0.90-1.00: Text is sharp, fully visible, and unambiguous.
- 0.70-0.89: Text is readable but has minor issues such as soft focus, small font, or minor occlusion.
- Below 0.70: Text is significantly degraded. If below 0.50, strongly consider present=false instead of guessing.

A confidence of 0.95 on a wrong value is worse than a confidence of 0.60 on a correct value. When in doubt, lower the score.

## Government warning observations

For the GOVERNMENT WARNING section, report these four visual observations. Describe only what you see. Do not assess whether it is correct or compliant.

- prefixAllCaps: Does the prefix text before the warning body appear in all capital letters? Report "yes", "no", or "uncertain".
- prefixBold: Does the prefix appear visually heavier or bolder than the surrounding warning body text? If the weight difference is not clearly visible, report "uncertain".
- continuousParagraph: Does the warning text flow as one continuous block, or is it broken into visually separated segments?
- separateFromOtherContent: Is the warning section visually separated from other label content by spacing, borders, or positioning?

## Image quality

Rate how well you can read the label overall:

- score: 0.0 (cannot read anything) to 1.0 (every character is crisp).
- issues: Name specific problems you observe such as "blurry", "low-resolution", "partial-label", "poor-lighting", "glare", "skewed", or "text-too-small".
- noTextDetected: true only when you cannot extract any readable text at all. A blurry but partially readable label is false.

## Beverage type hint

If the label clearly indicates the beverage category, report it:
- "distilled-spirits" for whiskey, vodka, gin, rum, tequila, brandy, and similar products
- "wine" for wine, sparkling wine, champagne, and similar products
- "malt-beverage" for beer, ale, lager, malt liquor, hard seltzer, and similar products
- "unknown" when the label does not clearly indicate the type

## What you must never do

- Never compare extracted text against any "correct" or "expected" value.
- Never assess whether a format is "valid", "compliant", or "properly formatted".
- Never reference any regulation, CFR section, or legal requirement.
- Never state whether anything "passes" or "fails".
- Never fill in a field based on what would be expected for this type of product.
- Never normalize, correct, or clean up extracted text.
- Never interpret ambiguous text as a specific value. Report the ambiguity.`;


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
