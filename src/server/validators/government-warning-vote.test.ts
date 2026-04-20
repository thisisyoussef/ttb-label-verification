import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { CANONICAL_GOVERNMENT_WARNING } from '../../shared/contracts/review';
import type { WarningOcvResult } from './warning-region-ocv';
import {
  WARNING_PASS_SIMILARITY,
  WARNING_REVIEW_SIMILARITY,
  collectWarningVoteSignals,
  computeWarningSimilarity,
  deriveVotedSimilarity,
  resolveWarningVote,
  similarityToVote,
  type WarningVoteSignal
} from './government-warning-vote';

function signal(overrides: Partial<WarningVoteSignal> = {}): WarningVoteSignal {
  return {
    source: 'vlm',
    vote: 'review',
    similarity: 0.82,
    ...overrides
  };
}

describe('government warning vote similarity helpers', () => {
  it('treats identical warning text as a perfect match regardless of case and surrounding whitespace', () => {
    expect(
      computeWarningSimilarity(
        `  ${CANONICAL_GOVERNMENT_WARNING.toLowerCase()}  `,
        CANONICAL_GOVERNMENT_WARNING
      )
    ).toBe(1);

    expect(
      computeWarningSimilarity(
        CANONICAL_GOVERNMENT_WARNING,
        `  ${CANONICAL_GOVERNMENT_WARNING.toLowerCase()}  `
      )
    ).toBe(1);
  });

  it('returns a known normalized distance for substitutions, insertions, and empty sides', () => {
    expect(computeWarningSimilarity('ABCD', 'ABCE')).toBeCloseTo(0.75, 6);
    expect(computeWarningSimilarity('ABCD', 'ABC')).toBeCloseTo(0.75, 6);
    expect(computeWarningSimilarity('', 'ABCD')).toBe(0);
    expect(computeWarningSimilarity('ABCD', '')).toBe(0);
    expect(computeWarningSimilarity('', '')).toBe(1);
    expect(computeWarningSimilarity('kitten', 'sitting')).toBeCloseTo(1 - 3 / 7, 6);
  });

  it('is symmetric and always stays inside the closed 0..1 range', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (left, right) => {
        const forward = computeWarningSimilarity(left, right);
        const reverse = computeWarningSimilarity(right, left);

        expect(forward).toBeGreaterThanOrEqual(0);
        expect(forward).toBeLessThanOrEqual(1);
        expect(reverse).toBeGreaterThanOrEqual(0);
        expect(reverse).toBeLessThanOrEqual(1);
        expect(forward).toBeCloseTo(reverse, 10);
      })
    );
  });

  it('keeps the pass and review thresholds on the intended sides of the boundary', () => {
    expect(similarityToVote(WARNING_PASS_SIMILARITY)).toBe('pass');
    expect(similarityToVote(WARNING_PASS_SIMILARITY - 0.001)).toBe('review');
    expect(similarityToVote(WARNING_REVIEW_SIMILARITY)).toBe('review');
    expect(similarityToVote(WARNING_REVIEW_SIMILARITY - 0.001)).toBe('fail');
  });
});

