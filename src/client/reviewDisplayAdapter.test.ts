import { describe, expect, it } from 'vitest';

import {
  resolveDisplayVerdictCopy,
  shouldRecommendRejection
} from './reviewDisplayAdapter';
import type { CheckReview } from './types';

function baseCheck(overrides: Partial<CheckReview>): CheckReview {
  return {
    id: 'brand-name',
    label: 'Brand name',
    status: 'review',
    severity: 'major',
    summary: '',
    details: '',
    confidence: 0.2,
    citations: [],
    ...overrides
  } as CheckReview;
}

describe('resolveDisplayVerdictCopy', () => {
  it('shows approve framing when nothing needs review', () => {
    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 7, review: 0, fail: 0 },
        standalone: false,
        extractionQualityState: 'ok'
      })
    ).toMatchObject({
      verdict: 'approve',
      headline: 'Looks good'
    });
  });

  it('shows review framing when any field still needs review', () => {
    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 6, review: 1, fail: 0 },
        standalone: false,
        extractionQualityState: 'ok'
      })
    ).toMatchObject({
      verdict: 'review',
      headline: '1 field needs review'
    });
  });

  it('keeps standalone results in review framing even when every extracted field passed', () => {
    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 7, review: 0, fail: 0 },
        standalone: true,
        extractionQualityState: 'ok'
      })
    ).toMatchObject({
      verdict: 'review',
      headline: 'Check extracted details'
    });
  });

  it('keeps low-confidence images in review framing even with no flagged rows', () => {
    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 7, review: 0, fail: 0 },
        standalone: false,
        extractionQualityState: 'low-confidence'
      })
    ).toMatchObject({
      verdict: 'review',
      headline: 'Image needs review'
    });
  });

  it('recommends rejection when the image is low-confidence and no critical fields were extracted', () => {
    const checks: CheckReview[] = [
      baseCheck({ id: 'brand-name', extractedValue: '' }),
      baseCheck({ id: 'class-type', extractedValue: '?' }),
      baseCheck({ id: 'alcohol-content', extractedValue: '' }),
      baseCheck({ id: 'government-warning', extractedValue: '' })
    ];

    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 0, review: 4, fail: 0 },
        standalone: false,
        extractionQualityState: 'low-confidence',
        checks
      })
    ).toMatchObject({
      verdict: 'recommend-reject',
      headline: "Doesn't look like a label"
    });
  });

  it('stays in review (never recommends rejection) when any critical field was extracted', () => {
    const checks: CheckReview[] = [
      baseCheck({ id: 'brand-name', extractedValue: "Stone's Throw" }),
      baseCheck({ id: 'class-type', extractedValue: '' }),
      baseCheck({ id: 'alcohol-content', extractedValue: '' }),
      baseCheck({ id: 'government-warning', extractedValue: '' })
    ];

    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 0, review: 4, fail: 0 },
        standalone: false,
        extractionQualityState: 'low-confidence',
        checks
      })
    ).toMatchObject({ verdict: 'review' });
  });

  it('never recommends rejection in standalone mode', () => {
    const checks: CheckReview[] = [
      baseCheck({ id: 'brand-name', extractedValue: '' }),
      baseCheck({ id: 'class-type', extractedValue: '' }),
      baseCheck({ id: 'alcohol-content', extractedValue: '' }),
      baseCheck({ id: 'government-warning', extractedValue: '' })
    ];

    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 0, review: 4, fail: 0 },
        standalone: true,
        extractionQualityState: 'low-confidence',
        checks
      })
    ).toMatchObject({
      verdict: 'review',
      headline: 'Check extracted details'
    });
  });

  it('never recommends rejection when extraction quality is ok', () => {
    const checks: CheckReview[] = [
      baseCheck({ id: 'brand-name', extractedValue: '' }),
      baseCheck({ id: 'class-type', extractedValue: '' }),
      baseCheck({ id: 'alcohol-content', extractedValue: '' }),
      baseCheck({ id: 'government-warning', extractedValue: '' })
    ];

    expect(
      resolveDisplayVerdictCopy({
        counts: { pass: 0, review: 4, fail: 0 },
        standalone: false,
        extractionQualityState: 'ok',
        checks
      })
    ).toMatchObject({ verdict: 'review' });
  });

  it('does not recommend rejection when some checks pass (real label with mismatches)', () => {
    const checks: CheckReview[] = [
      baseCheck({ id: 'brand-name', extractedValue: '' }),
      baseCheck({
        id: 'class-type',
        status: 'pass',
        extractedValue: 'Vodka',
        confidence: 0.9
      }),
      baseCheck({ id: 'alcohol-content', extractedValue: '' }),
      baseCheck({ id: 'government-warning', extractedValue: '' })
    ];

    expect(
      shouldRecommendRejection({
        counts: { pass: 1, review: 3, fail: 0 },
        standalone: false,
        extractionQualityState: 'low-confidence',
        checks
      })
    ).toBe(false);
  });
});
