// Pure helpers for combining outputs from the OCR-regex extractor, the VLM
// extractor, and VLM-guided per-region OCR verification.
//
// These were split out of llm-trace.ts to keep that file under the 500-line
// source-size cap. They are pure transforms over ReviewExtraction /
// ReviewExtractionModelOutput — no side effects, no logging, no I/O — which
// makes them trivial to unit-test if we ever want to.
//
// Division of labor:
//   mergeOcrAndVlm       : combines OCR-regex fields with VLM fields, with
//                          OCR-regex winning for high-confidence matches and
//                          caps VLM-only field confidence so downstream
//                          judgment can see the OCR verification gap.
//   applyRegionOverrides : applies VLM-guided region OCR results. Verified
//                          per-region OCR always wins — that's the whole
//                          point of the "VLM says WHERE, OCR says WHAT"
//                          pipeline. Brand names are exempt because
//                          decorative brand fonts garble in Tesseract.
//   extractFieldValue    : simple regex pass to pull the likely value out of
//                          a region's raw OCR text for each field type.

import type { ReviewExtraction } from '../../shared/contracts/review';
import { normalizeGovernmentWarningText } from '../validators/government-warning-text';
import type { ReviewExtractionModelOutput } from './review-extraction';
import type { RegionOcrResult } from './vlm-region-detector';

type FieldShape = {
  present: boolean;
  value?: string;
  confidence: number;
  note?: string;
};

const FIELD_KEYS = [
  'brandName',
  'fancifulName',
  'classType',
  'alcoholContent',
  'netContents',
  'applicantAddress',
  'countryOfOrigin',
  'ageStatement',
  'sulfiteDeclaration',
  'appellation',
  'vintage',
  'governmentWarning'
] as const;

const HIGH_CONFIDENCE_OCR_THRESHOLD = 0.8;
const REGION_OCR_VERIFIED_CONFIDENCE = 0.92;

// Confidence cap applied to VLM-extracted fields when OCR didn't verify them.
//
// Why this exists: we used to fully trust VLM output, which let hallucinations
// slip through (e.g. wrong ABV numbers read off decorative fonts). The cap
// gives downstream judgment a signal that the read is unverified.
//
// Why it's now 0.80 and not 0.55: the old 0.55 was so aggressive that fields
// the VLM got right but OCR missed (e.g. "40% Alcohol by Volume" when the
// OCR regex is looking for "40% ALC") got pushed into 'review' status
// unnecessarily, undercounting valid approvals. 0.80 keeps the signal for
// judgment ("this wasn't verified") while letting standalone auto-pass
// paths (which gate at 0.9) still see a reasonable number.
//
// Override with OCR_VLM_CAP_CONFIDENCE env var. Set to 1 to disable the cap.
const VLM_ONLY_CONFIDENCE_CAP = readConfidenceCap();

function readConfidenceCap(): number {
  const raw = process.env.OCR_VLM_CAP_CONFIDENCE?.trim();
  if (!raw) return 0.8;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return 0.8;
  return parsed;
}

// Fields where the VLM reliably outperforms Tesseract OCR and therefore
// receive NO OCR override AND NO confidence cap. These are characterized
// by decorative typography, stylized fonts, or dense small text where
// character-by-character OCR produces fragments but the VLM reads the
// content correctly from visual context.
//
//   - brandName: decorative fonts; OCR returns fragments like "ae aw a _"
//     instead of "LEITZ".
//   - fancifulName: marketing-styled type; same failure mode as brand.
//   - classType: often in stylized or secondary fonts ("Bourbon Whiskey").
//   - countryOfOrigin: usually small text but straightforward — VLM reads
//     "Product of France" reliably; Tesseract may garble a character.
//   - applicantAddress: dense text with abbreviations; the VLM understands
//     what an address should look like and normalizes format accordingly.
//   - varietal: grape names in stylized fonts; same as brand.
//
// When LLM_RESOLVER_TIERED=enabled the resolver gate also reads this set
// so it doesn't re-examine a field the reconciler has already declared
// VLM-trusted.
const VLM_TRUSTED_FIELDS = readVlmTrustedFields();

function readVlmTrustedFields(): Set<string> {
  // Default tier: VLM is the stronger reader on these fields (decorative
  // typography, stylized fonts, dense small text, or regulatory canonical
  // text) so they flow through without OCR override and without the 0.80
  // confidence cap. The reconciler stays load-bearing for ABV, net
  // contents, and vintage — numeric fields where a hallucinated digit has
  // tax/regulatory impact.
  //
  // This list was promoted to default after Config G eval showed it gives
  // a structural +5 approvals on the cola-cloud-all corpus. The apparent
  // -3 regressions observed in early runs were traced to run-to-run
  // Gemini Flash variance on the government warning text (a 260-char
  // field where temperature-0 near-determinism isn't exact determinism),
  // not to the expanded trust. The warning now uses a 2-of-3 vote across
  // three independent reads (Tesseract full-image, warning OCV cropped,
  // VLM) to stabilize that boundary — see government-warning-validator.ts.
  //
  // EXTRACTION_TRUSTED_TIER=minimal reverts to the pre-G baseline (brand,
  // fancifulName, governmentWarning) if an operator needs to A/B against
  // the old behavior without code rollback.
  if (process.env.EXTRACTION_TRUSTED_TIER?.trim().toLowerCase() === 'minimal') {
    return new Set<string>(['governmentWarning', 'brandName', 'fancifulName']);
  }
  return new Set<string>([
    'governmentWarning',
    'brandName',
    'fancifulName',
    'classType',
    'countryOfOrigin',
    'applicantAddress',
    'varietals'
  ]);
}

