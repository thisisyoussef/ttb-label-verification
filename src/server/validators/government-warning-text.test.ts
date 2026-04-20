import { describe, expect, it } from 'vitest';

import { CANONICAL_GOVERNMENT_WARNING } from '../../shared/contracts/review';
import { normalizeGovernmentWarningText } from './government-warning-text';

describe('normalizeGovernmentWarningText', () => {
  it('repairs missing clause markers when both canonical warning clauses are still present', () => {
    expect(
      normalizeGovernmentWarningText(
        'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
      )
    ).toBe(CANONICAL_GOVERNMENT_WARNING);
  });

  it('does not synthesize clause markers when the second canonical warning clause is missing', () => {
    expect(
      normalizeGovernmentWarningText(
        'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.'
      )
    ).toBe(
      'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.'
    );
  });
});
