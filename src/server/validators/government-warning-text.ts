const FIRST_WARNING_CLAUSE = 'According to the Surgeon General';
const SECOND_WARNING_CLAUSE = 'Consumption of alcoholic beverages';
const WARNING_HEADING = 'GOVERNMENT WARNING';

export function normalizeGovernmentWarningText(value: string | undefined) {
  return collapseWhitespace(value ?? '');
}

export function normalizeGovernmentWarningForSimilarity(
  value: string | undefined
) {
  return repairGovernmentWarningClauseMarkers(normalizeGovernmentWarningText(value));
}

export function normalizeGovernmentWarningForComparison(
  value: string | undefined
) {
  return normalizeGovernmentWarningForSimilarity(value)
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase();
}

function repairGovernmentWarningClauseMarkers(value: string) {
  if (!value) {
    return value;
  }

  const headingIndex = indexOfIgnoreCase(value, WARNING_HEADING);
  const firstClauseIndex = indexOfIgnoreCase(value, FIRST_WARNING_CLAUSE);
  const secondClauseIndex = indexOfIgnoreCase(value, SECOND_WARNING_CLAUSE);

  if (
    headingIndex < 0 ||
    firstClauseIndex < 0 ||
    secondClauseIndex < 0 ||
    headingIndex > firstClauseIndex ||
    firstClauseIndex >= secondClauseIndex
  ) {
    return value;
  }

  let repaired = ensureMarkerBeforeAnchor(
    value,
    firstClauseIndex,
    '(1)',
    /\(?\s*[1Il]\s*\)?$/i
  );
  const repairedSecondClauseIndex = indexOfIgnoreCase(
    repaired,
    SECOND_WARNING_CLAUSE
  );
  repaired = ensureMarkerBeforeAnchor(
    repaired,
    repairedSecondClauseIndex,
    '(2)',
    /\(?\s*[2Zz]\s*\)?$/i
  );

  return collapseWhitespace(repaired);
}

function ensureMarkerBeforeAnchor(
  text: string,
  anchorIndex: number,
  marker: string,
  markerNoisePattern: RegExp
) {
  if (anchorIndex < 0) {
    return text;
  }

  const beforeAnchor = text.slice(0, anchorIndex).replace(/\s+$/, '');
  const afterAnchor = text.slice(anchorIndex);

  if (beforeAnchor.endsWith(marker)) {
    return collapseWhitespace(`${beforeAnchor} ${afterAnchor}`);
  }

  const withoutMarkerNoise = beforeAnchor
    .replace(markerNoisePattern, '')
    .replace(/\s+$/, '');

  return collapseWhitespace(`${withoutMarkerNoise} ${marker} ${afterAnchor}`);
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function indexOfIgnoreCase(haystack: string, needle: string) {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}
