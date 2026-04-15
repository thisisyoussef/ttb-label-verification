import type {
  CheckReview,
  ComparisonStatus,
  ReviewIntakeFields,
  VerificationCounts,
  VerificationReport
} from './review-base';
import {
  CANONICAL_GOVERNMENT_WARNING,
  REVIEW_LATENCY_BUDGET_MS,
  verificationReportSchema
} from './review-base';

const SEED_WARNING_EXTRACTED =
  'Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

export const seedVerificationReport: VerificationReport = {
  id: 'seed-distilled-spirits-002',
  mode: 'single-label',
  beverageType: 'distilled-spirits',
  verdict: 'review',
  verdictSecondary: 'The image was hard to read — please review these results carefully.',
  standalone: false,
  extractionQuality: {
    globalConfidence: 0.68,
    state: 'low-confidence',
    note:
      'Seed fixture keeps ambiguous visual judgments in review until live extraction and validator stories land.'
  },
  counts: {
    pass: 1,
    review: 3,
    fail: 0
  },
  latencyBudgetMs: REVIEW_LATENCY_BUDGET_MS,
  noPersistence: true,
  summary:
    'Sample result for demonstration purposes.',
  checks: [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'pass',
      severity: 'note',
      summary: 'Application value and extracted label text match.',
      details:
        'The value on the application matches what was read from the label.',
      confidence: 0.99,
      citations: ['TTB distilled spirits mandatory label information'],
      applicationValue: "Stone's Throw",
      extractedValue: "Stone's Throw",
      comparison: {
        status: 'match',
        applicationValue: "Stone's Throw",
        extractedValue: "Stone's Throw",
        note: 'Values match exactly.'
      }
    },
    {
      id: 'alcohol-content',
      label: 'Alcohol content',
      status: 'review',
      severity: 'minor',
      summary: 'Formatting difference requires a quick human check.',
      details:
        'The extracted value differs only by letter casing. The richer contract preserves that cosmetic mismatch as review rather than a hard fail.',
      confidence: 0.86,
      citations: [
        'TTB distilled spirits mandatory label information',
        'TTB product spec cosmetic comparison guidance'
      ],
      applicationValue: '45% Alc./Vol.',
      extractedValue: '45% alc./vol.',
      comparison: {
        status: 'case-mismatch',
        applicationValue: '45% Alc./Vol.',
        extractedValue: '45% alc./vol.',
        note: 'Only letter casing differs.'
      }
    },
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'review',
      severity: 'blocker',
      summary:
        'Government warning needs manual review — automated checking is not yet available for this field.',
      details:
        'The warning text has been read and compared, but some checks still need your attention. Expand to see the detailed breakdown.',
      confidence: 0.62,
      citations: [
        'TTB distilled spirits health warning guidance',
        '27 CFR part 16'
      ],
      extractedValue: SEED_WARNING_EXTRACTED,
      warning: {
        subChecks: [
          {
            id: 'present',
            label: 'Warning text is present',
            status: 'pass',
            reason: 'Warning text was detected in the submitted label.'
          },
          {
            id: 'exact-text',
            label: 'Warning text matches required wording',
            status: 'review',
            reason:
              'Exact-wording check needs manual review — automated comparison is not yet available.'
          },
          {
            id: 'uppercase-bold-heading',
            label: 'Warning heading is uppercase and bold',
            status: 'review',
            reason:
              'This formatting check needs your review — automated checking is not yet available.'
          },
          {
            id: 'continuous-paragraph',
            label: 'Warning is a continuous paragraph',
            status: 'pass',
            reason: 'The warning text appears as a continuous paragraph on the label.'
          },
          {
            id: 'legibility',
            label: 'Warning is legible at label size',
            status: 'review',
            reason:
              'Legibility could not be confirmed automatically and needs your review.'
          }
        ],
        required: CANONICAL_GOVERNMENT_WARNING,
        extracted: SEED_WARNING_EXTRACTED,
        segments: [
          {
            kind: 'wrong-case',
            required: 'GOVERNMENT WARNING',
            extracted: 'Government Warning'
          },
          {
            kind: 'match',
            required:
              ': (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
            extracted:
              ': (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
          }
        ]
      }
    }
  ],
  crossFieldChecks: [
    {
      id: 'same-field-of-vision',
      label: 'Same field of vision',
      status: 'review',
      severity: 'major',
      summary:
        'Brand name, class/type, and alcohol content must appear in the same field of vision — this needs your review.',
      details:
        'Per TTB guidance, these fields must be visible together. Automated positioning checks are not yet available, so please verify this on the label.',
      confidence: 0.54,
      citations: [
        'TTB distilled spirits mandatory label information',
        '27 CFR 5.61 and related TTB guidance'
      ]
    }
  ]
};

