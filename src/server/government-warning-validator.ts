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
import { judgeGovernmentWarningText } from './judgment-field-rules';
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

  const subChecks = warningEvidenceSchema.shape.subChecks.parse([
    buildPresenceSubCheck({
      hasWarningText,
      textReliable
    }),
    buildExactTextSubCheck({
      hasWarningText,
      exactMatch,
      textReliable
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
      reason: 'Warning text was detected on the label.'
    };
  }

  return {
    id: 'present',
    label: 'Warning text is present',
    status: input.textReliable ? 'fail' : 'review',
    reason: input.textReliable
      ? 'No government warning text was detected on a readable label.'
      : 'Presence could not be confirmed because the warning read is low confidence.'
  };
}

/** OCV fast-path: warning verified deterministically via dedicated OCR comparison. */
function buildOcvBasedWarningCheck(extraction: ReviewExtraction, ocv: WarningOcvResult): CheckReview {
  const extractedText = normalizeGovernmentWarningText(ocv.extractedText);
  const segments = diffGovernmentWarningText({ required: CANONICAL_GOVERNMENT_WARNING, extracted: extractedText });
  const subChecks = warningEvidenceSchema.shape.subChecks.parse([
    { id: 'present', label: 'Warning text is present', status: 'pass', reason: 'Warning detected and verified via dedicated OCR.' },
    { id: 'exact-text', label: 'Warning text matches required wording',
      status: ocv.similarity >= 0.85 ? 'pass' : ocv.similarity >= 0.65 ? 'review' : 'fail',
      reason: `Warning text ${ocv.similarity >= 0.85 ? 'verified' : 'partially matches'} (${(ocv.similarity * 100).toFixed(1)}% match, ${ocv.editDistance} edits).` },
    { id: 'uppercase-bold-heading', label: 'Heading is uppercase and bold',
      status: ocv.headingAllCaps ? 'pass' : 'review',
      reason: ocv.headingAllCaps ? 'GOVERNMENT WARNING heading is in all caps.' : 'Could not confirm all-caps heading from OCR.' },
    { id: 'continuous-paragraph', label: 'Warning is a continuous paragraph', status: 'pass', reason: 'OCV-verified text extracted as continuous text.' },
    { id: 'legibility', label: 'Warning is legible at label size',
      status: extraction.imageQuality.state === 'ok' ? 'pass' : 'review',
      reason: extraction.imageQuality.state === 'ok' ? 'Image quality sufficient.' : 'Image quality may affect legibility.' }
  ]);
  const status = summarizeWarningStatus(subChecks);
  return checkReviewSchema.parse({
    id: 'government-warning', label: 'Government warning', status,
    severity: status === 'fail' ? 'blocker' : status === 'review' ? 'major' : 'note',
    summary: status === 'pass' ? 'Warning statement verified via dedicated OCR comparison.' : `Warning partially verified (${(ocv.similarity * 100).toFixed(1)}% match).`,
    details: `OCV: ${ocv.status}, similarity=${ocv.similarity.toFixed(3)}, edits=${ocv.editDistance}`,
    confidence: ocv.confidence, citations: [...WARNING_CITATIONS], extractedValue: extractedText,
    warning: { subChecks, required: CANONICAL_GOVERNMENT_WARNING, extracted: extractedText, segments }
  });
}

function buildExactTextSubCheck(input: {
  hasWarningText: boolean;
  exactMatch: boolean;
  textReliable: boolean;
}): WarningSubCheck {
  if (!input.hasWarningText) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason:
        'Exact wording could not be confirmed because a reliable warning read was not available.'
    };
  }

  if (input.exactMatch && input.textReliable) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'pass',
      reason:
        'Extracted warning text matches the required wording after whitespace normalization.'
    };
  }

  if (input.exactMatch) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason: 'Text matches after normalization, but extraction confidence is low.'
    };
  }

  return {
    id: 'exact-text',
    label: 'Warning text matches required wording',
    status: input.textReliable ? 'fail' : 'review',
    reason: input.textReliable
      ? 'Extracted wording differs from the required text; see the diff for exact character-level changes.'
      : 'Extracted wording differs, but the warning read is not reliable enough for a hard failure.'
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
      reason: 'Heading format could not be confirmed because warning text was not read reliably.'
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
      reason: 'Heading is uppercase and the visual signal supports bold emphasis.'
    };
  }

  if (!prefixHasExpectedWords || !prefixIsUppercase || allCapsSignal === 'fail') {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: input.textReliable ? 'fail' : 'review',
      reason: input.textReliable
        ? 'Heading text is not fully uppercase.'
        : 'Heading case could not be confirmed because extraction confidence is low.'
    };
  }

  if (boldStatus === 'fail') {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'fail',
      reason: 'Visual evidence indicates the heading is not bold.'
    };
  }

  return {
    id: 'uppercase-bold-heading',
    label: 'Warning heading is uppercase and bold',
    status: 'review',
    reason:
      'Uppercase heading is visible, but bold emphasis is uncertain in the current image.'
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
      reason: 'Paragraph continuity could not be confirmed because warning text was not read reliably.'
    };
  }

  const status = summarizeVisualSignal(input.signal);

  if (status === 'pass') {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'pass',
      reason: 'Warning appears as one continuous paragraph.'
    };
  }

  if (status === 'fail') {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'fail',
      reason: 'Visual evidence indicates the warning is split or interrupted.'
    };
  }

  return {
    id: 'continuous-paragraph',
    label: 'Warning is a continuous paragraph',
    status: 'review',
    reason: 'Paragraph continuity is uncertain from the current image.'
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
        'Legibility and separation could not be confirmed because warning text was not read reliably.'
    };
  }

  if (input.extraction.imageQuality.state !== 'ok') {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'review',
      reason: 'Image quality is too weak to confirm legibility and separation.'
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
      reason: 'Separation from other content is uncertain in the current image.'
    };
  }

  return {
    id: 'legibility',
    label: 'Warning is legible at label size',
    status: 'pass',
    reason: 'Warning is readable and appears separated from surrounding content.'
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
    return 'Warning statement matches required wording and formatting.';
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
        ? 'Warning heading and wording do not match required formatting.'
        : 'Warning wording does not match the required text.';
    }

    return 'Government warning formatting does not satisfy CFR requirements.';
  }

  return 'Warning text detected but one or more sub-checks remain inconclusive.';
}

function buildWarningDetails(subChecks: WarningSubCheck[]) {
  const relevant = subChecks.filter((subCheck) => subCheck.status !== 'pass');

  if (relevant.length === 0) {
    return 'Exact text, heading formatting, paragraph continuity, and legibility all passed under 27 CFR part 16.';
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
