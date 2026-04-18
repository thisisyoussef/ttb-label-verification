import { describe, expect, it } from 'vitest';

import { resolveCheckBadge } from './reviewDisplayAdapter';
import type { CheckReview } from './types';

function makeCheck(overrides: Partial<CheckReview> = {}): CheckReview {
  return {
    id: 'brand-name',
    label: 'Brand name',
    status: 'pass',
    severity: 'note',
    summary: '',
    details: '',
    confidence: 0.95,
    citations: [],
    ...overrides
  };
}

describe('resolveCheckBadge', () => {
  it('returns Matches for a normal pass-status comparison', () => {
    expect(
      resolveCheckBadge(
        makeCheck({
          status: 'pass',
          comparison: {
            status: 'match',
            applicationValue: 'Stones Throw',
            extractedValue: 'Stones Throw'
          }
        })
      )
    ).toEqual({ label: 'Matches', icon: 'check_circle' });
  });

  it('returns "Found on label" when application value was not provided', () => {
    expect(
      resolveCheckBadge(
        makeCheck({
          status: 'pass',
          comparison: {
            status: 'not-applicable',
            extractedValue: 'Found Value',
            note: 'No matching value was provided in the application data.'
          }
        })
      )
    ).toEqual({ label: 'Found on label', icon: 'visibility' });
  });

  it('still says Matches when status is pass and there is no comparison object at all', () => {
    expect(
      resolveCheckBadge(makeCheck({ status: 'pass', comparison: undefined }))
    ).toEqual({ label: 'Matches', icon: 'check_circle' });
  });

  it('still says Needs review for a review-status row even with not-applicable comparison', () => {
    expect(
      resolveCheckBadge(
        makeCheck({
          status: 'review',
          severity: 'minor',
          comparison: { status: 'not-applicable', note: 'No app data.' }
        })
      )
    ).toEqual({ label: 'Needs review', icon: 'visibility' });
  });

  it('collapses engine fail to Needs review (display behavior unchanged)', () => {
    expect(
      resolveCheckBadge(
        makeCheck({
          status: 'fail',
          severity: 'major',
          comparison: {
            status: 'value-mismatch',
            applicationValue: 'Vodka',
            extractedValue: 'Stout'
          }
        })
      )
    ).toEqual({ label: 'Needs review', icon: 'visibility' });
  });
});
