import { describe, expect, it } from 'vitest';

import type { FieldAnchor } from './anchor-field-track';
import { maybeUpgradeCheckWithAnchor } from '../review/review-report-anchor-upgrade';
import type { CheckReview } from '../../shared/contracts/review';

function review(overrides: Partial<CheckReview> = {}): CheckReview {
  return {
    id: 'alcohol-content',
    label: 'Alcohol content',
    status: 'review',
    severity: 'major',
    summary: 'Could not read alcohol content from the label.',
    details:
      'The approved record shows a value, but we could not read it clearly on the label.',
    confidence: 0.4,
    citations: [],
    applicationValue: '47.5% Alc./Vol.',
    comparison: {
      status: 'value-mismatch',
      applicationValue: '47.5% Alc./Vol.',
      note: 'Could not read this field from the label.'
    },
    ...overrides
  };
}

function anchor(overrides: Partial<FieldAnchor> = {}): FieldAnchor {
  return {
    field: 'abv',
    expected: '47.5% Alc./Vol.',
    tokens: ['47.5', 'alc', 'vol'],
    tokensFound: 3,
    coverage: 1,
    status: 'found',
    matchKind: 'literal',
    ...overrides
  };
}

describe('maybeUpgradeCheckWithAnchor — evidence reconciliation', () => {
  it('does nothing when there is no anchor', () => {
    const before = review();
    const after = maybeUpgradeCheckWithAnchor(before, null);
    expect(after).toBe(before);
  });

  it('does not upgrade pass / fail / info checks', () => {
    const passed = review({ status: 'pass' });
    const after = maybeUpgradeCheckWithAnchor(passed, anchor());
    expect(after).toBe(passed);
  });

  it('upgrades a review row to pass and rewrites the comparison so the evidence panel does not contradict the badge', () => {
    const before = review();
    const after = maybeUpgradeCheckWithAnchor(before, anchor());

    expect(after.status).toBe('pass');
    expect(after.severity).toBe('note');
    expect(after.summary).toBe('Label matches the approved record.');
    // Critical fix: the previous behavior left extractedValue empty
    // and the comparison saying "Could not read this field" — so the
    // expanded evidence panel showed "Read from label: Not visible
    // on the label" right under a green "Matches" badge.
    expect(after.extractedValue).toBe('47.5% Alc./Vol.');
    expect(after.comparison?.status).toBe('match');
    expect(after.comparison?.applicationValue).toBe('47.5% Alc./Vol.');
    expect(after.comparison?.extractedValue).toBe('47.5% Alc./Vol.');
  });

  it('uses the equivalence hint in the comparison note when the anchor matched via taxonomy', () => {
    const before = review({
      id: 'country-of-origin',
      label: 'Country of origin',
      applicationValue: 'Germany'
    });
    const after = maybeUpgradeCheckWithAnchor(
      before,
      anchor({
        field: 'country',
        expected: 'Germany',
        matchKind: 'equivalent'
      })
    );

    expect(after.status).toBe('pass');
    expect(after.comparison?.note).toContain('recognized equivalent');
    expect(after.extractedValue).toBe('Germany');
  });

  it('preserves the original comparison when there is no value to plug in', () => {
    // Synthetic edge case: review row with no application value AND
    // anchor with empty expected. The upgrade still flips the status
    // but leaves the comparison alone since rewriting it without a
    // value would lose information.
    const before = review({
      applicationValue: undefined,
      comparison: {
        status: 'value-mismatch',
        note: 'No data to compare.'
      }
    });
    const after = maybeUpgradeCheckWithAnchor(
      before,
      anchor({ expected: '' })
    );
    expect(after.status).toBe('pass');
    expect(after.comparison).toEqual(before.comparison);
  });
});
