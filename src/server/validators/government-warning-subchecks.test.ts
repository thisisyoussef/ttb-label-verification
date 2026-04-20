import { describe, expect, it } from 'vitest';

import { buildExactTextSubCheck } from './government-warning-subchecks';

describe('buildExactTextSubCheck', () => {
  it('uses review-framed wording when reliable text still appears to differ', () => {
    const subCheck = buildExactTextSubCheck({
      hasWarningText: true,
      exactWordingMatch: false,
      textReliable: true,
      similarity: 0.52,
      passConsensus: false,
      conflictingSignals: false,
      supportingPassSignal: false,
      hasLexicalInsertionOrDeletion: true
    });

    expect(subCheck.status).toBe('fail');
    expect(subCheck.reason).toBe(
      'Warning wording may differ from the required text. Review the diff below before approval.'
    );
  });
});
