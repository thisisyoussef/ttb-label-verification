import {
  CANONICAL_GOVERNMENT_WARNING,
  checkReviewSchema,
  warningEvidenceSchema,
  type CheckReview,
  type CheckStatus,
  type DiffSegment,
  type DiffSegmentKind,
  type ReviewExtraction,
  type ReviewVisualSignal,
  type WarningSubCheck
} from '../shared/contracts/review';

const WARNING_TEXT_CONFIDENCE_THRESHOLD = 0.8;
const WARNING_VISUAL_CONFIDENCE_THRESHOLD = 0.75;
const WARNING_CITATIONS = [
  '27 CFR 16.21 mandatory warning text',
  '27 CFR 16.22 warning formatting and legibility',
  'TTB health warning statement guidance'
] as const;

type WarningDiffStep = {
  kind: DiffSegmentKind | 'extra';
  required: string;
  extracted: string;
};

type FinalWarningDiffStep = {
  kind: DiffSegmentKind;
  required: string;
  extracted: string;
};

export function normalizeGovernmentWarningText(value: string | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function diffGovernmentWarningText(input: {
  required: string;
  extracted: string;
}): DiffSegment[] {
  const required = normalizeGovernmentWarningText(input.required);
  const extracted = normalizeGovernmentWarningText(input.extracted);

  if (required === extracted) {
    return [
      {
        kind: 'match',
        required,
        extracted
      }
    ];
  }

  const steps = buildWarningDiffSteps(required, extracted);
  const normalizedSteps = mergeWarningDiffSteps(
    mergeSeparatedWrongCaseTokens(
      mergeWarningDiffSteps(
        absorbMatchedWhitespaceIntoMissing(convertExtrasToWrongCharacters(steps))
      )
    )
  );

  return normalizedSteps.map((step) => ({
    kind: step.kind,
    required: step.required,
    extracted: step.extracted
  }));
}

export function buildGovernmentWarningCheck(
  extraction: ReviewExtraction
): CheckReview {
  const extractedField = extraction.fields.governmentWarning;
  const extractedText = normalizeGovernmentWarningText(extractedField.value);
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
    confidence: deriveWarningConfidence(extraction),
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

  if (subChecks.some((subCheck) => subCheck.status === 'review')) {
    return 'review';
  }

  return 'pass';
}

function deriveWarningConfidence(extraction: ReviewExtraction) {
  const average =
    (extraction.fields.governmentWarning.confidence +
      extraction.imageQuality.score +
      extraction.warningSignals.prefixAllCaps.confidence +
      extraction.warningSignals.prefixBold.confidence +
      extraction.warningSignals.continuousParagraph.confidence +
      extraction.warningSignals.separateFromOtherContent.confidence) /
    6;

  return Math.max(0, Math.min(1, Number(average.toFixed(2))));
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

function buildWarningDiffSteps(
  required: string,
  extracted: string
): WarningDiffStep[] {
  const requiredTokens = tokenizeWarningDiffText(required);
  const extractedTokens = tokenizeWarningDiffText(extracted);
  const costs = Array.from({ length: requiredTokens.length + 1 }, () =>
    Array<number>(extractedTokens.length + 1).fill(0)
  );
  const operations = Array.from({ length: requiredTokens.length + 1 }, () =>
    Array<'diag' | 'up' | 'left' | null>(extractedTokens.length + 1).fill(null)
  );

  for (let index = 1; index <= requiredTokens.length; index += 1) {
    costs[index][0] = index;
    operations[index][0] = 'up';
  }

  for (let index = 1; index <= extractedTokens.length; index += 1) {
    costs[0][index] = index;
    operations[0][index] = 'left';
  }

  for (let row = 1; row <= requiredTokens.length; row += 1) {
    for (let column = 1; column <= extractedTokens.length; column += 1) {
      const requiredToken = requiredTokens[row - 1];
      const extractedToken = extractedTokens[column - 1];
      const diagonal =
        costs[row - 1][column - 1] +
        substitutionCost(requiredToken, extractedToken);
      const up = costs[row - 1][column] + 1;
      const left = costs[row][column - 1] + 1;
      const min = Math.min(diagonal, up, left);

      costs[row][column] = min;
      if (min === diagonal) {
        operations[row][column] = 'diag';
      } else if (min === up) {
        operations[row][column] = 'up';
      } else {
        operations[row][column] = 'left';
      }
    }
  }

  const steps: WarningDiffStep[] = [];
  let row = requiredTokens.length;
  let column = extractedTokens.length;

  while (row > 0 || column > 0) {
    const operation = operations[row][column];

    if (operation === 'diag' && row > 0 && column > 0) {
      const requiredToken = requiredTokens[row - 1];
      const extractedToken = extractedTokens[column - 1];
      steps.push({
        kind: classifySubstitution(requiredToken, extractedToken),
        required: requiredToken,
        extracted: extractedToken
      });
      row -= 1;
      column -= 1;
      continue;
    }

    if (operation === 'up' && row > 0) {
      steps.push({
        kind: 'missing',
        required: requiredTokens[row - 1],
        extracted: ''
      });
      row -= 1;
      continue;
    }

    if (column > 0) {
      steps.push({
        kind: 'extra',
        required: '',
        extracted: extractedTokens[column - 1]
      });
      column -= 1;
      continue;
    }

    if (row > 0) {
      steps.push({
        kind: 'missing',
        required: requiredTokens[row - 1],
        extracted: ''
      });
      row -= 1;
    }
  }

  return steps.reverse();
}

function substitutionCost(requiredChar: string, extractedChar: string) {
  if (requiredChar === extractedChar) {
    return 0;
  }

  if (requiredChar.toLowerCase() === extractedChar.toLowerCase()) {
    return 0.25;
  }

  return 1;
}

function classifySubstitution(
  requiredChar: string,
  extractedChar: string
): DiffSegmentKind {
  if (requiredChar === extractedChar) {
    return 'match';
  }

  if (requiredChar.toLowerCase() === extractedChar.toLowerCase()) {
    return 'wrong-case';
  }

  return 'wrong-character';
}

function convertExtrasToWrongCharacters(steps: WarningDiffStep[]): FinalWarningDiffStep[] {
  return steps.map((step) => {
    if (step.kind === 'extra') {
      return {
        kind: 'wrong-character' as const,
        required: '',
        extracted: step.extracted
      };
    }

    return {
      kind: step.kind,
      required: step.required,
      extracted: step.extracted
    };
  });
}

function absorbMatchedWhitespaceIntoMissing(steps: FinalWarningDiffStep[]) {
  const result: FinalWarningDiffStep[] = [];

  for (let index = 0; index < steps.length; index += 1) {
    const current = steps[index];
    const next = steps[index + 1];

    if (
      current.kind === 'missing' &&
      next &&
      next.kind === 'match' &&
      /^\s+$/.test(next.required)
    ) {
      result.push({
        kind: 'missing',
        required: current.required + next.required,
        extracted: current.extracted + next.extracted
      });
      index += 1;
      continue;
    }

    result.push(current);
  }

  return result;
}

function mergeWarningDiffSteps(steps: FinalWarningDiffStep[]) {
  const merged: FinalWarningDiffStep[] = [];

  for (const step of steps) {
    const previous = merged[merged.length - 1];

    if (previous && previous.kind === step.kind) {
      previous.required += step.required;
      previous.extracted += step.extracted;
      continue;
    }

    merged.push({ ...step });
  }

  return merged;
}

function mergeSeparatedWrongCaseTokens(steps: FinalWarningDiffStep[]) {
  const result: FinalWarningDiffStep[] = [];

  for (let index = 0; index < steps.length; index += 1) {
    const current = steps[index];

    if (current.kind !== 'wrong-case') {
      result.push(current);
      continue;
    }

    let required = current.required;
    let extracted = current.extracted;
    let cursor = index;

    while (true) {
      const space = steps[cursor + 1];
      const nextWord = steps[cursor + 2];

      if (
        !space ||
        !nextWord ||
        space.kind !== 'match' ||
        !/^\s+$/.test(space.required) ||
        nextWord.kind !== 'wrong-case'
      ) {
        break;
      }

      required += space.required + nextWord.required;
      extracted += space.extracted + nextWord.extracted;
      cursor += 2;
    }

    result.push({
      kind: 'wrong-case',
      required,
      extracted
    });
    index = cursor;
  }

  return result;
}

function tokenizeWarningDiffText(value: string) {
  return value.match(/\s+|[A-Za-z]+|\d+|[^A-Za-z\d\s]/g) ?? [];
}
