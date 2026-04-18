import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  finalizeReviewExtraction,
  normalizeImageQualityAssessment,
  resolveReviewBeverageType
} from './review-extraction';
import type { NormalizedReviewIntake } from './review-intake';

function buildIntake(
  overrides: Partial<NormalizedReviewIntake> = {}
): NormalizedReviewIntake {
  const defaultLabel = {
    originalName: 'label.png',
    mimeType: 'image/png',
    bytes: 4,
    buffer: Buffer.from([1, 2, 3, 4])
  };
  const label = overrides.label ?? defaultLabel;
  const labels = overrides.labels ?? [label];

  return {
    label,
    labels,
    fields: {
      beverageTypeHint: 'auto',
      origin: 'domestic',
      varietals: []
    },
    hasApplicationData: false,
    standalone: true,
    ...overrides
  };
}

describe('review extraction domain helpers', () => {
  it('prefers the application beverage type when the user supplied one', () => {
    const resolution = resolveReviewBeverageType({
      applicationBeverageTypeHint: 'wine',
      extractedClassType: 'Straight Bourbon Whiskey',
      extractedAlcoholContent: '45% Alc./Vol.',
      modelBeverageTypeHint: 'distilled-spirits'
    });

    expect(resolution.beverageType).toBe('wine');
    expect(resolution.source).toBe('application');
  });

  it('infers wine from class or type text before falling back to the model hint', () => {
    const resolution = resolveReviewBeverageType({
      applicationBeverageTypeHint: 'auto',
      extractedClassType: 'Estate Bottled Red Wine',
      modelBeverageTypeHint: 'unknown'
    });

    expect(resolution.beverageType).toBe('wine');
    expect(resolution.source).toBe('class-type');
  });

  it('uses the model hint when class-type inference is unavailable', () => {
    const resolution = resolveReviewBeverageType({
      applicationBeverageTypeHint: 'auto',
      modelBeverageTypeHint: 'malt-beverage'
    });

    expect(resolution.beverageType).toBe('malt-beverage');
    expect(resolution.source).toBe('model-hint');
  });

  it('falls back to distilled spirits when the commodity is still ambiguous but label evidence is present', () => {
    const resolution = resolveReviewBeverageType({
      applicationBeverageTypeHint: 'auto',
      extractedClassType: 'Reserve',
      extractedAlcoholContent: '45% Alc./Vol.',
      extractedGovernmentWarning:
        'GOVERNMENT WARNING: (1) According to the Surgeon General...',
      noTextDetected: false,
      modelBeverageTypeHint: 'unknown'
    });

    expect(resolution.beverageType).toBe('distilled-spirits');
    expect(resolution.source).toBe('strict-fallback');
  });

  it('returns unknown instead of distilled spirits when auto-detect has no trustworthy label evidence', () => {
    const resolution = resolveReviewBeverageType({
      applicationBeverageTypeHint: 'auto',
      extractedClassType: undefined,
      extractedAlcoholContent: undefined,
      extractedGovernmentWarning: undefined,
      noTextDetected: false,
      modelBeverageTypeHint: 'unknown'
    });

    expect(resolution.beverageType).toBe('unknown');
    expect(resolution.source).toBe('strict-fallback');
  });

  it('returns unknown when no readable text was detected and auto-detect has no other signal', () => {
    const extraction = finalizeReviewExtraction({
      intake: buildIntake(),
      model: 'gemini-2.5-flash-lite',
      extracted: {
        fields: {
          brandName: {
            present: false,
            confidence: 0.08
          },
          fancifulName: {
            present: false,
            confidence: 0.08
          },
          classType: {
            present: false,
            confidence: 0.08
          },
          alcoholContent: {
            present: false,
            confidence: 0.08
          },
          netContents: {
            present: false,
            confidence: 0.08
          },
          applicantAddress: {
            present: false,
            confidence: 0.08
          },
          countryOfOrigin: {
            present: false,
            confidence: 0.08
          },
          ageStatement: {
            present: false,
            confidence: 0.08
          },
          sulfiteDeclaration: {
            present: false,
            confidence: 0.08
          },
          appellation: {
            present: false,
            confidence: 0.08
          },
          vintage: {
            present: false,
            confidence: 0.08
          },
          governmentWarning: {
            present: false,
            confidence: 0.08
          },
          varietals: []
        },
        beverageTypeHint: undefined,
        warningSignals: {
          prefixAllCaps: {
            status: 'uncertain',
            confidence: 0.2
          },
          prefixBold: {
            status: 'uncertain',
            confidence: 0.2
          },
          continuousParagraph: {
            status: 'uncertain',
            confidence: 0.2
          },
          separateFromOtherContent: {
            status: 'uncertain',
            confidence: 0.2
          }
        },
        imageQuality: {
          score: 0.05,
          issues: ['No readable text detected in the uploaded image.'],
          noTextDetected: true
        },
        summary: 'No readable label text detected.'
      }
    });

    expect(extraction.beverageType).toBe('unknown');
    expect(extraction.beverageTypeSource).toBe('strict-fallback');
    expect(extraction.imageQuality.state).toBe('no-text-extracted');
  });

  it('marks no-text extractions explicitly instead of hiding them as low confidence', () => {
    const quality = normalizeImageQualityAssessment({
      score: 0.08,
      issues: ['No readable text detected in the uploaded image.'],
      noTextDetected: true
    });

    expect(quality.state).toBe('no-text-extracted');
    expect(quality.score).toBeCloseTo(0.08);
  });

  it('downgrades blurry or glare-heavy images to low-confidence extraction state', () => {
    const quality = normalizeImageQualityAssessment({
      score: 0.42,
      issues: ['Mild blur', 'Bottle glare across small text'],
      noTextDetected: false
    });

    expect(quality.state).toBe('low-confidence');
    expect(quality.issues).toContain('Bottle glare across small text');
  });

  it('treats higher-abv cider as wine when class text is otherwise ambiguous', () => {
    const resolution = resolveReviewBeverageType({
      applicationBeverageTypeHint: 'auto',
      extractedClassType: 'Dry Cider',
      extractedAlcoholContent: '8.5% Alc./Vol.',
      modelBeverageTypeHint: 'unknown'
    });

    expect(resolution.beverageType).toBe('wine');
    expect(resolution.source).toBe('class-type');
  });

  it('leaves clear images in the ok state', () => {
    const quality = normalizeImageQualityAssessment({
      score: 0.88,
      issues: [],
      noTextDetected: false
    });

    expect(quality.state).toBe('ok');
    expect(quality.score).toBeCloseTo(0.88);
  });

  it('clamps image quality scores into the contract range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        (score) => {
          const quality = normalizeImageQualityAssessment({
            score,
            issues: [],
            noTextDetected: false
          });

          expect(quality.score).toBeGreaterThanOrEqual(0);
          expect(quality.score).toBeLessThanOrEqual(1);
        }
      )
    );
  });
});
