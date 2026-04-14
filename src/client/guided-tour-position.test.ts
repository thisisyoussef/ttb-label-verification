import { describe, expect, it } from 'vitest';

import { resolveCalloutPosition } from './guided-tour-position';

describe('guided tour callout positioning', () => {
  it('keeps a tall callout inside the viewport when the target sits near the bottom edge', () => {
    const position = resolveCalloutPosition(
      {
        top: 520,
        left: 980,
        width: 420,
        height: 48
      },
      {
        calloutHeight: 320,
        viewportWidth: 1440,
        viewportHeight: 800,
        scrollX: 0,
        scrollY: 0
      }
    );

    expect(position.top).toBeGreaterThanOrEqual(16);
    expect(position.top).toBeLessThanOrEqual(464);
    expect(position.left).toBeLessThanOrEqual(1004);
  });

  it('clamps targetless callouts to the safe viewport margins', () => {
    const position = resolveCalloutPosition(null, {
      calloutHeight: 1200,
      viewportWidth: 1024,
      viewportHeight: 768,
      scrollX: 0,
      scrollY: 120
    });

    expect(position.top).toBe(136);
    expect(position.left).toBe(302);
    expect(position.width).toBe(420);
  });
});
