import {
  CANONICAL_GOVERNMENT_WARNING,
  checkReviewSchema,
  warningEvidenceSchema,
  type CheckReview,
  type CheckStatus,
  type ReviewExtraction,
  type ReviewVisualSignal,
  type WarningSubCheck
} from '../shared/contracts/review';
import {
  diffGovernmentWarningText,
  normalizeGovernmentWarningText
} from './government-warning-diff';
import {
  applyOcrCrossCheckToConfidence,
  type OcrCrossCheckResult
} from './warning-ocr-cross-check';
import type { WarningOcvResult } from './warning-region-ocv';

const WARNING_TEXT_CONFIDENCE_THRESHOLD = 0.8;
const WARNING_VISUAL_CONFIDENCE_THRESHOLD = 0.75;
const WARNING_CITATIONS = [
  '27 CFR 16.21 mandatory warning text',
  '27 CFR 16.22 warning formatting and legibility',
  'TTB health warning statement guidance'
] as const;

export { diffGovernmentWarningText, normalizeGovernmentWarningText };

export function buildGovernmentWarningCheck(
  extraction: ReviewExtraction,
  ocrCrossCheck?: OcrCrossCheckResult,
  warningOcv?: WarningOcvResult
): CheckReview {
  // When OCV verified the warning text deterministically, use it as primary signal.
  if (warningOcv && warningOcv.status === 'verified') {
    return buildOcvBasedWarningCheck(extraction, warningOcv);
  }

  const extractedField = extraction.fields.governmentWarning;
  // Use OCV text (from cropped/enhanced region) when available
  const ocvText = warningOcv?.status === 'partial' ? warningOcv.extractedText : undefined;
  const extractedText = normalizeGovernmentWarningText(ocvText ?? extractedField.value);
  const exactSegments = diffGovernmentWarningText({
    required: CANONICAL_GOVERNMENT_WARNING,
    extracted: extractedText
  });
  const exactMatch = extractedText === CANONICAL_GOVERNMENT_WARNING;
  const textReliable = isTextReliable(extraction);
  const hasWarningText = extractedField.present && extractedText.length > 0;
  // Similarity score between extracted and canonical, using same tiers as
  // the OCV fast-path (≥0.85 pass, ≥0.65 review, else fail). Without this,
  // the non-OCV path treated ANY character difference as fail, which drove
  // a malt-beverage false-reject cluster on labels where Gemini VLM read
  // the warning cleanly but not perfectly (mixed-case vs all-caps source,
  // state-addition suffixes, subtle punctuation drift).
  const textSimilarity = hasWarningText
    ? computeWarningSimilarity(extractedText, CANONICAL_GOVERNMENT_WARNING)
    : 0;

  const subChecks = warningEvidenceSchema.shape.subChecks.parse([
    buildPresenceSubCheck({
      hasWarningText,
      textReliable
    }),
    buildExactTextSubCheck({
      hasWarningText,
      exactMatch,
      textReliable,
      similarity: textSimilarity
    }),
    buildHeadingSubCheck({
      extractedText,
      prefixAllCaps: extraction.warningSignals.prefixAllCaps,
      prefixBold: extraction.warningSignals.prefixBold,
      hasWarningText,
      textReliable
    }),
    buildContinuousParagraphSubCheck({
      signal: extraction.warningSignals.continuousParagraph,
      hasWarningText
    }),
    buildLegibilitySubCheck({
      extraction,
      hasWarningText
    })
  ]);

  const status = summarizeWarningStatus(subChecks);
  const severity =
    status === 'fail' ? 'blocker' : status === 'review' ? 'major' : 'note';

  return checkReviewSchema.parse({
    id: 'government-warning',
    label: 'Government warning',
    status,
    severity,
    summary: buildWarningSummary({
      status,
      subChecks,
      hasWarningText,
      exactMatch
    }),
    details: buildWarningDetails(subChecks),
    confidence: deriveWarningConfidence(extraction, ocrCrossCheck),
    citations: [...WARNING_CITATIONS],
    extractedValue: hasWarningText ? extractedText : undefined,
    warning: {
      subChecks,
      required: CANONICAL_GOVERNMENT_WARNING,
      extracted: extractedText,
      segments: exactSegments
    }
  });
}

