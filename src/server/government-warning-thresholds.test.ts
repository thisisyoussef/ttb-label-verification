import { describe, expect, it } from 'vitest';

import {
  buildExactTextSubCheck,
  buildHeadingSubCheck
} from './government-warning-subchecks';
import { similarityToVote } from './government-warning-vote';

describe('government warning similarity thresholds', () => {
  it('keeps borderline 0.92 similarities in review instead of auto-passing a single noisy read', () => {
    expect(similarityToVote(0.92)).toBe('review');
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: true,
        similarity: 0.92,
        passConsensus: false,
        conflictingSignals: false
      }).status
    ).toBe('review');
  });

  it('passes when two independent reads land in the pass band despite minor read noise', () => {
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: true,
        similarity: 0.964,
        passConsensus: true,
        conflictingSignals: false
      }).status
    ).toBe('pass');
  });

  it('keeps conflicting pass-vs-fail reads in review instead of converting them into a hard fail', () => {
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: true,
        similarity: 0.708,
        passConsensus: false,
        conflictingSignals: true
      }).status
    ).toBe('review');
  });

  it('fails high-confidence reads below the review band when there is no supporting signal', () => {
    expect(similarityToVote(0.74)).toBe('fail');
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: true,
        similarity: 0.74,
        passConsensus: false,
        conflictingSignals: false
      }).status
    ).toBe('fail');
  });

  it('keeps low-confidence sub-threshold reads in review', () => {
    expect(
      buildExactTextSubCheck({
        hasWarningText: true,
        exactWordingMatch: false,
        textReliable: false,
        similarity: 0.74,
        passConsensus: false,
        conflictingSignals: false
      }).status
    ).toBe('review');
  });
});

describe('government warning heading-bold thresholds', () => {
  it('fails when the visual all-caps signal clearly says the heading is not uppercase', () => {
    expect(
      buildHeadingSubCheck({
        extractedText: 'Government Warning: According to the Surgeon General, ...',
        prefixAllCaps: {
          status: 'no',
          confidence: 0.96
        },
        prefixBold: {
          status: 'yes',
          confidence: 0.95
        },
        hasWarningText: true,
        textReliable: true
      }).status
    ).toBe('fail');
  });

  it('keeps bold-only misses on unclear warnings in review', () => {
    expect(
      buildHeadingSubCheck({
        extractedText: 'GOVERNMENT WARNING: According to the Surgeon General, ...',
        prefixAllCaps: {
          status: 'yes',
          confidence: 0.96
        },
        prefixBold: {
          status: 'no',
          confidence: 0.92
        },
        hasWarningText: true,
        textReliable: false
      }).status
    ).toBe('review');
  });

  it('keeps even a clearly readable non-bold call in review until a stronger bold detector exists', () => {
    expect(
      buildHeadingSubCheck({
        extractedText: 'GOVERNMENT WARNING: According to the Surgeon General, ...',
        prefixAllCaps: {
          status: 'yes',
          confidence: 0.96
        },
        prefixBold: {
          status: 'no',
          confidence: 0.94
        },
        hasWarningText: true,
        textReliable: true
      }).status
    ).toBe('review');
  });
});
