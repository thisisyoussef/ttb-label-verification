import { Readable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildExtractionPayload } from '../index.test-helpers';
import {
  runTracedExtractionSurface,
  runTracedReviewSurface,
  runTracedWarningSurface
} from './llm-trace';
import * as ocrPrepass from '../extractors/ocr-prepass';
import { createNormalizedReviewIntake } from '../review/review-intake';

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
    expect(extractor.mock.calls[0]?.[1]).toMatchObject({
      surface: '/api/review',
      extractionMode: 'cloud'
    });
    expect(report.id).toBe('trace-report-custom-001');
    // Weighted verdict: same-field-of-vision (low tier, 0.5) < threshold (2.5) → approve
    expect(report.verdict).toBe('approve');
    expect(report.noPersistence).toBe(true);
    expect(report.checks.find((check) => check.id === 'government-warning')?.status).toBe(
      'pass'
    );
  }, 15000);

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
    expect(extractor.mock.calls[0]?.[1]).toMatchObject({
      surface: '/api/review/extraction',
      extractionMode: 'cloud'
    });
    expect(result.noPersistence).toBe(true);
    expect(result.fields.brandName.value).toBe('Trace Brand');
  });

  describe('OCR fast-exit on blank images', () => {
    const originalOcrPrepassFlag = process.env.OCR_PREPASS;

    beforeEach(() => {
      process.env.OCR_PREPASS = 'enabled';
    });

    afterEach(() => {
      if (originalOcrPrepassFlag === undefined) {
        delete process.env.OCR_PREPASS;
      } else {
        process.env.OCR_PREPASS = originalOcrPrepassFlag;
      }
      vi.restoreAllMocks();
    });

    it('short-circuits the pipeline when OCR extracts no text', async () => {
      vi.spyOn(ocrPrepass, 'runOcrPrepass').mockResolvedValue({
        status: 'failed',
        reason: 'no-text-extracted',
        durationMs: 42
      });

      const intake = buildIntake();
      // Make the extractor take a noticeable amount of time — if the
      // short-circuit is working, we should return well before this
      // resolves. The extractor fires (we don't plumb abort signals)
      // but its result is discarded.
      const extractor = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(buildExtractionPayload()), 5_000)
          )
      );

      const startedAt = performance.now();
      const report = await runTracedReviewSurface({
        surface: '/api/review',
        extractionMode: 'cloud',
        clientTraceId: 'trace-fast-exit-001',
        intake,
        extractor
      });
      const elapsedMs = performance.now() - startedAt;

      expect(elapsedMs).toBeLessThan(1_000);
      expect(report.verdict).toBe('review');
      expect(report.extractionQuality.state).toBe('no-text-extracted');
      expect(report.summary).toMatch(/no text/i);
      expect(report.checks).toHaveLength(0);
    });
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

    expect(extractor.mock.calls[0]?.[1]).toMatchObject({
      surface: '/api/review/warning',
      extractionMode: 'cloud'
    });
    expect(warningCheck.id).toBe('government-warning');
    expect(warningCheck.status).toBe('pass');
    expect(warningCheck.warning?.subChecks).toHaveLength(5);
  });
});
