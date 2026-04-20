import { describe, expect, it } from 'vitest';

import { judgeAlcoholContent } from './judgment-field-rules';

describe('judgeAlcoholContent', () => {
  it('rounds displayed mismatch differences to one decimal place', () => {
    const result = judgeAlcoholContent('10.1% Alc./Vol.', '6.5% Alc./Vol.', 'distilled-spirits');

    expect(result.disposition).toBe('reject');
    expect(result.rule).toBe('abv-numeric-mismatch');
    expect(result.note).toContain('3.6%');
    expect(result.note).not.toContain('3.5999999999999996');
  });

  it('keeps borderline rounding-tolerance matches approved', () => {
    const result = judgeAlcoholContent('10.0% Alc./Vol.', '10.5% Alc./Vol.', 'distilled-spirits');

    expect(result.disposition).toBe('approve');
    expect(result.rule).toBe('abv-rounding-tolerance');
  });
});
