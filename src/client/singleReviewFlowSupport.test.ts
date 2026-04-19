import { describe, expect, it } from 'vitest';

import { resolveVerifyIntent } from './singleReviewFlowSupport';

describe('resolveVerifyIntent', () => {
  it('disables verify when no image is selected', () => {
    expect(
      resolveVerifyIntent({
        hasImage: false
      })
    ).toBe('disabled');
  });

  it('submits even when the quick scan marked the image unlikely', () => {
    expect(
      resolveVerifyIntent({
        hasImage: true
      })
    ).toBe('submit');
  });

  it('submits immediately for likely and uncertain images', () => {
    expect(
      resolveVerifyIntent({
        hasImage: true
      })
    ).toBe('submit');
  });
});
