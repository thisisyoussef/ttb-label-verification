/**
 * Split extraction: separates text structuring from visual assessment.
 *
 * Call 1 (text-only): LLM receives ONLY the OCR text. No image. Cannot hallucinate pixels.
 * Call 2 (image-only): LLM receives ONLY the image for visual formatting signals.
 *
 * This eliminates LLM pollution by design — the structuring call has no access
 * to the image, so it can only work with what OCR actually read.
 *
 * Falls back to the original single-call VLM extraction when OCR text is
 * unavailable or too short, so existing behavior is preserved.
 */

import type {
  ReviewExtraction,
  ReviewExtractionFields,
  WarningVisualSignals
} from '../shared/contracts/review';
import { reviewExtractionSchema } from '../shared/contracts/review';
import { randomUUID } from 'node:crypto';
import type { NormalizedReviewIntake } from './review-intake';
import {
  resolveReviewBeverageType,
  normalizeImageQualityAssessment,
  type ReviewExtractionModelOutput
} from './review-extraction';

/** Minimum OCR text length to use split extraction. Below this, fall back to VLM. */
const MIN_OCR_FOR_SPLIT = 40;

export type TextStructuringClient = {
  /** Send text-only prompt (no image) and get structured JSON back. */
  complete: (systemPrompt: string, userMessage: string) => Promise<string>;
};

const TEXT_STRUCTURING_SYSTEM = `You are a text structuring engine. You receive raw OCR text from an alcohol beverage label and organize it into named fields.

You have NO access to the label image. You can ONLY work with the text provided. If a field is not clearly present in the text, set present=false. Do not guess or invent values.

Respond with ONLY valid JSON matching this schema:
{
  "beverageTypeHint": "distilled-spirits" | "wine" | "malt-beverage" | "unknown",
  "brandName": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "fancifulName": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "classType": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "alcoholContent": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "netContents": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "applicantAddress": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "countryOfOrigin": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "ageStatement": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "sulfiteDeclaration": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "appellation": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "vintage": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "governmentWarning": {"present": bool, "value": string|null, "confidence": 0-1, "note": string|null},
  "summary": "brief description"
}

RULES:
- Only extract values that are clearly present in the OCR text
- For confidence: 0.9+ = clearly readable in OCR. 0.6-0.8 = partially readable. Below 0.6 = set present=false
- Government warning: look for "GOVERNMENT WARNING" followed by the statutory text
- ABV/Alcohol: look for percentage patterns near "alc", "vol", "proof"
- Brand name: typically the most prominent/first text, often in caps
- If the OCR text is garbled for a field, set present=false with a note`;

/**
 * Run text-only structuring: LLM receives OCR text, no image.
 * Returns partial extraction fields. Visual signals come from a separate call.
 */
export async function runTextOnlyStructuring(
  ocrText: string,
  client: TextStructuringClient
): Promise<Partial<ReviewExtractionModelOutput> | null> {
  if (ocrText.length < MIN_OCR_FOR_SPLIT) return null;

  try {
    const raw = await client.complete(
      TEXT_STRUCTURING_SYSTEM,
      `Here is the OCR text extracted from an alcohol beverage label:\n\n${ocrText}\n\nStructure this into the required fields. Output ONLY valid JSON.`
    );

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    // Build the fields object from the parsed response
    const fieldKeys = [
      'brandName', 'fancifulName', 'classType', 'alcoholContent',
      'netContents', 'applicantAddress', 'countryOfOrigin', 'ageStatement',
      'sulfiteDeclaration', 'appellation', 'vintage', 'governmentWarning'
    ] as const;

    const fields: Record<string, { present: boolean; value: string | undefined; confidence: number; note?: string }> = {};
    for (const key of fieldKeys) {
      const f = parsed[key];
      if (f && typeof f === 'object') {
        fields[key] = {
          present: Boolean(f.present),
          value: f.present ? String(f.value ?? '') : undefined,
          confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0.5,
          note: f.note ?? undefined
        };
      } else {
        fields[key] = { present: false, value: undefined, confidence: 0.1 };
      }
    }

    return {
      beverageTypeHint: parsed.beverageTypeHint ?? 'unknown',
      fields: fields as unknown as ReviewExtractionFields,
      summary: parsed.summary ?? 'Text-only structuring from OCR.',
      imageQuality: {
        score: 0.7, // Can't assess image quality without the image
        issues: [],
        noTextDetected: ocrText.length < 10
      },
      // Visual signals unknown — will be filled by image-only call
      warningSignals: {
        prefixAllCaps: { status: 'uncertain', confidence: 0.1 },
        prefixBold: { status: 'uncertain', confidence: 0.1 },
        continuousParagraph: { status: 'uncertain', confidence: 0.1 },
        separateFromOtherContent: { status: 'uncertain', confidence: 0.1 }
      } as WarningVisualSignals
    };
  } catch {
    return null;
  }
}

