import { describe, expect, it } from 'vitest';

import { CANONICAL_GOVERNMENT_WARNING } from '../../shared/contracts/review';
import {
  normalizeGovernmentWarningForDisplay,
  normalizeGovernmentWarningForSimilarity,
  normalizeGovernmentWarningText
} from './government-warning-text';

describe('government warning text normalization helpers', () => {
  it('keeps missing clause markers in the extracted warning text', () => {
    expect(
      normalizeGovernmentWarningText(
        'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
      )
    ).toBe(
      'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    );
  });

  it('repairs missing clause markers only inside the similarity seam when both canonical clauses are still present', () => {
    expect(
      normalizeGovernmentWarningForSimilarity(
        'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
      )
    ).toBe(CANONICAL_GOVERNMENT_WARNING);
  });

  it('does not synthesize clause markers inside the similarity seam when the second canonical warning clause is missing', () => {
    expect(
      normalizeGovernmentWarningForSimilarity(
        'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.'
      )
    ).toBe(
        'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.'
    );
  });

  it('trims clear non-warning metadata appended after a complete warning', () => {
    const extracted =
      `${CANONICAL_GOVERNMENT_WARNING} FOURLOKO.COM 851593 @FOURLOKO`;

    expect(normalizeGovernmentWarningForDisplay(extracted)).toBe(
      CANONICAL_GOVERNMENT_WARNING
    );
    expect(normalizeGovernmentWarningForSimilarity(extracted)).toBe(
      CANONICAL_GOVERNMENT_WARNING
    );
  });

  it('keeps sentence-style prose appended after the warning for separate review', () => {
    const extracted =
      `${CANONICAL_GOVERNMENT_WARNING} California Proposition 65 Warning: Drinking distilled spirits may expose you to chemicals known to the State of California to cause cancer.`;

    expect(normalizeGovernmentWarningForDisplay(extracted)).toBe(extracted);
  });
});
