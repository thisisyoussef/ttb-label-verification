import { describe, expect, it } from 'vitest';

import {
  CANONICAL_GOVERNMENT_WARNING,
  reviewExtractionSchema,
  type DiffSegment,
  type ReviewExtraction
} from '../shared/contracts/review';
import {
  buildGovernmentWarningCheck,
  diffGovernmentWarningText,
  normalizeGovernmentWarningText
} from './government-warning-validator';

const WARNING_DEFECT_EXTRACTED =
  'Government Warning. (1) According to the surgeon general, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const WARNING_UPPERCASE_BODY_EXTRACTED = `GOVERNMENT WARNING:${CANONICAL_GOVERNMENT_WARNING
  .slice('GOVERNMENT WARNING:'.length)
  .toUpperCase()}`;

// Only the "GOVERNMENT WARNING" heading is graded for capitalization in
// the diff. Body case-only differences ("Surgeon General" vs "surgeon
// general") now collapse into the surrounding match segment so the UI
// stops surfacing redundant capitalization flags on top of the heading
// sub-check.
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
    required:
      ' (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects',
    extracted:
      ' (1) According to the surgeon general, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects'
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
    expect(check.summary).toBe('Warning text verified');
    expect(check.details).toBe('All required warning language is present.');
    expect(check.warning?.result).toMatchObject({
      overall: 'pass',
      focus: 'verified',
      label: 'Warning text verified',
      sublabel: 'All required warning language is present.'
    });
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

  it('passes when the body casing differs but the warning wording and heading format still match', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          value: WARNING_UPPERCASE_BODY_EXTRACTED
        }
      })
    );

    expect(check.status).toBe('pass');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'pass' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    // Body-only case differences must not render as "minor read
    // differences" — once the heading matches and the wording
    // case-insensitively matches, the summary should read clean.
    expect(check.warning?.result).toMatchObject({
      overall: 'pass',
      focus: 'verified',
      label: 'Warning text verified',
      sublabel: 'All required warning language is present.'
    });
    // Diff collapses body case-only differences into a single match
    // segment (heading match + single body match).
    expect(check.warning?.segments).toEqual([
      {
        kind: 'match',
        required: CANONICAL_GOVERNMENT_WARNING,
        extracted: WARNING_UPPERCASE_BODY_EXTRACTED
      }
    ]);
  });

  it('fails the showcase warning defect case with precise evidence', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          value: WARNING_DEFECT_EXTRACTED
        },
        warningSignals: {
          prefixAllCaps: {
            status: 'no',
            confidence: 0.96,
            note: 'Heading is title case.'
          }
        }
      })
    );

    expect(check.status).toBe('fail');
    expect(check.severity).toBe('blocker');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'fail' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    expect(check.warning?.result).toMatchObject({
      overall: 'reject',
      focus: 'formatting-check',
      label: 'Warning formatting needs attention'
    });
    expect(check.warning?.segments).toEqual(EXPECTED_WARNING_DEFECT_SEGMENTS);
  });

  it('keeps missing-word defects inside the exact-text check instead of a second critical-word downgrade', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          value: CANONICAL_GOVERNMENT_WARNING.replace('during pregnancy because', 'during because')
        }
      })
    );

    expect(check.status).toBe('review');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'review' },
      { id: 'uppercase-bold-heading', status: 'pass' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    expect(check.warning?.result?.focus).not.toBe('missing-language');
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
    expect(check.summary).toBe('Warning text unclear');
    expect(check.warning?.result).toMatchObject({
      overall: 'review',
      focus: 'text-unclear',
      label: 'Warning text unclear'
    });
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'review' },
      { id: 'uppercase-bold-heading', status: 'review' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'review' }
    ]);
  });

  it('keeps bold-only heading negatives in review instead of hard-failing the warning', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        warningSignals: {
          prefixBold: {
            status: 'no',
            confidence: 0.98,
            note: 'Heading weight looks close to the following body text.'
          }
        }
      })
    );

    expect(check.status).toBe('pass');
    expect(check.warning?.result).toMatchObject({
      overall: 'pass',
      focus: 'formatting-check',
      label: 'Warning text verified'
    });
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'review' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
    ]);
    expect(
      check.warning?.subChecks.find((subCheck) => subCheck.id === 'uppercase-bold-heading')?.reason
    ).toBe(
      'Heading is all caps, but the current visual read is not reliable enough to call boldness as a defect. Please confirm visually.'
    );
  });

  it('keeps bold-only misses on unclear warning images in review instead of fail', () => {
    const check = buildGovernmentWarningCheck(
      buildExtraction({
        governmentWarning: {
          confidence: 0.55
        },
        warningSignals: {
          prefixBold: {
            status: 'no',
            confidence: 0.92,
            note: 'Very small vertical heading.'
          }
        }
      })
    );

    expect(check.status).toBe('review');
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'review' },
      { id: 'uppercase-bold-heading', status: 'review' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'pass' }
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
    expect(check.summary).toBe('Warning not found in this image');
    expect(check.details).toContain('No warning text was found');
    expect(check.warning?.result).toMatchObject({
      overall: 'reject',
      focus: 'not-found',
      label: 'Warning not found in this image'
    });
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
    expect(check.summary).toBe('Warning text unclear');
    expect(check.warning?.result).toMatchObject({
      overall: 'review',
      focus: 'text-unclear',
      label: 'Warning text unclear'
    });
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
    expect(check.summary).toBe('Warning formatting needs attention');
    expect(check.warning?.result).toMatchObject({
      overall: 'reject',
      focus: 'formatting-check',
      label: 'Warning formatting needs attention'
    });
    expect(check.warning?.subChecks).toMatchObject([
      { id: 'present', status: 'pass' },
      { id: 'exact-text', status: 'pass' },
      { id: 'uppercase-bold-heading', status: 'pass' },
      { id: 'continuous-paragraph', status: 'pass' },
      { id: 'legibility', status: 'fail' }
    ]);
    expect(check.details).toContain('heading or layout does not meet the required presentation');
  });
});
