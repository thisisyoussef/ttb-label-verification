import { describe, expect, it } from 'vitest';

import type { CheckReview, LabelImage, UIVerificationReport } from './types';
import { shouldStartRefine } from './useRefineReview';

function check(overrides: Partial<CheckReview> = {}): CheckReview {
  return {
    id: 'brand-name',
    label: 'Brand name',
    status: 'review',
    severity: 'major',
    summary: '',
    details: '',
    confidence: 0.7,
    citations: [],
    ...overrides
  };
}

function makeReport(checks: CheckReview[]): UIVerificationReport {
  const review = checks.filter((item) => item.status === 'review').length;
  const fail = checks.filter((item) => item.status === 'fail').length;
  const pass = checks.filter((item) => item.status === 'pass').length;

  return {
    id: 'report-1',
    mode: 'single-label',
    beverageType: 'distilled-spirits',
    verdict: 'review',
    verdictSecondary: 'One field needs a closer look.',
    standalone: false,
    extractionQuality: { globalConfidence: 0.9, state: 'ok' },
    counts: { pass, review, fail },
    checks,
    crossFieldChecks: [],
    noPersistence: true,
    summary: 'Some fields need review.'
  };
}

function makeImage(overrides: Partial<LabelImage> = {}): LabelImage {
  return {
    file: new File(['label'], 'label.png', { type: 'image/png' }),
    previewUrl: 'data:image/png;base64,AAA=',
    sizeLabel: '1 KB',
    ...overrides
  };
}

describe('shouldStartRefine', () => {
  it('starts only for live reports with review rows', () => {
    expect(
      shouldStartRefine({
        report: makeReport([check()]),
        image: makeImage(),
        useFixtureReport: false,
        startedReportId: null
      })
    ).toBe(true);
  });

  it('blocks fixture, demo-image, duplicate, and no-review cases', () => {
    const reviewReport = makeReport([check()]);

    expect(
      shouldStartRefine({
        report: reviewReport,
        image: makeImage(),
        useFixtureReport: true,
        startedReportId: null
      })
    ).toBe(false);

    expect(
      shouldStartRefine({
        report: reviewReport,
        image: makeImage({ demoScenarioId: 'tour-demo' }),
        useFixtureReport: false,
        startedReportId: null
      })
    ).toBe(false);

    expect(
      shouldStartRefine({
        report: reviewReport,
        image: makeImage(),
        useFixtureReport: false,
        startedReportId: reviewReport.id
      })
    ).toBe(false);

    expect(
      shouldStartRefine({
        report: makeReport([check({ status: 'pass', severity: 'note' })]),
        image: makeImage(),
        useFixtureReport: false,
        startedReportId: null
      })
    ).toBe(false);
  });
});
