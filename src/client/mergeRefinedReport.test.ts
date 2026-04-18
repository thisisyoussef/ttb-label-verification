import { describe, expect, it } from 'vitest';

import type {
  CheckReview,
  UIVerificationReport
} from './types';
import { mergeRefinedReport } from './useRefineReview';

function check(overrides: Partial<CheckReview>): CheckReview {
  return {
    id: 'brand-name',
    label: 'Brand name',
    status: 'review',
    severity: 'major',
    summary: '',
    details: '',
    confidence: 0.7,
    citations: [],
    ...overrides
  };
}

function makeReport(checks: CheckReview[]): UIVerificationReport {
  const review = checks.filter((c) => c.status === 'review').length;
  const fail = checks.filter((c) => c.status === 'fail').length;
  const pass = checks.filter((c) => c.status === 'pass').length;
  return {
    id: 'r1',
    mode: 'single-label',
    beverageType: 'distilled-spirits',
    verdict: 'review',
    verdictSecondary: '4 fields need a closer look.',
    standalone: false,
    extractionQuality: { globalConfidence: 0.9, state: 'ok' },
    counts: { pass, review, fail },
    checks,
    crossFieldChecks: [],
    latencyBudgetMs: 4000,
    noPersistence: true,
    summary: 'Some fields need review.'
  };
}

describe('mergeRefinedReport — verdictSecondary recompute', () => {
  it('drops "4 fields..." to "A couple of fields need a closer look." when refine resolves 2 of 4 reviews', () => {
    const base = makeReport([
      check({ id: 'brand-name', status: 'review', severity: 'major' }),
      check({ id: 'class-type', status: 'review', severity: 'major' }),
      check({ id: 'alcohol-content', status: 'review', severity: 'major' }),
      check({ id: 'applicant-address', status: 'review', severity: 'major' })
    ]);
    const refined = makeReport([
      check({ id: 'brand-name', status: 'pass', severity: 'note' }),
      check({ id: 'class-type', status: 'pass', severity: 'note' })
    ]);

    const merged = mergeRefinedReport(base, refined);

    expect(merged.counts).toEqual({ pass: 2, review: 2, fail: 0 });
    expect(merged.verdictSecondary).toBe(
      'A couple of fields need a closer look.'
    );
  });

  it('drops to "One field needs a closer look." when refine resolves 3 of 4', () => {
    const base = makeReport([
      check({ id: 'brand-name', status: 'review', severity: 'major' }),
      check({ id: 'class-type', status: 'review', severity: 'major' }),
      check({ id: 'alcohol-content', status: 'review', severity: 'major' }),
      check({ id: 'applicant-address', status: 'review', severity: 'major' })
    ]);
    const refined = makeReport([
      check({ id: 'brand-name', status: 'pass', severity: 'note' }),
      check({ id: 'class-type', status: 'pass', severity: 'note' }),
      check({ id: 'alcohol-content', status: 'pass', severity: 'note' })
    ]);

    const merged = mergeRefinedReport(base, refined);
    expect(merged.counts.review).toBe(1);
    expect(merged.verdictSecondary).toBe('One field needs a closer look.');
  });

  it('falls back to base.verdictSecondary when all reviews refine away', () => {
    // Dynamic phrase returns undefined for count=0. The merge keeps
    // whatever base.verdictSecondary was so any non-review-specific
    // copy (e.g. "All fields match") is preserved.
    const base = makeReport([
      check({ id: 'brand-name', status: 'review', severity: 'major' })
    ]);
    base.verdictSecondary = 'All fields match the approved record.';
    const refined = makeReport([
      check({ id: 'brand-name', status: 'pass', severity: 'note' })
    ]);

    const merged = mergeRefinedReport(base, refined);
    expect(merged.counts.review).toBe(0);
    expect(merged.verdictSecondary).toBe(
      'All fields match the approved record.'
    );
  });
});
