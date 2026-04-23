import {
  CANONICAL_GOVERNMENT_WARNING,
  checkReviewSchema,
  warningEvidenceSchema,
  type CheckReview,
  type CheckStatus,
  type ReviewExtraction,
  type WarningSubCheck
} from '../../shared/contracts/review';
import {
  diffGovernmentWarningText
} from './government-warning-diff';
import {
  normalizeGovernmentWarningForDisplay,
  normalizeGovernmentWarningText
} from './government-warning-text';
import {
  applyOcrCrossCheckToConfidence,
  type OcrCrossCheckResult
} from './warning-ocr-cross-check';
import type { WarningOcvResult } from './warning-region-ocv';
import {
  collectWarningVoteSignals,
  computeWarningSimilarity,
  resolveWarningVote
} from './government-warning-vote';
import {
  buildContinuousParagraphSubCheck,
  buildExactTextSubCheck,
  buildHeadingSubCheck,
  buildLegibilitySubCheck,
  buildPresenceSubCheck,
  isTextReliable
} from './government-warning-subchecks';
import { buildWarningResult } from './government-warning-result';

const WARNING_CITATIONS = [
  '27 CFR 16.21 mandatory warning text',
  '27 CFR 16.22 warning formatting and legibility',
  'TTB health warning statement guidance'
] as const;

export {
  diffGovernmentWarningText,
  normalizeGovernmentWarningForDisplay,
  normalizeGovernmentWarningText
};

