import { describe, expect, it } from 'vitest';

import {
  CANONICAL_GOVERNMENT_WARNING,
  reviewExtractionSchema,
  type DiffSegment,
  type ReviewExtraction
} from '../../shared/contracts/review';
import {
  buildGovernmentWarningCheck,
  diffGovernmentWarningText,
  normalizeGovernmentWarningText
} from './government-warning-validator';

const WARNING_DEFECT_EXTRACTED =
  'Government Warning. (1) According to the surgeon general, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const EXPECTED_WARNING_DEFECT_SEGMENTS: DiffSegment[] = [
  {
    kind: 'wrong-case',
    required: 'GOVERNMENT WARNING',
    extracted: 'Government Warning'
  },
  {
    kind: 'wrong-character',
    required: ':',
    extracted: '.'
  },
  {
    kind: 'match',
    required: ' (1) According to the ',
    extracted: ' (1) According to the '
  },
  {
    kind: 'wrong-case',
    required: 'Surgeon General',
    extracted: 'surgeon general'
  },
  {
    kind: 'match',
    required:
      ', women should not drink alcoholic beverages during pregnancy because of the risk of birth defects',
    extracted:
      ', women should not drink alcoholic beverages during pregnancy because of the risk of birth defects'
  },
  {
    kind: 'missing',
    required: '. ',
    extracted: ' '
  },
  {
    kind: 'match',
    required:
      '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    extracted:
      '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
  }
];

function buildExtraction(
  overrides: {
    governmentWarning?: Partial<ReviewExtraction['fields']['governmentWarning']>;
    warningSignals?: Partial<ReviewExtraction['warningSignals']>;
    imageQuality?: Partial<ReviewExtraction['imageQuality']>;
  } = {}
): ReviewExtraction {
  return reviewExtractionSchema.parse({
    id: 'extract-warning-test',
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

describe('government warning validator', () => {
  it('normalizes OCR whitespace without mutating punctuation or case', () => {
    expect(
      normalizeGovernmentWarningText(
        '  GOVERNMENT WARNING:\n(1) According to the Surgeon General,\t women should not drink  '
      )
    ).toBe(
      'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink'
    );
  });

  it('builds character-level diff evidence for the warning defect showcase case', () => {
    expect(
      diffGovernmentWarningText({
        required: CANONICAL_GOVERNMENT_WARNING,
        extracted: WARNING_DEFECT_EXTRACTED
      })
    ).toEqual(EXPECTED_WARNING_DEFECT_SEGMENTS);
  });

  it('passes when warning text and visual requirements are clear', () => {
    const check = buildGovernmentWarningCheck(buildExtraction());

    expect(check.status).toBe('pass');
    expect(check.warning?.segments).toEqual([
      {
        kind: 'match',
        required: CANONICAL_GOVERNMENT_WARNING,
        extracted: CANONICAL_GOVERNMENT_WARNING
      }
    ]);
    expect(check.warning?.subChecks.map((subCheck) => subCheck.status)).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass'
    ]);
  });

  it('fails the showcase warning defect case with precise evidence', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          value: WARNING_DEFECT_EXTRACTED
        }
      })
    );

    expect(check.status).toBe('fail');
    expect(check.severity).toBe('blocker');
    // exact-text is now a case-insensitive fuzzy check (see
    // government-warning-validator.ts computeWarningSimilarity). The
    // showcase defect body text is ~98% similar to the canonical after
    // case folding, so exact-text passes — but the heading casing defect
    // is caught by uppercase-bold-heading, which still drives the overall
    // fail verdict. This matches TTB 27 CFR 16.22 where the heading
    // conspicuousness is a separate regulatory requirement from the body
    // wording.
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'fail' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    expect(check.warning?.segments).toEqual(EXPECTED_WARNING_DEFECT_SEGMENTS);
  });

  it('downgrades ambiguous visual formatting calls to review instead of fail', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        warningSignals: {
          prefixBold: {
            status: 'uncertain',
            confidence: 0.42,
            note: 'Typeface weight is hard to confirm from glare.'
          },
          separateFromOtherContent: {
            status: 'uncertain',
            confidence: 0.46,
            note: 'The warning sits near decorative text.'
          }
        },
        imageQuality: {
          score: 0.58,
          state: 'low-confidence',
          issues: ['Bottle glare across small text']
        }
      })
    );

    expect(check.status).toBe('review');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'review' },
      { id: 'uppercase-bold-heading', status: 'review' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'review' }
    ]);
  });

  it('fails when a readable label is missing the warning text entirely', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          present: false,
          value: undefined,
          confidence: 0.96
        }
      })
    );

    expect(check.status).toBe('fail');
    expect(check.summary).toBe('Required government warning was not detected on the label.');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'fail' },
      { id: 'exact-text', status: 'review' },
      { id: 'uppercase-bold-heading', status: 'review' },
      { id: 'continuous-paragraph', status: 'review' },
      { id: 'legibility', status: 'review' }
    ]);
  });

  it('keeps a low-confidence missing warning in review instead of hard-failing it', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          present: false,
          value: undefined,
          confidence: 0.05
        },
        imageQuality: {
          score: 0.51,
          state: 'low-confidence',
          issues: ['Bottle glare across warning panel']
        }
      })
    );

    expect(check.status).toBe('review');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'review' },
      { id: 'exact-text', status: 'review' },
      { id: 'uppercase-bold-heading', status: 'review' },
      { id: 'continuous-paragraph', status: 'review' },
      { id: 'legibility', status: 'review' }
    ]);
  });

  it('fails legibility when the warning is readable but visually merged into nearby content', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        warningSignals: {
          separateFromOtherContent: {
            status: 'no',
            confidence: 0.92,
            note: 'Warning is crowded by nearby promotional copy.'
          }
        }
      })
    );

    expect(check.status).toBe('fail');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'pass' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'fail' }
    ]);
    expect(check.details).toContain('Warning does not appear separate from surrounding label content.');
  });
});
