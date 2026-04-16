/**
 * Post-extraction OCR reconciliation.
 *
 * After the VLM returns structured fields, cross-check each field value
 * against the OCR pre-pass text. If the VLM returned a value that doesn't
 * appear in the OCR text, it's likely hallucinated from pixel reading
 * (pollution). Downgrade confidence on unverified fields.
 *
 * This enforces the separation between "reading" (OCR) and "structuring"
 * (VLM) that the prompt alone can't guarantee — VLMs ignore instructions
 * to not read from the image when the OCR text has gaps.
 */

import type { ReviewExtraction, ReviewExtractionField } from '../shared/contracts/review';

const FIELD_KEYS_TO_CHECK = [
  'brandName',
  'fancifulName',
  'classType',
  'alcoholContent',
  'netContents',
  'applicantAddress',
  'countryOfOrigin',
  'governmentWarning'
] as const;

/** Confidence floor for VLM-only values (not backed by OCR). */
const VLM_ONLY_CONFIDENCE_CAP = 0.55;

/** Minimum OCR text length to consider the pre-pass usable. */
const MIN_USABLE_OCR_LENGTH = 30;

export type ReconciliationResult = {
  /** Number of fields where VLM agreed with OCR. */
  ocrBacked: number;
  /** Number of fields where VLM produced a value not in OCR (pollution). */
  vlmOnly: number;
  /** Number of fields where VLM was present but OCR had nothing usable. */
  ocrEmpty: number;
  /** Per-field details. */
  fields: Record<string, 'ocr-backed' | 'vlm-only' | 'ocr-empty' | 'not-present'>;
};

/**
 * Reconcile VLM extraction against OCR pre-pass text.
 *
 * For each field:
 * - If the VLM value appears in the OCR text → trust it (OCR-backed)
 * - If the VLM value does NOT appear in OCR text → cap confidence (VLM-only)
 * - If OCR text is too short to be usable → skip reconciliation
 *
 * Returns the reconciled extraction (same shape, adjusted confidences)
 * and a reconciliation report.
 */
export function reconcileExtractionWithOcr(
  extraction: ReviewExtraction,
  ocrText: string | undefined
): { extraction: ReviewExtraction; reconciliation: ReconciliationResult } {
  const reconciliation: ReconciliationResult = {
    ocrBacked: 0,
    vlmOnly: 0,
    ocrEmpty: 0,
    fields: {}
  };

  // If no OCR text or too short, skip reconciliation entirely
  if (!ocrText || ocrText.length < MIN_USABLE_OCR_LENGTH) {
    for (const key of FIELD_KEYS_TO_CHECK) {
      reconciliation.fields[key] = 'ocr-empty';
      reconciliation.ocrEmpty++;
    }
    return { extraction, reconciliation };
  }

  const ocrLower = ocrText.toLowerCase();
  const reconciledFields = { ...extraction.fields };

  for (const key of FIELD_KEYS_TO_CHECK) {
    const field = extraction.fields[key] as ReviewExtractionField;

    if (!field.present || !field.value) {
      reconciliation.fields[key] = 'not-present';
      continue;
    }

    if (isValueInOcrText(field.value, ocrLower)) {
      reconciliation.fields[key] = 'ocr-backed';
      reconciliation.ocrBacked++;
    } else {
      // VLM returned a value that doesn't appear in OCR text — pollution.
      // Cap the confidence so downstream judgment treats it as uncertain.
      reconciliation.fields[key] = 'vlm-only';
      reconciliation.vlmOnly++;

      (reconciledFields as Record<string, ReviewExtractionField>)[key] = {
        ...field,
        confidence: Math.min(field.confidence, VLM_ONLY_CONFIDENCE_CAP),
        note: field.note
          ? `${field.note} | VLM-only: value not found in OCR text.`
          : 'VLM-only: value not found in OCR text. Confidence capped.'
      };
    }
  }

  return {
    extraction: { ...extraction, fields: reconciledFields },
    reconciliation
  };
}

/**
 * Check if a VLM-extracted value appears in the OCR text.
 *
 * Uses substring matching with normalization. A field value is considered
 * OCR-backed if any significant portion (first 10+ chars or the full
 * numeric value) appears in the OCR text.
 */
function isValueInOcrText(value: string, ocrLower: string): boolean {
  const valLower = value.toLowerCase().trim();

  // Exact substring match
  if (ocrLower.includes(valLower)) return true;

  // Check first significant chunk (10+ chars for longer values)
  if (valLower.length > 10) {
    const chunk = valLower.slice(0, Math.min(15, valLower.length));
    if (ocrLower.includes(chunk)) return true;
  }

  // For numeric fields (ABV, net contents): check if the number appears
  const numMatch = valLower.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    // Check if this number appears in OCR with nearby context (%, ml, oz, etc.)
    const num = numMatch[1];
    if (ocrLower.includes(num + '%') || ocrLower.includes(num + ' %')) return true;
    if (ocrLower.includes(num + 'ml') || ocrLower.includes(num + ' ml')) return true;
    if (ocrLower.includes(num + ' fl') || ocrLower.includes(num + ' pint')) return true;
    if (ocrLower.includes(num + ' oz') || ocrLower.includes(num + ' l')) return true;
    // Just the bare number with a % nearby
    const numIdx = ocrLower.indexOf(num);
    if (numIdx >= 0) {
      const nearby = ocrLower.slice(Math.max(0, numIdx - 5), numIdx + num.length + 10);
      if (nearby.includes('%') || nearby.includes('alc') || nearby.includes('vol') ||
          nearby.includes('ml') || nearby.includes('oz') || nearby.includes('proof')) {
        return true;
      }
    }
  }

  // Check individual significant words (3+ chars) — for brand names, addresses
  const words = valLower.split(/\s+/).filter(w => w.length >= 3);
  if (words.length > 0) {
    const matchCount = words.filter(w => ocrLower.includes(w)).length;
    // If majority of words appear in OCR, it's backed
    if (matchCount / words.length >= 0.5) return true;
  }

  return false;
}
