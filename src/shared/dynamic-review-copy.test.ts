import { describe, expect, it } from 'vitest';

import type { CheckReview } from './contracts/review';
import {
  resolveDynamicReviewPhrase,
  summarizeReviewSeverity
} from './dynamic-review-copy';

function review(severity: CheckReview['severity']): CheckReview {
  return {
    id: `r-${severity}-${Math.random()}`,
    label: `Review row (${severity})`,
    status: 'review',
    severity,
    summary: '',
    details: '',
    confidence: 0.7,
    citations: []
  };
}

function pass(): CheckReview {
  return {
    id: `p-${Math.random()}`,
    label: 'Pass row',
    status: 'pass',
    severity: 'note',
    summary: '',
    details: '',
    confidence: 1,
    citations: []
  };
}

describe('summarizeReviewSeverity (shared)', () => {
  it('returns count=0 when nothing needs review', () => {
    expect(summarizeReviewSeverity([pass(), pass()])).toEqual({
      count: 0,
      maxSeverity: 'note'
    });
  });

  it('counts only review-status rows and tracks max severity', () => {
    expect(
      summarizeReviewSeverity([review('note'), review('major'), pass(), review('minor')])
    ).toEqual({ count: 3, maxSeverity: 'major' });
  });

  it('escalates to blocker when present', () => {
    expect(summarizeReviewSeverity([review('minor'), review('blocker')])).toEqual({
      count: 2,
      maxSeverity: 'blocker'
    });
  });
});

describe('resolveDynamicReviewPhrase (shared)', () => {
  it('returns undefined when nothing needs review (verdict copy takes over)', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 0, maxSeverity: 'note' })
    ).toBeUndefined();
  });

  it('renders an "almost good" phrase for a single low-severity review', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 1, maxSeverity: 'note' })
    ).toBe('Almost good — one quick check left.');
  });

  it('escalates the single-row phrase when severity is major', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 1, maxSeverity: 'major' })
    ).toBe('One field needs a closer look.');
  });

  it('uses count-based phrasing for 2-4 reviews', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 3, maxSeverity: 'minor' })
    ).toBe('3 quick checks left.');
    expect(
      resolveDynamicReviewPhrase({ count: 4, maxSeverity: 'major' })
    ).toBe('4 fields need a closer look.');
  });

  it('adds triage guidance when there are 5+ heavy review rows', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 6, maxSeverity: 'major' })
    ).toBe('6 fields need a closer look — start with the major flags.');
  });
});

describe('phrase recomputes correctly when reviews drop to zero', () => {
  it('one heavy review → "One field needs a closer look."', () => {
    const phrase = resolveDynamicReviewPhrase(
      summarizeReviewSeverity([review('major'), pass(), pass()])
    );
    expect(phrase).toBe('One field needs a closer look.');
  });

  it('reviews refined away → undefined (caller falls back to verdict copy)', () => {
    const phrase = resolveDynamicReviewPhrase(
      summarizeReviewSeverity([pass(), pass(), pass()])
    );
    expect(phrase).toBeUndefined();
  });

  it('four heavy reviews → "4 fields need a closer look."; refined to one → "One field needs a closer look."', () => {
    const before = resolveDynamicReviewPhrase(
      summarizeReviewSeverity([
        review('major'),
        review('major'),
        review('major'),
        review('major')
      ])
    );
    expect(before).toBe('4 fields need a closer look.');

    const after = resolveDynamicReviewPhrase(
      summarizeReviewSeverity([review('major'), pass(), pass(), pass()])
    );
    expect(after).toBe('One field needs a closer look.');
  });
});
