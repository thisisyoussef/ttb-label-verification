import { describe, expect, it } from 'vitest';

import type { CheckReview, ReviewExtraction } from '../../shared/contracts/review';
import { deriveWeightedVerdict } from './judgment-scoring';

function buildExtraction(
  overrides: Partial<ReviewExtraction['imageQuality']> = {}
): ReviewExtraction {
  return {
    imageQuality: {
      score: 0.86,
      state: 'low-confidence',
      issues: ['Side-panel warning text is small.'],
      ...overrides
    }
  } as ReviewExtraction;
}

function buildWarningReview(overrides: Partial<CheckReview> = {}): CheckReview {
  return {
    id: 'government-warning',
    label: 'Government warning',
    status: 'review',
    severity: 'major',
    summary: 'Warning text unclear',
    details: 'Compare the warning against the label before approval.',
    confidence: 0.85,
    extractedValue:
      'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    warning: {
      required:
        'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
      extracted:
        'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
      segments: [],
      result: {
        overall: 'review',
        focus: 'legibility-check',
        label: 'Warning text unclear',
        sublabel: 'Compare the warning against the label before approval.'
      },
      subChecks: [
        {
          id: 'present',
          label: 'Warning text is present',
          status: 'pass',
          reason: 'Warning text is on the label.'
        },
        {
          id: 'exact-text',
          label: 'Warning text matches required wording',
          status: 'review',
          reason: 'Text matches, but the label image is hard to read. Please confirm.'
        },
        {
          id: 'uppercase-bold-heading',
          label: 'Warning heading is uppercase and bold',
          status: 'review',
          reason: 'Heading is all caps, but it is hard to tell whether it is bold in this image.'
        },
        {
          id: 'continuous-paragraph',
          label: 'Warning is a continuous paragraph',
          status: 'pass',
          reason: 'Warning reads as one paragraph.'
        },
        {
          id: 'legibility',
          label: 'Warning is legible at label size',
          status: 'review',
          reason: 'The label image is hard to read, so we cannot confirm the warning is legible.'
        }
      ]
    },
    ...overrides
  } as CheckReview;
}

describe('judgment scoring warning leniency', () => {
  it('approves when low-confidence image quality only leaves a readable warning review', () => {
    const result = deriveWeightedVerdict({
      checks: [buildWarningReview()],
      crossFieldChecks: [],
      standalone: false,
      extraction: buildExtraction()
    });

    expect(result.verdict).toBe('approve');
    expect(result.weightedReviewScore).toBe(0.5);
  });

  it('keeps review when low-confidence image quality also has another substantive review', () => {
    const result = deriveWeightedVerdict({
      checks: [
        buildWarningReview(),
        {
          id: 'alcohol-content',
          label: 'Alcohol content',
          status: 'review',
          severity: 'major',
          summary: 'Alcohol content needs review',
          confidence: 0.82
        } as CheckReview
      ],
      crossFieldChecks: [],
      standalone: false,
      extraction: buildExtraction()
    });

    expect(result.verdict).toBe('review');
    expect(result.reason).toContain('Image quality');
  });

  it('keeps review when the image is too degraded even if the warning text is readable', () => {
    const result = deriveWeightedVerdict({
      checks: [buildWarningReview()],
      crossFieldChecks: [],
      standalone: false,
      extraction: buildExtraction({
        score: 0.42,
        issues: ['Bottle glare across small text.']
      })
    });

    expect(result.verdict).toBe('review');
    expect(result.reason).toContain('Image quality');
  });

  it('keeps review when the warning review still contains a failing sub-check', () => {
    const warning = buildWarningReview();
    const result = deriveWeightedVerdict({
      checks: [
        buildWarningReview({
          warning: {
            ...warning.warning!,
            subChecks: warning.warning!.subChecks.map((subCheck) =>
              subCheck.id === 'continuous-paragraph'
                ? {
                    ...subCheck,
                    status: 'fail',
                    reason: 'The warning looks split or broken up on the label.'
                  }
                : subCheck
            )
          }
        })
      ],
      crossFieldChecks: [],
      standalone: false,
      extraction: buildExtraction()
    });

    expect(result.verdict).toBe('review');
    expect(result.reason).toContain('Image quality');
  });

  it('downweights readable non-failing warning reviews even when image quality is otherwise ok', () => {
    const result = deriveWeightedVerdict({
      checks: [
        buildWarningReview({
          confidence: 0.91
        }),
        {
          id: 'brand-name',
          label: 'Brand name',
          status: 'review',
          severity: 'major',
          summary: 'Brand name needs review',
          confidence: 0.83
        } as CheckReview
      ],
      crossFieldChecks: [],
      standalone: false,
      extraction: buildExtraction({
        score: 0.94,
        state: 'ok',
        issues: []
      })
    });

    expect(result.verdict).toBe('approve');
    expect(result.weightedReviewScore).toBe(1.5);
  });
});
