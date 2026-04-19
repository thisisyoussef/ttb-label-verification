import { describe, expect, it } from 'vitest';

import type { CheckReview } from '../shared/contracts/review';
import {
  compareFieldValues,
  resolveDynamicReviewPhrase,
  summarizeReviewSeverity
} from './review-report-helpers';

function review(severity: CheckReview['severity']): CheckReview {
  return {
    id: `r-${severity}`,
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
    id: 'p',
    label: 'Pass row',
    status: 'pass',
    severity: 'note',
    summary: '',
    details: '',
    confidence: 1,
    citations: []
  };
}

describe('summarizeReviewSeverity', () => {
  it('returns count=0, maxSeverity=note when no review rows', () => {
    expect(summarizeReviewSeverity([pass(), pass()])).toEqual({
      count: 0,
      maxSeverity: 'note'
    });
  });

  it('counts only review-status rows and tracks the highest severity', () => {
    expect(
      summarizeReviewSeverity([review('note'), review('major'), pass(), review('minor')])
    ).toEqual({
      count: 3,
      maxSeverity: 'major'
    });
  });

  it('escalates to blocker when present', () => {
    expect(
      summarizeReviewSeverity([review('minor'), review('blocker')])
    ).toEqual({ count: 2, maxSeverity: 'blocker' });
  });
});

describe('resolveDynamicReviewPhrase', () => {
  it('returns undefined when nothing needs review', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 0, maxSeverity: 'note' })
    ).toBeUndefined();
  });

  it('renders an "almost good" phrase for a single low-severity review', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 1, maxSeverity: 'note' })
    ).toBe('1 field still needs review.');
    expect(
      resolveDynamicReviewPhrase({ count: 1, maxSeverity: 'minor' })
    ).toBe('1 field still needs review.');
  });

  it('escalates the single-row phrase when severity is major or blocker', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 1, maxSeverity: 'major' })
    ).toBe('1 field needs a closer look.');
    expect(
      resolveDynamicReviewPhrase({ count: 1, maxSeverity: 'blocker' })
    ).toBe('1 field needs a closer look.');
  });

  it('uses count-based phrasing for 2-4 reviews', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 2, maxSeverity: 'minor' })
    ).toBe('2 fields still need review.');
    expect(
      resolveDynamicReviewPhrase({ count: 2, maxSeverity: 'major' })
    ).toBe('2 fields need a closer look.');
    expect(
      resolveDynamicReviewPhrase({ count: 3, maxSeverity: 'minor' })
    ).toBe('3 fields still need review.');
    expect(
      resolveDynamicReviewPhrase({ count: 4, maxSeverity: 'major' })
    ).toBe('4 fields need a closer look.');
  });

  it('adds triage guidance when there are 5+ heavy review rows', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 6, maxSeverity: 'major' })
    ).toBe('6 fields need a closer look — start with the major flags.');
  });

  it('keeps the simple count phrase for 5+ light reviews', () => {
    expect(
      resolveDynamicReviewPhrase({ count: 7, maxSeverity: 'minor' })
    ).toBe('7 fields still need review.');
  });
});

describe('compareFieldValues', () => {
  it('treats case-only differences as a match outside the government warning flow', () => {
    expect(compareFieldValues('45% Alc./Vol.', '45% alc./vol.')).toEqual({
      status: 'match',
      note: 'Values match after case normalization.'
    });
  });

  it('treats cosmetic punctuation and spacing differences as a match', () => {
    expect(compareFieldValues("STONE'S THROW", 'Stone s Throw')).toEqual({
      status: 'match',
      note: 'Values match after cosmetic normalization.'
    });
  });
});
