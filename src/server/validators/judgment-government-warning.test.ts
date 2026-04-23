import { describe, expect, it } from 'vitest';

import { CANONICAL_GOVERNMENT_WARNING } from '../../shared/contracts/review';
import { judgeGovernmentWarningText } from './judgment-field-rules';

describe('judgeGovernmentWarningText', () => {
  it('approves a complete warning with trailing metadata noise', () => {
    const result = judgeGovernmentWarningText(
      `${CANONICAL_GOVERNMENT_WARNING} FOURLOKO.COM 851593 @FOURLOKO`,
      CANONICAL_GOVERNMENT_WARNING
    );

    expect(result.disposition).toBe('approve');
    expect(result.rule).toBe('warning-exact-match');
  });

  it('still treats sentence-style extra warning prose as allowed extra messaging', () => {
    const result = judgeGovernmentWarningText(
      `${CANONICAL_GOVERNMENT_WARNING} California Proposition 65 Warning: Drinking distilled spirits may expose you to chemicals known to the State of California to cause cancer.`,
      CANONICAL_GOVERNMENT_WARNING
    );

    expect(result.disposition).toBe('approve');
    expect(result.rule).toBe('warning-canonical-plus-extra');
  });
});
