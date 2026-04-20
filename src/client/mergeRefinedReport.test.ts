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
    noPersistence: true,
    summary: 'Some fields need review.'
  };
}

describe('mergeRefinedReport', () => {
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
    expect(merged.verdictSecondary).toBe('2 fields need a closer look.');
  });

  it('drops to "1 field needs a closer look." when refine resolves 3 of 4', () => {
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
    expect(merged.verdictSecondary).toBe('1 field needs a closer look.');
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

  it('keeps approved rows unchanged when refine tries to downgrade them to review', () => {
    const base = makeReport([
      check({
        id: 'brand-name',
        status: 'pass',
        severity: 'note',
        summary: 'Approved brand matches.',
        details: 'Initial report approved this field.'
      }),
      check({ id: 'class-type', status: 'review', severity: 'major' })
    ]);
    base.verdictSecondary = 'One field needs a closer look.';

    const refined = makeReport([
      check({
        id: 'brand-name',
        status: 'review',
        severity: 'major',
        summary: 'Second pass became uncertain.',
        details: 'Refine should not pull an approved row back into review.'
      })
    ]);

    const merged = mergeRefinedReport(base, refined);
    const brand = merged.checks.find((row) => row.id === 'brand-name');

    expect(brand).toMatchObject({
      status: 'pass',
      summary: 'Approved brand matches.',
      details: 'Initial report approved this field.'
    });
    expect(merged.counts).toEqual({ pass: 1, review: 1, fail: 0 });
    expect(merged.verdictSecondary).toBe('1 field needs a closer look.');
  });

  it('keeps review rows unchanged when refine tries to downgrade them to fail', () => {
    const base = makeReport([
      check({
        id: 'government-warning',
        status: 'review',
        severity: 'major',
        summary: 'Need a closer look.',
        details: 'Initial review was uncertain.'
      })
    ]);

    const refined = makeReport([
      check({
        id: 'government-warning',
        status: 'fail',
        severity: 'blocker',
        summary: 'Second pass failed.',
        details: 'Refine is not allowed to escalate review to fail.'
      })
    ]);

    const merged = mergeRefinedReport(base, refined);

    expect(merged.checks[0]).toMatchObject({
      status: 'review',
      severity: 'major',
      summary: 'Need a closer look.',
      details: 'Initial review was uncertain.'
    });
    expect(merged.counts).toEqual({ pass: 0, review: 1, fail: 0 });
  });

  it('accepts review-to-review swaps when the refine adds more specific evidence', () => {
    const base = makeReport([
      check({
        id: 'applicant-address',
        status: 'review',
        severity: 'major',
        summary: 'Address needs review.',
        details: 'Could not confirm the bottling line.',
        confidence: 0.41
      })
    ]);

    const refined = makeReport([
      check({
        id: 'applicant-address',
        status: 'review',
        severity: 'major',
        summary: 'Address still needs review.',
        details: 'Second pass isolated "Bottled by Trace Distilling, Austin, TX".',
        confidence: 0.67
      })
    ]);

    const merged = mergeRefinedReport(base, refined);

    expect(merged.checks[0]).toMatchObject({
      status: 'review',
      summary: 'Address still needs review.',
      details: 'Second pass isolated "Bottled by Trace Distilling, Austin, TX".',
      confidence: 0.67
    });
    expect(merged.counts).toEqual({ pass: 0, review: 1, fail: 0 });
  });
});
