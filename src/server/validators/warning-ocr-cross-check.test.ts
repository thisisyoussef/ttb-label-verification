import { describe, expect, it } from 'vitest';

import { applyOcrCrossCheckToConfidence } from './warning-ocr-cross-check';

describe('applyOcrCrossCheckToConfidence', () => {
  it('boosts confidence when OCR agrees with VLM', () => {
    const result = applyOcrCrossCheckToConfidence(0.90, {
      status: 'agree',
      ocrText: 'GOVERNMENT WARNING...',
      editDistance: 2
    });
    expect(result).toBeCloseTo(0.95, 10);
  });

  it('caps boosted confidence at 1.0', () => {
    const result = applyOcrCrossCheckToConfidence(0.98, {
      status: 'agree',
      ocrText: 'GOVERNMENT WARNING...',
      editDistance: 0
    });
    expect(result).toBe(1.0);
  });

  it('reduces confidence when OCR disagrees with VLM', () => {
    const result = applyOcrCrossCheckToConfidence(0.94, {
      status: 'disagree',
      ocrText: 'Government Warning...',
      editDistance: 10
    });
    // 10 edits * 0.02 = 0.20, but capped at 0.15
    expect(result).toBeCloseTo(0.79, 2);
  });

  it('applies proportional reduction for small disagreements', () => {
    const result = applyOcrCrossCheckToConfidence(0.94, {
      status: 'disagree',
      ocrText: 'GOVERNMENT WARNING...',
      editDistance: 4
    });
    // 4 edits * 0.02 = 0.08
    expect(result).toBeCloseTo(0.86, 2);
  });

  it('does not change confidence when OCR abstains', () => {
    const result = applyOcrCrossCheckToConfidence(0.90, {
      status: 'abstain',
      reason: 'tesseract-unavailable'
    });
    expect(result).toBe(0.90);
  });

  it('does not drop confidence below zero', () => {
    const result = applyOcrCrossCheckToConfidence(0.05, {
      status: 'disagree',
      ocrText: 'garbage',
      editDistance: 15
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  describe('decision boundary behavior', () => {
    // The warning validator uses 0.8 as the reliability threshold.
    // OCR cross-check should be able to push a borderline confidence
    // across that threshold in both directions.

    it('agree can push 0.78 above the 0.8 reliability threshold', () => {
      const result = applyOcrCrossCheckToConfidence(0.78, {
        status: 'agree',
        ocrText: 'GOVERNMENT WARNING...',
        editDistance: 1
      });
      expect(result).toBeCloseTo(0.83, 10);
      expect(result).toBeGreaterThanOrEqual(0.8);
    });

    it('disagree can push 0.85 below the 0.8 reliability threshold', () => {
      const result = applyOcrCrossCheckToConfidence(0.85, {
        status: 'disagree',
        ocrText: 'different text',
        editDistance: 8
      });
      // 8 * 0.02 = 0.16, capped at 0.15
      expect(result).toBeCloseTo(0.70, 2);
      expect(result).toBeLessThan(0.8);
    });
  });
});