/**
 * Merge OCR-regex extraction with VLM extraction.
 *
 * OCR-regex fields take priority (no pollution). VLM provides visual
 * signals, image quality, and fills in fields that OCR couldn't extract.
 *
 * Two fields are exempt from OCR override:
 *   - governmentWarning: warnings are often small/rotated — the VLM reads
 *     them reliably where OCR produces garbage.
 *   - brandName: decorative brand fonts are the VLM's wheelhouse and OCR's
 *     blind spot. OCR tends to return fragments like "ae aw a _" instead
 *     of "LEITZ".
 */
export function mergeOcrAndVlm(
  ocrOutput: ReviewExtractionModelOutput,
  vlmExtraction: ReviewExtraction
): ReviewExtraction {
  const mergedFields = { ...vlmExtraction.fields } as unknown as Record<string, FieldShape>;

  for (const key of FIELD_KEYS) {
    const ocrField = ocrOutput.fields[key] as FieldShape;

    // VLM-trusted fields are never overridden AND never capped. The VLM is
    // the source of truth for brand/fanciful/warning text.
    if (VLM_TRUSTED_FIELDS.has(key)) continue;

    // Trust OCR when it found a high-confidence pattern.
    if (ocrField.present && ocrField.value && ocrField.confidence >= HIGH_CONFIDENCE_OCR_THRESHOLD) {
      mergedFields[key] = ocrField;
      continue;
    }

    // OCR had nothing but VLM is confident — cap the VLM's confidence so
    // downstream judgment can see that the read was unverified. Skip the
    // cap entirely when OCR_VLM_CAP_CONFIDENCE=1 (disabled).
    if (mergedFields[key]?.present && VLM_ONLY_CONFIDENCE_CAP < 1) {
      const vlmField = mergedFields[key];
      mergedFields[key] = {
        ...vlmField,
        confidence: Math.min(vlmField.confidence, VLM_ONLY_CONFIDENCE_CAP),
        note: vlmField.note
          ? `${vlmField.note} | VLM-only (OCR miss)`
          : 'VLM-only: not found in OCR text.'
      };
    }
  }

  return {
    ...vlmExtraction,
    fields: mergedFields as unknown as ReviewExtraction['fields'],
    warningSignals: vlmExtraction.warningSignals,
    imageQuality: vlmExtraction.imageQuality,
    summary: `OCR-first: ${ocrOutput.summary}`
  };
}

/**
 * Apply VLM-guided region OCR overrides to the extraction.
 *
 * Where per-region OCR verified a field value, override the VLM extraction.
 * This is the final decontamination step — verified OCR always wins.
 *
 * Brand names are exempt: decorative typography is beyond Tesseract.
 */
export function applyRegionOverrides(
  extraction: ReviewExtraction,
  regions: RegionOcrResult[]
): ReviewExtraction {
  const fields = { ...extraction.fields } as unknown as Record<string, FieldShape>;

  const fieldKeyMap: Record<string, string> = {
    government_warning: 'governmentWarning',
    alcohol_content: 'alcoholContent',
    net_contents: 'netContents',
    brand_name: 'brandName'
  };

  for (const region of regions) {
    if (!region.verified || !region.ocrText) continue;

    const fieldKey = fieldKeyMap[region.field];
    if (!fieldKey) continue;

    // Decorative brand fonts — OCR fails here; keep VLM's read.
    if (fieldKey === 'brandName') continue;

    const extractedValue = extractFieldValue(region.field, region.ocrText);
    if (!extractedValue) continue;

    const currentField = fields[fieldKey];
    fields[fieldKey] = {
      present: true,
      value: extractedValue,
      confidence: REGION_OCR_VERIFIED_CONFIDENCE,
      note: currentField?.note
        ? `Verified by VLM-guided region OCR. Previous: ${currentField.note}`
        : 'Verified by VLM-guided region OCR.'
    };
  }

  return { ...extraction, fields: fields as unknown as ReviewExtraction['fields'] };
}

/**
 * Extract the relevant value for a field from raw OCR text in a region
 * crop. The regexes are intentionally permissive — false negatives are
 * worse than false positives here because the judgment layer will catch a
 * wrong value in comparison, but a missed region leaves the VLM's
 * potentially-hallucinated value untouched.
 */
export function extractFieldValue(field: string, ocrText: string): string | null {
  switch (field) {
    case 'government_warning': {
      const match = ocrText.match(/GOVERNMENT\s*WARN(?:ING|SING)[\s\S]*/i);
      if (!match) return null;
      return normalizeGovernmentWarningText(
        match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
      );
    }
    case 'alcohol_content': {
      // Try three patterns in decreasing specificity.
      const abv =
        ocrText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:ALC|Alc|alc)[^a-z]*/i) ??
        ocrText.match(/(?:ALC|Alc)[^a-z]*\s*(\d+(?:\.\d+)?)\s*%/i) ??
        ocrText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:by\s+vol|BY\s+VOL)/i);
      return abv ? abv[0].trim() : null;
    }
    case 'net_contents': {
      const net = ocrText.match(
        /\d+(?:\.\d+)?\s*(?:mL|ML|ml|FL\.?\s*OZ\.?|fl\.?\s*oz\.?|PINT|pint|L\b|cl\b)/i
      );
      return net ? net[0].trim() : null;
    }
    case 'brand_name': {
      // Best-effort: first substantial capitalized line in the region.
      const lines = ocrText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length >= 3 && line.length <= 40);
      return lines[0] ?? null;
    }
    default:
      return null;
  }
}
