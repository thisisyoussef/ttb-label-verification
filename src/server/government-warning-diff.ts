import type { DiffSegment, DiffSegmentKind } from '../shared/contracts/review';

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
        costs[row - 1][column - 1] + substitutionCost(requiredToken, extractedToken);
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
