import { describe, expect, it } from 'vitest';

import {
  getSeedVerificationReport,
  healthResponseSchema,
  verificationReportSchema
} from './review';

describe('review contract', () => {
  it('parses the seed verification report', () => {
    const report = verificationReportSchema.parse(getSeedVerificationReport());

    expect(report.noPersistence).toBe(true);
    expect(report.latencyBudgetMs).toBeLessThanOrEqual(5000);
    expect(report.checks).toHaveLength(3);
  });

  it('keeps the government warning out of pass until real validation exists', () => {
    const report = getSeedVerificationReport();
    const warning = report.checks.find((check) => check.id === 'government-warning');

    expect(warning).toBeDefined();
    expect(warning?.status).toBe('review');
    expect(warning?.severity).toBe('blocker');
  });

  it('models the health endpoint as a no-persistence scaffold', () => {
    const payload = healthResponseSchema.parse({
      status: 'ok',
      service: 'ttb-label-verification',
      mode: 'scaffold',
      responsesApi: true,
      store: false,
      timestamp: new Date().toISOString()
    });

    expect(payload.responsesApi).toBe(true);
    expect(payload.store).toBe(false);
  });
});
