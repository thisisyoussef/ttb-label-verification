import { describe, expect, it } from 'vitest';

import { buildExactTextSubCheck } from './government-warning-subchecks';
import { similarityToVote } from './government-warning-vote';

describe('government warning similarity thresholds', () => {
  it('keeps borderline 0.92 similarities in review instead of auto-passing non-exact wording', () => {
    expect(similarityToVote(0.92)).toBe('review');
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: true,
        similarity: 0.92
      }).status
    ).toBe('review');
  });

  it('fails high-confidence reads below the review band', () => {
    expect(similarityToVote(0.74)).toBe('fail');
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: true,
        similarity: 0.74
      }).status
    ).toBe('fail');
  });

  it('keeps low-confidence sub-threshold reads in review', () => {
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: false,
        similarity: 0.74
      }).status
    ).toBe('review');
  });

  it('still holds 0.93 similarities in review until the wording matches exactly', () => {
    expect(similarityToVote(0.93)).toBe('pass');
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: true,
        similarity: 0.93
      }).status
    ).toBe('review');
  });
});
