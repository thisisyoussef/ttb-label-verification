import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { seedVerificationReport } from '../shared/contracts/review-seed';
import { WarningEvidencePanel } from './WarningEvidence';

describe('WarningEvidencePanel', () => {
  it('renders fail-status warning subchecks with review iconography', () => {
    const warningCheck = structuredClone(
      seedVerificationReport.checks.find(
        (check) => check.id === 'government-warning'
      )
    );

    if (!warningCheck?.warning) {
      throw new Error('Seed report is missing government warning evidence.');
    }

    warningCheck.warning.subChecks = warningCheck.warning.subChecks.map((subCheck) =>
      subCheck.id === 'exact-text'
        ? {
            ...subCheck,
            status: 'fail',
            reason:
              'Warning wording differs from the required text. See the diff below for exact changes.'
          }
        : subCheck
    );

    const html = renderToStaticMarkup(
      <WarningEvidencePanel check={warningCheck} />
    );

    expect(html).toContain('schedule');
    expect(html).not.toContain('close');
  });
});