const standaloneSeedVerificationReport: VerificationReport = {
  id: 'seed-standalone-001',
  mode: 'single-label',
  beverageType: 'distilled-spirits',
  verdict: 'review',
  standalone: true,
  extractionQuality: {
    globalConfidence: 0.68,
    state: 'low-confidence',
    note:
      'Seed fixture keeps low-confidence extraction reversible while standalone review flows through the approved results UI.'
  },
  counts: {
    pass: 1,
    review: 2,
    fail: 0
  },
  latencyBudgetMs: REVIEW_LATENCY_BUDGET_MS,
  noPersistence: true,
  summary:
    'Image-only review. Values read from the label are shown without application-data comparisons.',
  checks: [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'pass',
      severity: 'note',
      summary: 'Brand name was read from the label.',
      details:
        'No application value was provided, so the value read from the label is shown without comparison.',
      confidence: 0.97,
      citations: ['TTB distilled spirits mandatory label information'],
      extractedValue: "Stone's Throw",
      comparison: {
        status: 'not-applicable',
        note: 'No application value was supplied for standalone review.'
      }
    },
    {
      id: 'alcohol-content',
      label: 'Alcohol content',
      status: 'review',
      severity: 'minor',
      summary: 'Alcohol content is visible, but image quality keeps this in review.',
      details:
        'The image was hard to read and no application data was provided, so this value needs your review.',
      confidence: 0.74,
      citations: [
        'TTB distilled spirits mandatory label information',
        'TTB product spec cosmetic comparison guidance'
      ],
      extractedValue: '45% alc./vol.',
      comparison: {
        status: 'not-applicable',
        note: 'No application value was supplied for standalone review.'
      }
    },
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'review',
      severity: 'blocker',
      summary:
        'Government warning needs manual review — automated checking is not yet available for this field.',
      details:
        'Warning text was read from the label. Exact wording and formatting checks still need your review.',
      confidence: 0.62,
      citations: [
        'TTB distilled spirits health warning guidance',
        '27 CFR part 16'
      ],
      extractedValue: SEED_WARNING_EXTRACTED,
      warning: seedVerificationReport.checks.find(
        (check) => check.id === 'government-warning'
      )?.warning
    }
  ],
  crossFieldChecks: [
    {
      id: 'same-field-of-vision',
      label: 'Same field of vision',
      status: 'info',
      severity: 'note',
      summary: 'Cross-field dependency skipped in standalone mode.',
      details:
        'Application-backed cross-field checks are skipped when no application form was provided.',
      confidence: 1,
      citations: [
        'TTB distilled spirits mandatory label information',
        '27 CFR 5.61 and related TTB guidance'
      ]
    }
  ]
};

type SeedApplicationField = 'brandName' | 'alcoholContent';

const SEED_APPLICATION_FIELD_MAP = [
  {
    checkId: 'brand-name',
    field: 'brandName'
  },
  {
    checkId: 'alcohol-content',
    field: 'alcoholContent'
  }
] as const satisfies ReadonlyArray<{
  checkId: string;
  field: SeedApplicationField;
}>;

