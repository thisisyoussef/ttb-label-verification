import { describe, expect, it } from 'vitest';

import {
  countBatchNeedsReview,
  resolveBatchStatusDisplay
} from './batchStatusDisplay';

describe('resolveBatchStatusDisplay', () => {
  it('keeps pass and error distinct', () => {
    expect(resolveBatchStatusDisplay('pass')).toMatchObject({
      label: 'Pass',
      icon: 'check_circle'
    });
    expect(resolveBatchStatusDisplay('error')).toMatchObject({
      label: 'Error',
      icon: 'error'
    });
  });

  it('collapses review and fail into the same needs-review surface', () => {
    expect(resolveBatchStatusDisplay('review')).toMatchObject({
      label: 'Needs review',
      icon: 'visibility'
    });
    expect(resolveBatchStatusDisplay('fail')).toMatchObject({
      label: 'Needs review',
      icon: 'visibility'
    });
  });
});

describe('countBatchNeedsReview', () => {
  it('adds review and fail counts into one reviewer-facing bucket', () => {
    expect(countBatchNeedsReview({ review: 2, fail: 3 })).toBe(5);
  });
});