describe('government warning vote signal collection', () => {
  it('abstains when the VLM did not produce warning text', () => {
    expect(
      collectWarningVoteSignals({
        hasVlmText: false,
        vlmSimilarity: 0.99
      })
    ).toEqual([{ source: 'vlm', vote: 'abstain', similarity: 0 }]);
  });

  it('maps cropped-region OCV and full-image OCR signals into vote signals', () => {
    expect(
      collectWarningVoteSignals({
        hasVlmText: true,
        vlmSimilarity: 0.95,
        warningOcv: {
          status: 'verified',
          similarity: 0.74,
          extractedText: 'truncated',
          editDistance: 5,
          headingAllCaps: true,
          confidence: 0.9,
          durationMs: 12
        },
        ocrCrossCheck: {
          status: 'disagree',
          ocrText: 'completely different',
          editDistance: 8
        }
      })
    ).toEqual([
      { source: 'vlm', vote: 'pass', similarity: 0.95 },
      { source: 'ocv', vote: 'fail', similarity: 0.74 },
      { source: 'ocr-cross-check', vote: 'review', similarity: 0 }
    ]);
  });

  it('computes OCV similarity from extracted text when the region verifier omitted the numeric similarity', () => {
    const warningOcvWithoutSimilarity = {
      status: 'partial',
      extractedText: CANONICAL_GOVERNMENT_WARNING,
      editDistance: 0,
      headingAllCaps: true,
      confidence: 0.86,
      durationMs: 20
    } as unknown as WarningOcvResult;

    const [_, ocvSignal] = collectWarningVoteSignals({
      hasVlmText: true,
      vlmSimilarity: 0.91,
      warningOcv: warningOcvWithoutSimilarity
    });

    expect(ocvSignal).toEqual({
      source: 'ocv',
      vote: 'pass',
      similarity: 1
    });
  });

  it('treats missing OCV extracted text as a hard fail when numeric similarity is absent', () => {
    const warningOcvWithoutText = {
      status: 'partial',
      editDistance: 999,
      headingAllCaps: false,
      confidence: 0.2,
      durationMs: 5
    } as unknown as WarningOcvResult;

    const [_, ocvSignal] = collectWarningVoteSignals({
      hasVlmText: true,
      vlmSimilarity: 0.91,
      warningOcv: warningOcvWithoutText
    });

    expect(ocvSignal).toEqual({
      source: 'ocv',
      vote: 'fail',
      similarity: 0
    });
  });

  it('abstains OCR signals that cannot support the vote', () => {
    expect(
      collectWarningVoteSignals({
        hasVlmText: false,
        vlmSimilarity: 0.95,
        warningOcv: {
          status: 'not-found',
          similarity: 0,
          extractedText: '',
          editDistance: 999,
          headingAllCaps: false,
          durationMs: 15,
          confidence: 0.72
        },
        ocrCrossCheck: {
          status: 'agree',
          ocrText: CANONICAL_GOVERNMENT_WARNING,
          editDistance: 1
        }
      })
    ).toEqual([
      { source: 'vlm', vote: 'abstain', similarity: 0 },
      { source: 'ocv', vote: 'abstain', similarity: 0 },
      { source: 'ocr-cross-check', vote: 'abstain', similarity: 0 }
    ]);
  });

  it('maps OCR agreement to the VLM vote when warning text exists', () => {
    expect(
      collectWarningVoteSignals({
        hasVlmText: true,
        vlmSimilarity: 0.96,
        ocrCrossCheck: {
          status: 'agree',
          ocrText: CANONICAL_GOVERNMENT_WARNING,
          editDistance: 0
        }
      })
    ).toEqual([
      { source: 'vlm', vote: 'pass', similarity: 0.96 },
      { source: 'ocr-cross-check', vote: 'pass', similarity: 0.96 }
    ]);
  });

  it('preserves explicit OCR abstentions instead of coercing them into review', () => {
    expect(
      collectWarningVoteSignals({
        hasVlmText: true,
        vlmSimilarity: 0.96,
        ocrCrossCheck: {
          status: 'abstain',
          reason: 'ocr-too-noisy'
        }
      })
    ).toEqual([
      { source: 'vlm', vote: 'pass', similarity: 0.96 },
      { source: 'ocr-cross-check', vote: 'abstain', similarity: 0 }
    ]);
  });
});