export function getSeedVerificationReport(options: {
  standalone?: boolean;
  applicationFields?: Partial<ReviewIntakeFields>;
} = {}): VerificationReport {
  const baseReport = options.standalone
    ? standaloneSeedVerificationReport
    : seedVerificationReport;
  const report =
    options.standalone || !options.applicationFields
      ? baseReport
      : overlaySeedApplicationFields(baseReport, options.applicationFields);

  return verificationReportSchema.parse(report);
}

function overlaySeedApplicationFields(
  report: VerificationReport,
  applicationFields: Partial<Pick<ReviewIntakeFields, SeedApplicationField>>
): VerificationReport {
  const checks = report.checks.map((check) => {
    const mapping = SEED_APPLICATION_FIELD_MAP.find((entry) => entry.checkId === check.id);
    if (!mapping) {
      return check;
    }

    const applicationValue = normalizeSeedApplicationValue(applicationFields[mapping.field]);
    if (!applicationValue) {
      return check;
    }

    return overlaySeedComparisonCheck(check, applicationValue);
  });

  return {
    ...report,
    checks,
    counts: countVerificationStatuses(checks, report.crossFieldChecks)
  };
}

function overlaySeedComparisonCheck(
  check: CheckReview,
  applicationValue: string
): CheckReview {
  const extractedValue = check.extractedValue;
  const comparisonStatus = compareSeedValues(applicationValue, extractedValue);

  return {
    ...check,
    status: comparisonStatus === 'match' ? 'pass' : 'review',
    summary: seedComparisonSummary(comparisonStatus),
    details: seedComparisonDetails(comparisonStatus),
    applicationValue,
    comparison: {
      status: comparisonStatus,
      applicationValue,
      extractedValue,
      note: seedComparisonNote(comparisonStatus)
    }
  };
}

function compareSeedValues(
  applicationValue: string,
  extractedValue: string | undefined
): ComparisonStatus {
  if (!extractedValue || extractedValue.length === 0) {
    return 'value-mismatch';
  }

  if (applicationValue === extractedValue) {
    return 'match';
  }

  if (applicationValue.toLowerCase() === extractedValue.toLowerCase()) {
    return 'case-mismatch';
  }

  return 'value-mismatch';
}

function seedComparisonSummary(status: ComparisonStatus): string {
  switch (status) {
    case 'match':
      return 'Application value matches what was read from the label.';
    case 'case-mismatch':
      return 'Formatting difference requires a quick human check.';
    case 'value-mismatch':
      return 'Application value does not match what was read from the label.';
    case 'not-applicable':
      return 'No application comparison is available.';
  }
}

function seedComparisonDetails(status: ComparisonStatus): string {
  switch (status) {
    case 'match':
      return 'The application value matches the text read from the label.';
    case 'case-mismatch':
      return 'The application value differs from what was read from the label only by letter casing.';
    case 'value-mismatch':
      return 'The application value does not match what was read from the label.';
    case 'not-applicable':
      return 'No application data was supplied for this review.';
  }
}

function seedComparisonNote(status: ComparisonStatus): string {
  switch (status) {
    case 'match':
      return 'Values match exactly.';
    case 'case-mismatch':
      return 'Only letter casing differs.';
    case 'value-mismatch':
      return 'The application value does not match what was read from the label.';
    case 'not-applicable':
      return 'No application value was supplied for standalone review.';
  }
}

function normalizeSeedApplicationValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function countVerificationStatuses(
  checks: CheckReview[],
  crossFieldChecks: CheckReview[]
): VerificationCounts {
  const counts: VerificationCounts = {
    pass: 0,
    review: 0,
    fail: 0
  };

  for (const check of [...checks, ...crossFieldChecks]) {
    if (check.status === 'pass') counts.pass += 1;
    if (check.status === 'review') counts.review += 1;
    if (check.status === 'fail') counts.fail += 1;
  }

  return counts;
}
