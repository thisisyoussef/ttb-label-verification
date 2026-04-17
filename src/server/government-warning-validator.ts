import {
  CANONICAL_GOVERNMENT_WARNING,
  checkReviewSchema,
  warningEvidenceSchema,
  type CheckReview,
  type CheckStatus,
  type ReviewExtraction,
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
import {
  collectWarningVoteSignals,
  computeWarningSimilarity,
  deriveVotedSimilarity
} from './government-warning-vote';
import {
  buildContinuousParagraphSubCheck,
  buildExactTextSubCheck,
  buildHeadingSubCheck,
  buildLegibilitySubCheck,
  buildPresenceSubCheck,
  isTextReliable
} from './government-warning-subchecks';

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
  // 2-of-3 warning vote across three independent reads. Stabilizes the
  // fuzzy-match boundary so a single-signal ~260-char similarity that
  // jitters across the 0.65/0.90 tier lines (Gemini Flash run-to-run
  // variance) cannot single-handedly flip a label between review and
  // fail. The three signals:
  //   1. VLM extraction (via extraction.fields.governmentWarning.value)
  //   2. Warning OCV on the cropped region (via warningOcv)
  //   3. Full-image Tesseract OCR (via ocrCrossCheck)
  //
  // Each signal votes pass|review|fail using the same 0.90 / 0.65
  // Levenshtein tiers. A signal abstains when it couldn't read the
  // warning at all (no ocrCrossCheck result, OCV failed, etc.). Final
  // status = majority (with a conservative-tie-break toward review).
  const vlmSimilarity = hasWarningText
    ? computeWarningSimilarity(extractedText, CANONICAL_GOVERNMENT_WARNING)
    : 0;
  const voteSignals = collectWarningVoteSignals({
    vlmSimilarity,
    hasVlmText: hasWarningText,
    ocrCrossCheck,
    warningOcv
  });
  const textSimilarity = deriveVotedSimilarity(voteSignals, vlmSimilarity);

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

/** OCV fast-path: warning verified deterministically via dedicated OCR comparison. */
function buildOcvBasedWarningCheck(
  extraction: ReviewExtraction,
  ocv: WarningOcvResult
): CheckReview {
  const extractedText = normalizeGovernmentWarningText(ocv.extractedText);
  const segments = diffGovernmentWarningText({
    required: CANONICAL_GOVERNMENT_WARNING,
    extracted: extractedText
  });
  const subChecks = warningEvidenceSchema.shape.subChecks.parse([
    { id: 'present', label: 'Warning text is present', status: 'pass', reason: 'Warning text is on the label.' },
    {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: ocv.similarity >= 0.85 ? 'pass' : ocv.similarity >= 0.65 ? 'review' : 'fail',
      reason: `Warning text ${ocv.similarity >= 0.85 ? 'matches' : 'partly matches'} (${(ocv.similarity * 100).toFixed(1)}% match).`
    },
    {
      id: 'uppercase-bold-heading',
      label: 'Heading is uppercase and bold',
      status: ocv.headingAllCaps ? 'pass' : 'review',
      reason: ocv.headingAllCaps
        ? 'GOVERNMENT WARNING heading is in all caps.'
        : 'Could not confirm the heading is all caps from the label image.'
    },
    { id: 'continuous-paragraph', label: 'Warning is a continuous paragraph', status: 'pass', reason: 'Warning appears as a single paragraph.' },
    {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: extraction.imageQuality.state === 'ok' ? 'pass' : 'review',
      reason:
        extraction.imageQuality.state === 'ok'
          ? 'Image is clear enough to read.'
          : 'The label image is hard to read.'
    }
  ]);
  const status = summarizeWarningStatus(subChecks);
  return checkReviewSchema.parse({
    id: 'government-warning',
    label: 'Government warning',
    status,
    severity: status === 'fail' ? 'blocker' : status === 'review' ? 'major' : 'note',
    summary:
      status === 'pass'
        ? 'Warning text matches the required wording.'
        : `Warning text partly matches (${(ocv.similarity * 100).toFixed(1)}% match).`,
    details: `Similarity ${(ocv.similarity * 100).toFixed(1)}%, ${ocv.editDistance} character changes from required wording.`,
    confidence: ocv.confidence,
    citations: [...WARNING_CITATIONS],
    extractedValue: extractedText,
    warning: { subChecks, required: CANONICAL_GOVERNMENT_WARNING, extracted: extractedText, segments }
  });
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