function buildPresenceSubCheck(input: {
  hasWarningText: boolean;
  textReliable: boolean;
}): WarningSubCheck {
  if (input.hasWarningText) {
    return {
      id: 'present',
      label: 'Warning text is present',
      status: 'pass',
      reason: 'Warning text is on the label.'
    };
  }

  return {
    id: 'present',
    label: 'Warning text is present',
    status: input.textReliable ? 'fail' : 'review',
    reason: input.textReliable
      ? 'No government warning was found on this label.'
      : 'The label image is too unclear to confirm whether the warning is there.'
  };
}

/** OCV fast-path: warning verified deterministically via dedicated OCR comparison. */
function buildOcvBasedWarningCheck(extraction: ReviewExtraction, ocv: WarningOcvResult): CheckReview {
  const extractedText = normalizeGovernmentWarningText(ocv.extractedText);
  const segments = diffGovernmentWarningText({ required: CANONICAL_GOVERNMENT_WARNING, extracted: extractedText });
  const subChecks = warningEvidenceSchema.shape.subChecks.parse([
    { id: 'present', label: 'Warning text is present', status: 'pass', reason: 'Warning text is on the label.' },
    { id: 'exact-text', label: 'Warning text matches required wording',
      status: ocv.similarity >= 0.85 ? 'pass' : ocv.similarity >= 0.65 ? 'review' : 'fail',
      reason: `Warning text ${ocv.similarity >= 0.85 ? 'matches' : 'partly matches'} (${(ocv.similarity * 100).toFixed(1)}% match).` },
    { id: 'uppercase-bold-heading', label: 'Heading is uppercase and bold',
      status: ocv.headingAllCaps ? 'pass' : 'review',
      reason: ocv.headingAllCaps ? 'GOVERNMENT WARNING heading is in all caps.' : 'Could not confirm the heading is all caps from the label image.' },
    { id: 'continuous-paragraph', label: 'Warning is a continuous paragraph', status: 'pass', reason: 'Warning appears as a single paragraph.' },
    { id: 'legibility', label: 'Warning is legible at label size',
      status: extraction.imageQuality.state === 'ok' ? 'pass' : 'review',
      reason: extraction.imageQuality.state === 'ok' ? 'Image is clear enough to read.' : 'The label image is hard to read.' }
  ]);
  const status = summarizeWarningStatus(subChecks);
  return checkReviewSchema.parse({
    id: 'government-warning', label: 'Government warning', status,
    severity: status === 'fail' ? 'blocker' : status === 'review' ? 'major' : 'note',
    summary: status === 'pass' ? 'Warning text matches the required wording.' : `Warning text partly matches (${(ocv.similarity * 100).toFixed(1)}% match).`,
    details: `Similarity ${(ocv.similarity * 100).toFixed(1)}%, ${ocv.editDistance} character changes from required wording.`,
    confidence: ocv.confidence, citations: [...WARNING_CITATIONS], extractedValue: extractedText,
    warning: { subChecks, required: CANONICAL_GOVERNMENT_WARNING, extracted: extractedText, segments }
  });
}

function buildExactTextSubCheck(input: {
  hasWarningText: boolean;
  exactMatch: boolean;
  textReliable: boolean;
  similarity: number;
}): WarningSubCheck {
  if (!input.hasWarningText) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason:
        'Could not read the warning clearly enough to compare it to the required wording.'
    };
  }

  if (input.exactMatch && input.textReliable) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'pass',
      reason:
        'Warning text matches the required wording.'
    };
  }

  if (input.exactMatch) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason: 'Text matches, but the label image is hard to read. Please confirm.'
    };
  }

  // Fuzzy tiers match the OCV fast-path so both ingestion routes apply the
  // same "OCR noise vs real word substitution" distinction. A 90%+ match
  // is normal Tesseract/VLM noise on small-print warnings — pass. A 65-89%
  // match might be a real but minor wording issue — review. Below 65% is
  // a genuine content divergence — fail.
  if (input.similarity >= 0.9) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'pass',
      reason: `Warning text matches the required wording (${(input.similarity * 100).toFixed(0)}% match). Small differences are typical of reading small print.`
    };
  }
  if (input.similarity >= 0.65) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason: `Warning text mostly matches the required wording (${(input.similarity * 100).toFixed(0)}% match). A human reviewer should confirm.`
    };
  }

  return {
    id: 'exact-text',
    label: 'Warning text matches required wording',
    status: input.textReliable ? 'fail' : 'review',
    reason: input.textReliable
      ? 'Warning wording differs from the required text. See the diff below for exact changes.'
      : 'Warning wording appears to differ, but the label image is hard to read. A human reviewer should confirm.'
  };
}

