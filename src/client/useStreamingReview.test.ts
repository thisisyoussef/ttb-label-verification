import { describe, expect, it } from 'vitest';

import type { ReviewStreamFrame } from '../shared/contracts/review';
import { applyFrame, type StreamingReviewState } from './useStreamingReview';

const INITIAL: StreamingReviewState = {
  stage: 'idle',
  requestId: null,
  partialExtraction: {},
  warning: null,
  report: null,
  error: null
};

describe('applyFrame', () => {
  it('records the requestId on the intake frame', () => {
    const next = applyFrame(INITIAL, {
      type: 'intake',
      requestId: 'req-1',
      filename: 'label.webp',
      bytes: 12345,
      mimeType: 'image/webp'
    });

    expect(next.stage).toBe('intake');
    expect(next.requestId).toBe('req-1');
  });

  it('lifts OCR partial fields into partialExtraction and advances to ocr-done', () => {
    const intake = applyFrame(INITIAL, {
      type: 'intake',
      requestId: 'req-1',
      filename: 'label.webp',
      bytes: 1,
      mimeType: 'image/webp'
    });

    const next = applyFrame(intake, {
      type: 'ocr-done',
      requestId: 'req-1',
      ocrText: 'GOVERNMENT WARNING ... 5% Alc./Vol. 12 FL OZ',
      partialFields: {
        alcoholContent: { present: true, value: '5% Alc./Vol.', confidence: 0.95 },
        netContents: { present: true, value: '12 FL OZ', confidence: 0.9 },
        governmentWarning: { present: true, value: 'GOVERNMENT WARNING ...', confidence: 0.85 }
      },
      durationMs: 812
    });

    expect(next.stage).toBe('ocr-done');
    expect(next.partialExtraction.ocrText).toContain('5% Alc./Vol.');
    expect(next.partialExtraction.alcoholContent?.value).toBe('5% Alc./Vol.');
    expect(next.partialExtraction.netContents?.value).toBe('12 FL OZ');
    expect(next.partialExtraction.governmentWarning?.value).toContain('GOVERNMENT');
  });

  it('skips absent OCR fields (regex miss) even if the frame includes them', () => {
    const intake = applyFrame(INITIAL, {
      type: 'intake',
      requestId: 'req-1',
      filename: 'label.webp',
      bytes: 1,
      mimeType: 'image/webp'
    });

    const next = applyFrame(intake, {
      type: 'ocr-done',
      requestId: 'req-1',
      ocrText: '',
      partialFields: {
        alcoholContent: { present: false, confidence: 0.1 }
      },
      durationMs: 500
    });

    expect(next.stage).toBe('ocr-done');
    expect(next.partialExtraction.alcoholContent).toBeUndefined();
  });

  it('accepts a vlm-field frame and folds it into partialExtraction by name', () => {
    const next = applyFrame(INITIAL, {
      type: 'vlm-field',
      requestId: 'req-1',
      fieldName: 'brandName',
      field: { present: true, value: "Stone's Throw", confidence: 0.95 }
    });

    expect(next.partialExtraction.brandName?.value).toBe("Stone's Throw");
  });

  it('lands the full report and flips stage to report-ready', () => {
    const framed: ReviewStreamFrame = {
      type: 'report-ready',
      requestId: 'req-1',
      report: {
        id: 'rpt-1',
        mode: 'single-label',
        standalone: false,
        beverageType: 'distilled-spirits',
        extractionQuality: { globalConfidence: 1, state: 'ok', note: '' },
        counts: { pass: 0, review: 0, fail: 0 },
        checks: [],
        crossFieldChecks: [],
        verdict: 'approve',
        verdictSecondary: '',
        noPersistence: true,
        summary: ''
      }
    };

    const next = applyFrame(INITIAL, framed);
    expect(next.stage).toBe('report-ready');
    expect(next.report?.verdict).toBe('approve');
  });

  it('captures error frames', () => {
    const next = applyFrame(INITIAL, {
      type: 'error',
      requestId: 'req-1',
      message: 'We could not reach the extraction service right now.',
      retryable: true,
      kind: 'network'
    });
    expect(next.stage).toBe('error');
    expect(next.error?.message).toContain('extraction service');
  });
});