describe('government warning vote resolution', () => {
  it('falls back to pass when every signal abstains and the fallback lands in the pass band', () => {
    expect(resolveWarningVote([], 0.94)).toEqual({
      vote: 'pass',
      similarity: 0.94,
      activeSignals: 0,
      passCount: 1,
      reviewCount: 0,
      failCount: 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('falls back to review when every explicit signal abstains', () => {
    expect(
      resolveWarningVote(
        [
          signal({ source: 'vlm', vote: 'abstain', similarity: 0 }),
          signal({ source: 'ocv', vote: 'abstain', similarity: 0 }),
          signal({ source: 'ocr-cross-check', vote: 'abstain', similarity: 0 })
        ],
        0.82
      )
    ).toEqual({
      vote: 'review',
      similarity: 0.82,
      activeSignals: 0,
      passCount: 0,
      reviewCount: 1,
      failCount: 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('falls back to fail when every explicit signal abstains', () => {
    expect(
      resolveWarningVote(
        [
          signal({ source: 'vlm', vote: 'abstain', similarity: 0 }),
          signal({ source: 'ocv', vote: 'abstain', similarity: 0 })
        ],
        0.42
      )
    ).toEqual({
      vote: 'fail',
      similarity: 0.42,
      activeSignals: 0,
      passCount: 0,
      reviewCount: 0,
      failCount: 1,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('preserves an explicit zero similarity for a single active fail signal', () => {
    expect(
      resolveWarningVote([signal({ vote: 'fail', similarity: 0 })], 0.84)
    ).toEqual({
      vote: 'fail',
      similarity: 0,
      activeSignals: 1,
      passCount: 0,
      reviewCount: 0,
      failCount: 1,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('ignores abstaining neighbors when only one pass signal is active', () => {
    expect(
      resolveWarningVote(
        [
          signal({ source: 'vlm', vote: 'abstain', similarity: 0 }),
          signal({ source: 'ocv', vote: 'pass', similarity: 0.97 }),
          signal({ source: 'ocr-cross-check', vote: 'abstain', similarity: 0 })
        ],
        0.2
      )
    ).toEqual({
      vote: 'pass',
      similarity: 0.97,
      activeSignals: 1,
      passCount: 1,
      reviewCount: 0,
      failCount: 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('preserves a single active review signal', () => {
    expect(
      resolveWarningVote([signal({ vote: 'review', similarity: 0.81 })], 0.2)
    ).toEqual({
      vote: 'review',
      similarity: 0.81,
      activeSignals: 1,
      passCount: 0,
      reviewCount: 1,
      failCount: 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('returns the mean of the pass signals when pass consensus is reached without treating pass+review as conflicting', () => {
    expect(
      resolveWarningVote(
        [
          signal({ source: 'vlm', vote: 'pass', similarity: 0.99 }),
          signal({ source: 'ocv', vote: 'pass', similarity: 0.95 }),
          signal({ source: 'ocr-cross-check', vote: 'review', similarity: 0.81 })
        ],
        0.4
      )
    ).toEqual({
      vote: 'pass',
      similarity: 0.97,
      activeSignals: 3,
      passCount: 2,
      reviewCount: 1,
      failCount: 0,
      passConsensus: true,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('returns the mean of the fail signals when fail consensus is reached', () => {
    const resolution = resolveWarningVote(
      [
        signal({ source: 'vlm', vote: 'fail', similarity: 0.2 }),
        signal({ source: 'ocv', vote: 'fail', similarity: 0.4 }),
        signal({ source: 'ocr-cross-check', vote: 'pass', similarity: 0.98 })
      ],
      0.9
    );

    expect(resolution).toMatchObject({
      vote: 'fail',
      activeSignals: 3,
      passCount: 1,
      reviewCount: 0,
      failCount: 2,
      passConsensus: false,
      failConsensus: true,
      conflictingSignals: true
    });
    expect(resolution.similarity).toBeCloseTo(0.3, 12);
  });

  it('does not mark all-review votes as conflicting', () => {
    const resolution = resolveWarningVote(
      [
        signal({ source: 'vlm', vote: 'review', similarity: 0.86 }),
        signal({ source: 'ocv', vote: 'review', similarity: 0.8 })
      ],
      0.1
    );

    expect(resolution).toMatchObject({
      vote: 'review',
      activeSignals: 2,
      passCount: 0,
      reviewCount: 2,
      failCount: 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
    expect(resolution.similarity).toBeCloseTo(0.83, 12);
  });

  it('uses the two-signal mean for unresolved pass+review votes without marking them as true conflicts', () => {
    expect(
      resolveWarningVote(
        [
          signal({ source: 'vlm', vote: 'pass', similarity: 0.97 }),
          signal({ source: 'ocv', vote: 'review', similarity: 0.77 })
        ],
        0.1
      )
    ).toEqual({
      vote: 'review',
      similarity: 0.87,
      activeSignals: 2,
      passCount: 1,
      reviewCount: 1,
      failCount: 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    });
  });

  it('marks direct pass-vs-fail disagreement as conflicting', () => {
    const resolution = resolveWarningVote(
      [
        signal({ source: 'vlm', vote: 'pass', similarity: 0.97 }),
        signal({ source: 'ocv', vote: 'fail', similarity: 0.42 })
      ],
      0.1
    );

    expect(resolution).toMatchObject({
      vote: 'review',
      activeSignals: 2,
      passCount: 1,
      reviewCount: 0,
      failCount: 1,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: true
    });
    expect(resolution.similarity).toBeCloseTo(0.695, 12);
  });

  it('sorts similarities before taking the unresolved three-signal median', () => {
    expect(
      resolveWarningVote(
        [
          signal({ source: 'vlm', vote: 'fail', similarity: 0.32 }),
          signal({ source: 'ocv', vote: 'pass', similarity: 0.96 }),
          signal({ source: 'ocr-cross-check', vote: 'review', similarity: 0.78 })
        ],
        0.1
      )
    ).toEqual({
      vote: 'review',
      similarity: 0.78,
      activeSignals: 3,
      passCount: 1,
      reviewCount: 1,
      failCount: 1,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: true
    });
  });

  it('derives the same similarity that the full resolution reports', () => {
    const signals = [
      signal({ source: 'vlm', vote: 'review', similarity: 0.82 }),
      signal({ source: 'ocv', vote: 'review', similarity: 0.76 }),
      signal({ source: 'ocr-cross-check', vote: 'pass', similarity: 0.99 })
    ];

    expect(deriveVotedSimilarity(signals, 0.25)).toBe(
      resolveWarningVote(signals, 0.25).similarity
    );
  });
});