function buildHeadingSubCheck(input: {
  extractedText: string;
  prefixAllCaps: ReviewVisualSignal;
  prefixBold: ReviewVisualSignal;
  hasWarningText: boolean;
  textReliable: boolean;
}): WarningSubCheck {
  if (!input.hasWarningText) {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'review',
      reason: 'Could not read the heading clearly enough to check its formatting.'
    };
  }

  const prefixText = detectWarningPrefix(input.extractedText);
  const prefixHasExpectedWords =
    prefixText.toUpperCase() === 'GOVERNMENT WARNING' && prefixText.length > 0;
  const prefixIsUppercase = prefixText === prefixText.toUpperCase();
  const allCapsSignal = summarizeVisualSignal(input.prefixAllCaps);
  const boldStatus = summarizeVisualSignal(input.prefixBold);

  if (
    prefixHasExpectedWords &&
    prefixIsUppercase &&
    allCapsSignal !== 'fail' &&
    boldStatus === 'pass' &&
    input.textReliable
  ) {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'pass',
      reason: 'Heading is all caps and bold.'
    };
  }

  if (!prefixHasExpectedWords || !prefixIsUppercase || allCapsSignal === 'fail') {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: input.textReliable ? 'fail' : 'review',
      reason: input.textReliable
        ? 'Heading is not all caps.'
        : 'Could not confirm the heading is all caps because the label image is hard to read.'
    };
  }

  if (boldStatus === 'fail') {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'fail',
      reason: 'The heading does not appear bold.'
    };
  }

  return {
    id: 'uppercase-bold-heading',
    label: 'Warning heading is uppercase and bold',
    status: 'review',
    reason:
      'Heading is all caps, but it is hard to tell whether it is bold in this image.'
  };
}

function buildContinuousParagraphSubCheck(input: {
  signal: ReviewVisualSignal;
  hasWarningText: boolean;
}): WarningSubCheck {
  if (!input.hasWarningText) {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'review',
      reason: 'Could not read the warning clearly enough to check if it reads as one paragraph.'
    };
  }

  const status = summarizeVisualSignal(input.signal);

  if (status === 'pass') {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'pass',
      reason: 'Warning reads as one paragraph.'
    };
  }

  if (status === 'fail') {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'fail',
      reason: 'The warning looks split or broken up on the label.'
    };
  }

  return {
    id: 'continuous-paragraph',
    label: 'Warning is a continuous paragraph',
    status: 'review',
    reason: 'Hard to tell whether the warning reads as one paragraph in this image.'
  };
}

function buildLegibilitySubCheck(input: {
  extraction: ReviewExtraction;
  hasWarningText: boolean;
}): WarningSubCheck {
  const signalStatus = summarizeVisualSignal(
    input.extraction.warningSignals.separateFromOtherContent
  );

  if (!input.hasWarningText) {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'review',
      reason:
        'Could not read the warning clearly enough to check if it is readable and set apart.'
    };
  }

  if (input.extraction.imageQuality.state !== 'ok') {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'review',
      reason: 'The label image is hard to read, so we cannot confirm the warning is legible.'
    };
  }

  if (signalStatus === 'fail') {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'fail',
      reason: 'Warning does not appear separate from surrounding label content.'
    };
  }

  if (signalStatus === 'review') {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'review',
      reason: 'Hard to tell whether the warning stands apart from other content.'
    };
  }

  return {
    id: 'legibility',
    label: 'Warning is legible at label size',
    status: 'pass',
    reason: 'Warning is readable and stands apart from nearby text.'
  };
}