/**
 * Merge text-only structuring output with visual signals from the VLM extraction.
 * Text fields come from the text-only call (no pollution).
 * Visual signals come from the VLM call (has image access).
 * Image quality comes from the VLM call.
 */
export function mergeTextAndVisual(
  textOutput: Partial<ReviewExtractionModelOutput>,
  vlmOutput: ReviewExtractionModelOutput
): ReviewExtractionModelOutput {
  return {
    beverageTypeHint: textOutput.beverageTypeHint ?? vlmOutput.beverageTypeHint,
    fields: textOutput.fields ?? vlmOutput.fields,
    warningSignals: vlmOutput.warningSignals, // Visual signals from VLM (has image)
    imageQuality: vlmOutput.imageQuality,      // Image quality from VLM (has image)
    summary: `Split extraction: text fields from OCR-only LLM, visual signals from VLM. ${textOutput.summary ?? ''}`
  };
}

/**
 * Build a ReviewExtraction from text-only structuring output.
 * Used when VLM call is skipped entirely (text-only mode).
 */
export function finalizeTextOnlyExtraction(input: {
  intake: NormalizedReviewIntake;
  textOutput: Partial<ReviewExtractionModelOutput>;
  model: string;
}): ReviewExtraction {
  const extracted = {
    beverageTypeHint: input.textOutput.beverageTypeHint,
    fields: input.textOutput.fields!,
    warningSignals: input.textOutput.warningSignals!,
    imageQuality: input.textOutput.imageQuality!,
    summary: input.textOutput.summary ?? 'Text-only extraction.'
  } satisfies ReviewExtractionModelOutput;

  const beverageResolution = resolveReviewBeverageType({
    applicationBeverageTypeHint: input.intake.fields.beverageTypeHint,
    extractedClassType: extracted.fields.classType?.value,
    extractedAlcoholContent: extracted.fields.alcoholContent?.value,
    extractedNetContents: extracted.fields.netContents?.value,
    extractedGovernmentWarning: extracted.fields.governmentWarning?.value,
    extractedBrandName: extracted.fields.brandName?.value,
    extractedApplicantAddress: extracted.fields.applicantAddress?.value,
    extractedCountryOfOrigin: extracted.fields.countryOfOrigin?.value,
    noTextDetected: extracted.imageQuality?.noTextDetected,
    modelBeverageTypeHint: extracted.beverageTypeHint
  });

  return reviewExtractionSchema.parse({
    id: randomUUID(),
    model: `text-only:${input.model}`,
    beverageType: beverageResolution.beverageType,
    beverageTypeSource: beverageResolution.source,
    modelBeverageTypeHint: extracted.beverageTypeHint,
    standalone: input.intake.standalone,
    hasApplicationData: input.intake.hasApplicationData,
    noPersistence: true,
    imageQuality: normalizeImageQualityAssessment(extracted.imageQuality),
    warningSignals: extracted.warningSignals,
    fields: extracted.fields,
    summary: extracted.summary
  });
}

/**
 * Check if split extraction mode is enabled.
 */
export function isSplitExtractionEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.SPLIT_EXTRACTION?.trim().toLowerCase() === 'enabled';
}
