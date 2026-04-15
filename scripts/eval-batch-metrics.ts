import type { CheckReview } from '../src/shared/contracts/review';

export type FieldMetric = {
  rowsWithCheck: number;
  extractedValuePresent: number;
  exactOrCosmeticMatch: number;
  valueMismatch: number;
  pass: number;
  review: number;
  fail: number;
};

export type RuleMetric = {
  rowsWithCheck: number;
  pass: number;
  review: number;
  fail: number;
  info: number;
};

export function emptyFieldMetric(): FieldMetric {
  return {
    rowsWithCheck: 0,
    extractedValuePresent: 0,
    exactOrCosmeticMatch: 0,
    valueMismatch: 0,
    pass: 0,
    review: 0,
    fail: 0
  };
}

export function emptyRuleMetric(): RuleMetric {
  return {
    rowsWithCheck: 0,
    pass: 0,
    review: 0,
    fail: 0,
    info: 0
  };
}

export function incrementFieldMetric(metric: FieldMetric, check: CheckReview) {
  metric.rowsWithCheck += 1;
  if (check.extractedValue) {
    metric.extractedValuePresent += 1;
  }
  if (
    check.comparison?.status === 'match' ||
    check.comparison?.status === 'case-mismatch'
  ) {
    metric.exactOrCosmeticMatch += 1;
  }
  if (check.comparison?.status === 'value-mismatch') {
    metric.valueMismatch += 1;
  }
  if (check.status === 'pass') metric.pass += 1;
  if (check.status === 'review') metric.review += 1;
  if (check.status === 'fail') metric.fail += 1;
}

export function incrementRuleMetric(metric: RuleMetric, check: CheckReview) {
  metric.rowsWithCheck += 1;
  metric[check.status] += 1;
}