export function buildGovernmentWarningCheck(
  extraction: ReviewExtraction,
  ocrCrossCheck?: OcrCrossCheckResult,
  warningOcv?: WarningOcvResult
): CheckReview {
  const extractedField = extraction.fields.governmentWarning;
  // Pick the CLEANEST read across VLM + OCV for display and
  // downstream comparison. Previously we preferred OCV text whenever
  // status was 'partial', which sometimes surfaced junk grabbed
  // from an edge strip on labels where the warning isn't on the
  // edge. When the overall vote landed at 'pass' thanks to other
  // signals, the reviewer saw the junk in "Read from label"
  // (user-reported bug). Fix: score each non-empty read against the
  // canonical, pick the one with higher similarity for display.
  const ocvRaw = warningOcv?.extractedText?.trim() ?? '';
  const vlmRaw = extractedField.value?.trim() ?? '';
  const ocvSim = ocvRaw ? computeWarningSimilarity(
    normalizeGovernmentWarningText(ocvRaw),
    CANONICAL_GOVERNMENT_WARNING
  ) : 0;
  const vlmSim = vlmRaw ? computeWarningSimilarity(
    normalizeGovernmentWarningText(vlmRaw),
    CANONICAL_GOVERNMENT_WARNING
  ) : 0;
  // Display winner: higher similarity wins. Tiebreak to OCV (more
  // trustworthy for exact-text verification).
  const pickedForDisplay = ocvRaw && (ocvSim >= vlmSim || !vlmRaw)
    ? ocvRaw
    : vlmRaw || ocvRaw;
  const extractedText = normalizeGovernmentWarningForDisplay(pickedForDisplay);
  const exactSegments = diffGovernmentWarningText({
    required: CANONICAL_GOVERNMENT_WARNING,
    extracted: extractedText
  });
  const hasLexicalInsertionOrDeletion = exactSegments.some((segment) => {
    if (segment.kind === 'missing') {
      return hasMeaningfulLexicalContent(segment.required);
    }

    if (segment.kind === 'wrong-character' && segment.required.length === 0) {
      return hasMeaningfulLexicalContent(segment.extracted);
    }

    return false;
  });
  // Body capitalization is policed by the dedicated heading sub-check,
  // not by the character-level diff. Treating the diff as a strict match
  // when only body case differs prevents the "minor read differences"
  // banner from firing on labels that are substantively correct.
  const exactWordingMatch =
    extractedText.toUpperCase() === CANONICAL_GOVERNMENT_WARNING.toUpperCase();
  const exactMatch = exactWordingMatch;
  const textReliable =
    isTextReliable(extraction) || warningOcv?.status === 'verified';
  const hasVlmText = extractedField.present && vlmRaw.length > 0;
  const hasWarningText =
    extractedText.length > 0 &&
    (hasVlmText || warningOcv?.status === 'verified' || warningOcv?.status === 'partial');
  // 2-of-3 warning vote across three independent reads. Stabilizes the
  // fuzzy-match boundary so a single-signal ~260-char similarity that
  // jitters across the review/pass lines (Gemini Flash run-to-run
  // variance) cannot single-handedly flip a label between review and
  // fail. The three signals:
  //   1. VLM extraction (via extraction.fields.governmentWarning.value)
  //   2. Warning OCV on the cropped region (via warningOcv)
  //   3. Full-image Tesseract OCR (via ocrCrossCheck)
  //
  // Each signal votes pass|review|fail using the shared warning
  // similarity tiers. A signal abstains when it couldn't read the
  // warning at all (no ocrCrossCheck result, OCV failed, etc.). Final
  // status = majority (with a conservative-tie-break toward review).
  const vlmSimilarity = hasVlmText
    ? computeWarningSimilarity(
        normalizeGovernmentWarningText(vlmRaw),
        CANONICAL_GOVERNMENT_WARNING
      )
    : 0;
  const voteSignals = collectWarningVoteSignals({
    vlmSimilarity,
    hasVlmText,
    ocrCrossCheck,
    warningOcv
  });
  const voteResolution = resolveWarningVote(
    voteSignals,
    hasVlmText ? vlmSimilarity : ocvSim
  );
  const textSimilarity = voteResolution.similarity;

  const subChecks = warningEvidenceSchema.shape.subChecks.parse([
    buildPresenceSubCheck({
      hasWarningText,
      textReliable
    }),
    buildExactTextSubCheck({
      hasWarningText,
      exactWordingMatch,
      textReliable,
      similarity: textSimilarity,
      passConsensus: voteResolution.passConsensus,
      conflictingSignals: voteResolution.conflictingSignals,
      supportingPassSignal:
        voteResolution.passCount > 0 && voteResolution.failCount === 0,
      hasLexicalInsertionOrDeletion
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
  const confidence = deriveWarningConfidence(extraction, ocrCrossCheck);
  const result = buildWarningResult({
    status,
    confidence,
    extractedText,
    segments: exactSegments,
    subChecks,
    exactMatch,
    textSimilarity,
    hasWarningText,
    signalScores: deriveWarningSignalScores({
      voteSignals,
      vlmSimilarity: vlmSim,
      hasVlmText,
      ocrCrossCheck
    })
  });

  return checkReviewSchema.parse({
    id: 'government-warning',
    label: 'Government warning',
    status,
    severity,
    summary: result.label,
    details: result.sublabel,
    confidence,
    citations: [...WARNING_CITATIONS],
    extractedValue: hasWarningText ? extractedText : undefined,
    warning: {
      subChecks,
      required: CANONICAL_GOVERNMENT_WARNING,
      extracted: extractedText,
      segments: exactSegments,
      result
    }
  });
}

function summarizeWarningStatus(subChecks: WarningSubCheck[]): CheckStatus {
  if (subChecks.some((subCheck) => subCheck.status === 'fail')) {
    return 'fail';
  }

  // If the text match (exact-text) and presence both pass, the warning is
  // substantively correct. Residual visual uncertainty should not block
  // approval once the wording is verified; clear visual defects still
  // fail through their own sub-checks.
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

function hasMeaningfulLexicalContent(text: string) {
  const withoutClauseMarkers = text.replace(/\(\s*[12]\s*\)/g, '');
  return /[A-Za-z0-9]/.test(withoutClauseMarkers);
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

function deriveWarningSignalScores(input: {
  voteSignals: ReturnType<typeof collectWarningVoteSignals>;
  vlmSimilarity: number;
  hasVlmText: boolean;
  ocrCrossCheck?: OcrCrossCheckResult;
}) {
  const scoreFor = (source: 'vlm' | 'ocv' | 'ocr-cross-check') =>
    input.voteSignals.find((signal) => signal.source === source)?.similarity ?? null;

  return {
    vlm: input.hasVlmText ? input.vlmSimilarity : null,
    ocrCropped: scoreFor('ocv'),
    ocrFull:
      input.ocrCrossCheck &&
      (input.ocrCrossCheck.status === 'agree' ||
        input.ocrCrossCheck.status === 'disagree')
        ? computeWarningSimilarity(
            normalizeGovernmentWarningText(input.ocrCrossCheck.ocrText),
            CANONICAL_GOVERNMENT_WARNING
          )
        : scoreFor('ocr-cross-check')
  };
}
