import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { buildExtractionPayload } from './index.test-helpers';
import {
  runTracedExtractionSurface,
  runTracedReviewSurface,
  runTracedWarningSurface
} from './llm-trace';
import { createNormalizedReviewIntake } from './review-intake';

function buildUploadedLabel() {
  const buffer = Buffer.from([1, 2, 3, 4]);

  return {
    fieldname: 'label',
    originalname: 'trace-label.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.length,
    stream: Readable.from(buffer),
    destination: '',
    filename: '',
    path: '',
    buffer
  };
}

function buildIntake() {
  return createNormalizedReviewIntake({
    file: buildUploadedLabel(),
    fields: {
      hasApplicationData: true,
      fields: {
        beverageTypeHint: 'auto',
        origin: 'domestic',
        brandName: 'Trace Brand',
        fancifulName: undefined,
        classType: 'Vodka',
        alcoholContent: '45% Alc./Vol.',
        netContents: '750 mL',
        applicantAddress: undefined,
        country: undefined,
        formulaId: undefined,
        appellation: undefined,
        vintage: undefined,
        varietals: []
      }
    }
  });
}

describe('LLM trace surfaces', () => {
  it('keeps the integrated review surface on the verification-report contract', async () => {
    const intake = buildIntake();
    const extractor = vi.fn().mockResolvedValue(
      buildExtractionPayload({
        fields: {
          brandName: {
            present: true,
            value: 'Trace Brand',
            confidence: 0.97
          }
        }
      })
    );

    const report = await runTracedReviewSurface({
      surface: '/api/review',
      extractionMode: 'cloud',
      clientTraceId: 'trace-review-surface-001',
      intake,
      extractor,
      reportId: 'trace-report-custom-001'
    });

    expect(extractor).toHaveBeenCalledTimes(1);
    expect(extractor.mock.calls[0]?.[0]).toBe(intake);
    expect(report.id).toBe('trace-report-custom-001');
    expect(report.verdict).toBe('review');
    expect(report.noPersistence).toBe(true);
    expect(report.checks.find((check) => check.id === 'government-warning')?.status).toBe(
      'pass'
    );
  });

  it('keeps the extraction surface on the extraction contract', async () => {
    const intake = buildIntake();
    const extraction = buildExtractionPayload({
      fields: {
        brandName: {
          present: true,
          value: 'Trace Brand',
          confidence: 0.97
        }
      }
    });
    const extractor = vi.fn().mockResolvedValue(extraction);

    const result = await runTracedExtractionSurface({
      surface: '/api/review/extraction',
      extractionMode: 'cloud',
      clientTraceId: 'trace-extraction-surface-001',
      intake,
      extractor
    });

    expect(result.id).toBeTruthy();
    expect(result.noPersistence).toBe(true);
    expect(result.fields.brandName.value).toBe('Trace Brand');
  });

  it('keeps the warning surface on the warning-check contract', async () => {
    const intake = buildIntake();
    const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());

    const warningCheck = await runTracedWarningSurface({
      surface: '/api/review/warning',
      extractionMode: 'cloud',
      clientTraceId: 'trace-warning-surface-001',
      intake,
      extractor
    });

    expect(warningCheck.id).toBe('government-warning');
    expect(warningCheck.status).toBe('pass');
    expect(warningCheck.warning?.subChecks).toHaveLength(5);
  });
});
