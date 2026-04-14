import { describe, expect, it } from 'vitest';

import { buildReportForScenario } from './resultScenarios';
import type { IntakeFields } from './types';
import {
  fixturesEnabled,
  resolveResultReport
} from './review-runtime';

function emptyFields(): IntakeFields {
  return {
    brandName: '',
    fancifulName: '',
    classType: '',
    alcoholContent: '',
    netContents: '',
    applicantAddress: '',
    origin: 'domestic',
    country: '',
    formulaId: '',
    appellation: '',
    vintage: '',
    varietals: []
  };
}

describe('review runtime helpers', () => {
  it('prefers the live server report when fixture mode is off', () => {
    const liveReport = buildReportForScenario('perfect-spirit-label');

    const report = resolveResultReport({
      fields: emptyFields(),
      liveReport,
      scenarioId: 'spirit-warning-errors',
      useFixtureReport: false,
      variantOverride: 'auto'
    });

    expect(report.id).toBe(liveReport.id);
    expect(report.verdict).toBe('approve');
  });

  it('keeps fixture scenarios available when fixture mode is on', () => {
    const liveReport = buildReportForScenario('perfect-spirit-label');

    const report = resolveResultReport({
      fields: {
        ...emptyFields(),
        brandName: 'Ironwood'
      },
      liveReport,
      scenarioId: 'spirit-warning-errors',
      useFixtureReport: true,
      variantOverride: 'auto'
    });

    expect(report.id).toBe('spirit-warning-errors');
    expect(report.verdict).toBe('reject');
  });

  it('falls back to the dedicated standalone report when no application data exists', () => {
    const report = resolveResultReport({
      fields: emptyFields(),
      liveReport: null,
      scenarioId: 'perfect-spirit-label',
      useFixtureReport: false,
      variantOverride: 'auto'
    });

    expect(report.standalone).toBe(true);
    expect(report.crossFieldChecks[0]?.status).toBe('info');
  });

  it('enables fixture controls in dev and honors explicit overrides', () => {
    expect(fixturesEnabled({ isDev: true, override: undefined })).toBe(true);
    expect(fixturesEnabled({ isDev: false, override: undefined })).toBe(false);
    expect(fixturesEnabled({ isDev: false, override: 'true' })).toBe(true);
    expect(fixturesEnabled({ isDev: true, override: 'false' })).toBe(false);
  });
});
