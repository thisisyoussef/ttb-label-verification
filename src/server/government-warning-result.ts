import {
  CANONICAL_GOVERNMENT_WARNING,
  warningResultSchema,
  type CheckStatus,
  type DiffSegment,
  type WarningResult,
  type WarningSignalScores,
  type WarningSubCheck
} from '../shared/contracts/review';

type WarningResultInput = {
  status: CheckStatus;
  confidence: number;
  extractedText: string;
  segments: DiffSegment[];
  subChecks: WarningSubCheck[];
  exactMatch: boolean;
  textSimilarity: number;
  hasWarningText: boolean;
  signalScores: WarningSignalScores;
};

export function buildWarningResult(input: WarningResultInput): WarningResult {
  const overall = toWarningOverall(input.status);
  const exactTextStatus = getSubCheckStatus(input.subChecks, 'exact-text');
  const headingStatus = getSubCheckStatus(input.subChecks, 'uppercase-bold-heading');
  const paragraphStatus = getSubCheckStatus(input.subChecks, 'continuous-paragraph');
  const legibilityStatus = getSubCheckStatus(input.subChecks, 'legibility');
  const visualStatuses = [headingStatus, paragraphStatus, legibilityStatus];
  const hasVisualReview = visualStatuses.some((status) => status === 'review');
  const hasVisualFail = visualStatuses.some((status) => status === 'fail');
  const similarityPercent = `${Math.round(input.textSimilarity * 100)}%`;
  const hasExtraText = hasTrailingLabelText(input.extractedText);

  if (!input.hasWarningText) {
    return warningResultSchema.parse({
      overall,
      focus: overall === 'reject' ? 'not-found' : 'text-unclear',
      label:
        overall === 'reject'
          ? 'Warning not found in this image'
          : 'Warning text unclear',
      sublabel:
        overall === 'reject'
          ? 'No warning text was found on the submitted label image. Confirm the warning is present and readable.'
          : 'This image is too hard to read to confirm the warning. Compare the warning against the label before approval.',
      confidence: input.confidence,
      signalScores: input.signalScores,
      extractedText: input.extractedText,
      canonicalDiff: input.segments
    });
  }

  if (hasVisualFail) {
    return warningResultSchema.parse({
      overall,
      focus: 'formatting-check',
      label: 'Warning formatting needs attention',
      sublabel:
        exactTextStatus === 'pass'
          ? 'The warning text appears complete, but the heading or layout does not meet the required presentation. Check the warning styling on the label.'
          : 'The heading format still needs attention, and the warning text should be compared against the required wording before approval.',
      confidence: input.confidence,
      signalScores: input.signalScores,
      extractedText: input.extractedText,
      canonicalDiff: input.segments
    });
  }

  if (overall === 'pass') {
    if (hasExtraText) {
      return warningResultSchema.parse({
        overall,
        focus: 'verified-extra-text',
        label: 'Warning text verified with added label text',
        sublabel:
          'The required federal warning appears complete. Extra label text follows it.',
        confidence: input.confidence,
        signalScores: input.signalScores,
        extractedText: input.extractedText,
        canonicalDiff: input.segments
      });
    }

    if (!input.exactMatch) {
      return warningResultSchema.parse({
        overall,
        focus: 'verified-minor-noise',
        label: 'Warning text verified with minor read differences',
        sublabel:
          'All required warning language appears present. Small highlighted differences do not change the warning meaning.',
        confidence: input.confidence,
        signalScores: input.signalScores,
        extractedText: input.extractedText,
        canonicalDiff: input.segments
      });
    }

    if (hasVisualReview) {
      return warningResultSchema.parse({
        overall,
        focus: 'formatting-check',
        label: 'Warning text verified',
        sublabel:
          'Required warning language is present. Take a quick look at the heading format and readability before final approval.',
        confidence: input.confidence,
        signalScores: input.signalScores,
        extractedText: input.extractedText,
        canonicalDiff: input.segments
      });
    }

    return warningResultSchema.parse({
      overall,
      focus: 'verified',
      label: 'Warning text verified',
      sublabel: 'All required warning language is present.',
      confidence: input.confidence,
      signalScores: input.signalScores,
      extractedText: input.extractedText,
      canonicalDiff: input.segments
    });
  }

  if (exactTextStatus === 'review') {
    if (input.exactMatch || input.textSimilarity === 0) {
      return warningResultSchema.parse({
        overall,
        focus: 'text-unclear',
        label: 'Warning text unclear',
        sublabel:
          'The warning could not be read clearly enough from this image. Compare the warning against the label before approval.',
        confidence: input.confidence,
        signalScores: input.signalScores,
        extractedText: input.extractedText,
        canonicalDiff: input.segments
      });
    }

    return warningResultSchema.parse({
      overall,
      focus: 'partial-match',
      label: 'Warning text partially matches',
      sublabel: `The read text is ${similarityPercent} aligned with the required warning. Review the highlighted differences below.`,
      confidence: input.confidence,
      signalScores: input.signalScores,
      extractedText: input.extractedText,
      canonicalDiff: input.segments
    });
  }

  if (hasVisualReview) {
    return warningResultSchema.parse({
      overall,
      focus: 'formatting-check',
      label: 'Warning formatting needs review',
      sublabel:
        'The warning text appears present, but the heading format or readability still needs a quick visual check.',
      confidence: input.confidence,
      signalScores: input.signalScores,
      extractedText: input.extractedText,
      canonicalDiff: input.segments
    });
  }

  return warningResultSchema.parse({
    overall,
    focus: 'incorrect-text',
    label: 'Warning wording does not match',
    sublabel:
      'The highlighted differences go beyond minor reading noise. Compare the warning against the required text before approval.',
    confidence: input.confidence,
    signalScores: input.signalScores,
    extractedText: input.extractedText,
    canonicalDiff: input.segments
  });
}

function toWarningOverall(status: CheckStatus): WarningResult['overall'] {
  if (status === 'fail') return 'reject';
  if (status === 'review') return 'review';
  return 'pass';
}

function getSubCheckStatus(
  subChecks: WarningSubCheck[],
  id: WarningSubCheck['id']
): WarningSubCheck['status'] | null {
  return subChecks.find((subCheck) => subCheck.id === id)?.status ?? null;
}

function hasTrailingLabelText(extractedText: string) {
  if (!extractedText.startsWith(CANONICAL_GOVERNMENT_WARNING)) {
    return false;
  }

  return extractedText.slice(CANONICAL_GOVERNMENT_WARNING.length).trim().length > 0;
}
