import { describe, expect, it } from 'vitest';

import {
  CANONICAL_GOVERNMENT_WARNING,
  reviewExtractionSchema,
  type ReviewExtraction
} from '../../shared/contracts/review';
import { buildGovernmentWarningCheck } from './government-warning-validator';

const WARNING_UPPERCASE_BODY_EXTRACTED = `GOVERNMENT WARNING:${CANONICAL_GOVERNMENT_WARNING
  .slice('GOVERNMENT WARNING:'.length)
  .toUpperCase()}`;
const WARNING_TRAILING_METADATA_EXTRACTED = `${WARNING_UPPERCASE_BODY_EXTRACTED} FOURLOKO.COM 851593 @FOURLOKO`;

function buildExtraction(
  overrides: {
    governmentWarning?: Partial<ReviewExtraction['fields']['governmentWarning']>;
    warningSignals?: Partial<ReviewExtraction['warningSignals']>;
    imageQuality?: Partial<ReviewExtraction['imageQuality']>;
  } = {}
): ReviewExtraction {
  return reviewExtractionSchema.parse({
    id: 'extract-warning-tail-trim-test',
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
      issues: [],
      ...overrides.imageQuality
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
      },
      ...overrides.warningSignals
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

describe('government warning validator trailing metadata handling', () => {
  it('trims trailing metadata after a complete warning so the exact-text check still passes', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          value: WARNING_TRAILING_METADATA_EXTRACTED
        }
      })
    );

    expect(check.status).toBe('pass');
    expect(check.extractedValue).toBe(WARNING_UPPERCASE_BODY_EXTRACTED);
    expect(check.warning?.extracted).toBe(WARNING_UPPERCASE_BODY_EXTRACTED);
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'pass' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    expect(check.warning?.segments).toEqual([
      {
        kind: 'match',
        required: CANONICAL_GOVERNMENT_WARNING,
        extracted: WARNING_UPPERCASE_BODY_EXTRACTED
      }
    ]);
  });
});
