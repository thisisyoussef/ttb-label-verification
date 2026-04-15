import { REVIEW_LATENCY_BUDGET_MS } from '../shared/contracts/review';
import type {
  CheckReview,
  DiffSegment,
  UIVerificationReport,
  WarningEvidence
} from './types';

export const CANONICAL_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

export const CITATIONS_WARNING = ['27 CFR part 16', 'TTB health warning statement guidance'];

export const CITATIONS_SPIRITS = [
  '27 CFR 5.61 mandatory label information',
  'TTB distilled spirits labeling guidance'
];

export const CITATIONS_WINE = [
  '27 CFR 4.34 appellation and vintage',
  '27 CFR 4.35 class and type'
];

export const CITATIONS_MALT_ABV = [
  '27 CFR 7.65 alcohol content statement',
  'TTB malt beverage ABV format guidance'
];

export function countsFor(checks: CheckReview[], crossField: CheckReview[]) {
  const all = [...checks, ...crossField];
  const tally = { pass: 0, review: 0, fail: 0 };
  for (const check of all) {
    if (check.status === 'pass') tally.pass += 1;
    else if (check.status === 'review') tally.review += 1;
    else if (check.status === 'fail') tally.fail += 1;
  }
  return tally;
}

export function withReportDefaults(
  report: Omit<
    UIVerificationReport,
    'mode' | 'latencyBudgetMs' | 'noPersistence'
  >
): UIVerificationReport {
  return {
    mode: 'single-label',
    latencyBudgetMs: REVIEW_LATENCY_BUDGET_MS,
    noPersistence: true,
    ...report
  };
}

export function passCheck(
  id: string,
  label: string,
  appValue: string,
  extracted: string,
  citations: string[] = CITATIONS_SPIRITS,
  confidence = 0.97,
  summary = 'Matches the application value.',
  details = 'The application value matches the text read from the label.'
): CheckReview {
  return {
    id,
    label,
    status: 'pass',
    severity: 'note',
    summary,
    details,
    confidence,
    citations,
    applicationValue: appValue,
    extractedValue: extracted,
    comparison: { status: 'match' }
  };
}

export const perfectWarning: WarningEvidence = {
  subChecks: [
    { id: 'present', label: 'Warning text is present', status: 'pass', reason: 'Meets this requirement.' },
    { id: 'exact-text', label: 'Warning text matches required wording', status: 'pass', reason: 'Meets this requirement.' },
    {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'pass',
      reason: 'Meets this requirement.'
    },
    {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'pass',
      reason: 'Meets this requirement.'
    },
    {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'pass',
      reason: 'Meets this requirement.'
    }
  ],
  required: CANONICAL_WARNING,
  extracted: CANONICAL_WARNING,
  segments: [{ kind: 'match', required: CANONICAL_WARNING, extracted: CANONICAL_WARNING }]
};

export const WARNING_DEFECT_EXTRACTED =
  'Government Warning. (1) According to the surgeon general, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const warningDefectSegments: DiffSegment[] = [
  { kind: 'wrong-case', required: 'GOVERNMENT WARNING', extracted: 'Government Warning' },
  { kind: 'wrong-character', required: ':', extracted: '.' },
  { kind: 'match', required: ' (1) According to the ', extracted: ' (1) According to the ' },
  { kind: 'wrong-case', required: 'Surgeon General', extracted: 'surgeon general' },
  {
    kind: 'match',
    required:
      ', women should not drink alcoholic beverages during pregnancy because of the risk of birth defects',
    extracted:
      ', women should not drink alcoholic beverages during pregnancy because of the risk of birth defects'
  },
  { kind: 'missing', required: '. ', extracted: ' ' },
  {
    kind: 'match',
    required:
      '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    extracted:
      '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
  }
];

export const warningDefectEvidence: WarningEvidence = {
  subChecks: [
    { id: 'present', label: 'Warning text is present', status: 'pass', reason: 'Meets this requirement.' },
    {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'fail',
      reason:
        'Required wording begins with "GOVERNMENT WARNING:". Extracted text begins with "Government Warning." and omits a period + space before "(2)".'
    },
    {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'fail',
      reason: 'Heading appears in mixed case.'
    },
    {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'pass',
      reason: 'Meets this requirement.'
    },
    {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'pass',
      reason: 'Meets this requirement.'
    }
  ],
  required: CANONICAL_WARNING,
  extracted: WARNING_DEFECT_EXTRACTED,
  segments: warningDefectSegments
};
