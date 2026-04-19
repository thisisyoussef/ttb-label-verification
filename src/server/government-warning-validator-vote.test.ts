import { describe, expect, it } from 'vitest';

import {
  CANONICAL_GOVERNMENT_WARNING,
  reviewExtractionSchema,
  type ReviewExtraction
} from '../shared/contracts/review';
import { buildGovernmentWarningCheck } from './government-warning-validator';

function buildExtraction(
  overrides: {
    governmentWarning?: Partial<ReviewExtraction['fields']['governmentWarning']>;
  } = {}
): ReviewExtraction {
  return reviewExtractionSchema.parse({
    id: 'extract-warning-vote-test',
    model: 'gpt-5.4',
    beverageType: 'distilled-spirits',
    beverageTypeSource: 'class-type',
    modelBeverageTypeHint: 'distilled-spirits',
    standalone: true,
    hasApplicationData: false,
    noPersistence: true,
    imageQuality: {
      score: 0.93,
      state: 'ok',
      issues: []
    },
    warningSignals: {
      prefixAllCaps: {
        status: 'yes',
        confidence: 0.97
      },
      prefixBold: {
        status: 'yes',
        confidence: 0.9
      },
      continuousParagraph: {
        status: 'yes',
        confidence: 0.95
      },
      separateFromOtherContent: {
        status: 'yes',
        confidence: 0.88
      }
    },
    fields: {
      brandName: {
        present: true,
        value: 'Ironwood',
        confidence: 0.9
      },
      fancifulName: {
        present: false,
        confidence: 0.1
      },
      classType: {
        present: true,
        value: 'Vodka',
        confidence: 0.91
      },
      alcoholContent: {
        present: true,
        value: '40% Alc./Vol.',
        confidence: 0.86
      },
      netContents: {
        present: true,
        value: '1 L',
        confidence: 0.91
      },
      applicantAddress: {
        present: false,
        confidence: 0.08
      },
      countryOfOrigin: {
        present: false,
        confidence: 0.05
      },
      ageStatement: {
        present: false,
        confidence: 0.04
      },
      sulfiteDeclaration: {
        present: false,
        confidence: 0.05
      },
      appellation: {
        present: false,
        confidence: 0.06
      },
      vintage: {
        present: false,
        confidence: 0.06
      },
      governmentWarning: {
        present: true,
        value: CANONICAL_GOVERNMENT_WARNING,
        confidence: 0.96,
        ...overrides.governmentWarning
      },
      varietals: []
    },
    summary: 'Structured extraction completed successfully.'
  });
}

describe('government warning validator vote-backed outcomes', () => {
  it('passes exact-text when two independent reads support the wording despite minor read noise', () => {
    const noisyWarning =
      'GOVERNMENT WARNING: According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          value: noisyWarning
        }
      }),
      undefined,
      {
        status: 'verified',
        similarity: 0.972,
        extractedText: noisyWarning,
        editDistance: 8,
        headingAllCaps: true,
        confidence: 0.93,
        durationMs: 180
      }
    );

    expect(check.status).toBe('pass');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'pass' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    expect(check.warning?.result).toMatchObject({
      overall: 'pass',
      focus: 'verified-minor-noise'
    });
  });

  it('keeps conflicting warning reads in review instead of hard-failing the wording', () => {
    const wrongWarning =
      'GOVERNMENT WARNING: Consumers who have any health condition, are pregnant, or may become pregnant should consult their physician before consuming this product.';

    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          value: wrongWarning,
          confidence: 0.85
        }
      }),
      undefined,
      {
        status: 'verified',
        similarity: 0.921,
        extractedText:
          'GOVERNMENT WARNING: (1) According to the Surgeon General. women shoutd mos drink aicoholbe beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your abitity to drive a car or operate machinery, and may cause heaith probiems.',
        editDistance: 21,
        headingAllCaps: true,
        confidence: 0.93,
        durationMs: 240
      }
    );

    expect(check.status).toBe('review');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'review' },
      { id: 'uppercase-bold-heading', status: 'pass' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    expect(check.warning?.result).toMatchObject({
      overall: 'review',
      focus: 'partial-match'
    });
  });
});
