import { describe, expect, it } from 'vitest';

import { evaluateReviewRelevance } from './review-relevance';

describe('evaluateReviewRelevance', () => {
  it('marks a clear alcohol label as likely relevant', () => {
    const result = evaluateReviewRelevance({
      ocrEnabled: true,
      images: [
        {
          status: 'ok',
          text: [
            'STONE RIDGE BOURBON',
            '45% Alc./Vol.',
            '750 mL',
            'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy.'
          ].join('\n')
        }
      ]
    });

    expect(result.decision).toBe('likely-label');
    expect(result.shouldPrefetchExtraction).toBe(true);
    expect(result.detectedBeverage).toBe('distilled-spirits');
    expect(result.signals.hasAlcoholContent).toBe(true);
    expect(result.signals.hasNetContents).toBe(true);
    expect(result.signals.hasGovernmentWarning).toBe(true);
  });

  it('keeps weak single-signal OCR reads in the uncertain bucket', () => {
    const result = evaluateReviewRelevance({
      ocrEnabled: true,
      images: [
        {
          status: 'ok',
          text: 'Net contents 750 mL'
        }
      ]
    });

    expect(result.decision).toBe('uncertain');
    expect(result.shouldPrefetchExtraction).toBe(false);
    expect(result.continueAllowed).toBe(true);
  });

  it('combines front and back image signals before deciding', () => {
    const result = evaluateReviewRelevance({
      ocrEnabled: true,
      images: [
        {
          status: 'ok',
          text: 'STONE RIDGE BOURBON\nSmall Batch Reserve'
        },
        {
          status: 'ok',
          text: [
            '750 mL',
            '45% Alc./Vol.',
            'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy.'
          ].join('\n')
        }
      ]
    });

    expect(result.decision).toBe('likely-label');
    expect(result.shouldPrefetchExtraction).toBe(true);
    expect(result.signals.scannedImageCount).toBe(2);
  });

  it('fast-breaks when quick OCR cannot read any useful text', () => {
    const result = evaluateReviewRelevance({
      ocrEnabled: true,
      images: [
        {
          status: 'failed',
          reason: 'no-text-extracted'
        }
      ]
    });

    expect(result.decision).toBe('unlikely-label');
    expect(result.shouldPrefetchExtraction).toBe(false);
    expect(result.summary).toContain('readable');
  });

  it('falls back to uncertain when OCR is unavailable on the workstation', () => {
    const result = evaluateReviewRelevance({
      ocrEnabled: false,
      images: []
    });

    expect(result.decision).toBe('uncertain');
    expect(result.shouldPrefetchExtraction).toBe(false);
  });
});
