import { describe, expect, it } from 'vitest';

import { resolveDisplayVerdictCopy } from './reviewDisplayAdapter';

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
});
