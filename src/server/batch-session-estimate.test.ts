import { describe, expect, it } from 'vitest';

import { estimateBatchSecondsRemaining } from './batch-session-estimate';

describe('estimateBatchSecondsRemaining', () => {
  it('uses a simple fixed estimate per remaining label', () => {
    expect(estimateBatchSecondsRemaining(0)).toBe(0);
    expect(estimateBatchSecondsRemaining(1)).toBe(5);
    expect(estimateBatchSecondsRemaining(4)).toBe(20);
  });

  it('never returns a negative estimate', () => {
    expect(estimateBatchSecondsRemaining(-3)).toBe(0);
  });
});