function summarizeWarningStatus(subChecks: WarningSubCheck[]): CheckStatus {
  if (subChecks.some((subCheck) => subCheck.status === 'fail')) {
    return 'fail';
  }

  // If the text match (exact-text) and presence both pass, the warning is
  // substantively correct. Visual formatting sub-checks (bold, paragraph,
  // separation) being uncertain should NOT block approval — they're nice
  // to have but the regulatory substance is the TEXT, not the formatting.
  const textPasses = subChecks.find(sc => sc.id === 'exact-text')?.status === 'pass';
  const presencePasses = subChecks.find(sc => sc.id === 'present')?.status === 'pass';
  if (textPasses && presencePasses) {
    return 'pass';
  }

  if (subChecks.some((subCheck) => subCheck.status === 'review')) {
    return 'review';
  }

  return 'pass';
}

function deriveWarningConfidence(
  extraction: ReviewExtraction,
  ocrCrossCheck?: OcrCrossCheckResult
) {
  const average =
    (extraction.fields.governmentWarning.confidence +
      extraction.imageQuality.score +
      extraction.warningSignals.prefixAllCaps.confidence +
      extraction.warningSignals.prefixBold.confidence +
      extraction.warningSignals.continuousParagraph.confidence +
      extraction.warningSignals.separateFromOtherContent.confidence) /
    6;

  const baseConfidence = Math.max(0, Math.min(1, Number(average.toFixed(2))));

  if (!ocrCrossCheck) {
    return baseConfidence;
  }

  return Math.max(
    0,
    Math.min(1, Number(applyOcrCrossCheckToConfidence(baseConfidence, ocrCrossCheck).toFixed(2)))
  );
}

function buildWarningSummary(input: {
  status: CheckStatus;
  subChecks: WarningSubCheck[];
  hasWarningText: boolean;
  exactMatch: boolean;
}) {
  if (input.status === 'pass') {
    return 'Warning text matches the required wording and formatting.';
  }

  if (input.status === 'fail') {
    if (!input.hasWarningText) {
      return 'Required government warning was not detected on the label.';
    }

    if (!input.exactMatch) {
      const headingFailed = input.subChecks.some(
        (subCheck) =>
          subCheck.id === 'uppercase-bold-heading' && subCheck.status === 'fail'
      );

      return headingFailed
        ? 'The heading and the wording do not match what is required.'
        : 'Warning wording does not match what is required.';
    }

    return 'Warning formatting does not meet the rules.';
  }

  return 'Warning was found, but one or more details still need a human look.';
}

function buildWarningDetails(subChecks: WarningSubCheck[]) {
  const relevant = subChecks.filter((subCheck) => subCheck.status !== 'pass');

  if (relevant.length === 0) {
    return 'Wording, heading, paragraph, and legibility all meet the rules under 27 CFR part 16.';
  }

  return relevant.map((subCheck) => subCheck.reason).join(' ');
}

function isTextReliable(extraction: ReviewExtraction) {
  return (
    extraction.fields.governmentWarning.confidence >=
      WARNING_TEXT_CONFIDENCE_THRESHOLD && extraction.imageQuality.state === 'ok'
  );
}

function summarizeVisualSignal(signal: ReviewVisualSignal) {
  if (signal.confidence < WARNING_VISUAL_CONFIDENCE_THRESHOLD) {
    return 'review' as const;
  }

  if (signal.status === 'yes') {
    return 'pass' as const;
  }

  if (signal.status === 'no') {
    return 'fail' as const;
  }

  return 'review' as const;
}

function detectWarningPrefix(value: string) {
  const match = value.match(/^[A-Za-z ]+(?=[:.])/);
  return match ? match[0].trim() : '';
}

/**
 * Compute 0..1 similarity between two warning strings after applying the
 * same normalization used for display. Uses normalized Levenshtein
 * distance: 1 - edits/max(len). This mirrors the OCV fast-path's
 * similarity computation so both code paths apply the same fuzzy tiers.
 */
function computeWarningSimilarity(extracted: string, canonical: string): number {
  // Case-insensitive comparison: real COLA labels commonly print the entire
  // warning block in ALL CAPS because TTB interprets all-caps as satisfying
  // the "conspicuous" requirement (27 CFR 16.22). Canonical text is mixed
  // case; a case-sensitive Levenshtein against all-caps labels produced
  // false rejects on malt beverages where the body was otherwise correct.
  const a = extracted.trim().toUpperCase();
  const b = canonical.trim().toUpperCase();
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / max);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let previous = new Array<number>(n + 1);
  let current = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) previous[j] = j;
  for (let i = 1; i <= m; i += 1) {
    current[0] = i;
    for (let j = 1; j <= n; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[n];
}
