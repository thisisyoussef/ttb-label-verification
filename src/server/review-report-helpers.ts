import type {
  BeverageType,
  CheckReview,
  ComparisonStatus,
  ReviewExtraction,
  VerificationCounts,
  VerificationReport
} from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';

const DISTILLED_CITATIONS = [
  '27 CFR 5.61 mandatory label information',
  'TTB distilled spirits labeling guidance'
];

const WINE_CITATIONS = [
  '27 CFR 4.32 mandatory label information',
  '27 CFR 4.34 appellation and vintage',
  'TTB wine labeling guidance'
];

const MALT_CITATIONS = [
  '27 CFR 7.22 mandatory label information',
  'TTB malt beverage labeling guidance'
];

export const MALT_ABV_CITATIONS = [
  '27 CFR 7.65 alcohol content statement',
  'TTB malt beverage ABV format guidance'
];

// Intake field keys are a superset of extraction field keys because the
// applicant form captures data (e.g. `country`, `origin`) that maps to a
// differently named extraction field (`countryOfOrigin`).
export type IntakeFieldKey =
  | 'brandName'
  | 'classType'
  | 'alcoholContent'
  | 'netContents'
  | 'applicantAddress'
  | 'country';

export type ExtractionFieldKey =
  | 'brandName'
  | 'classType'
  | 'alcoholContent'
  | 'netContents'
  | 'applicantAddress'
  | 'countryOfOrigin';

// Kept for backwards compatibility — original name was used by tests.
export type ComparedFieldKey = IntakeFieldKey;

export type FieldSpec = {
  id: string;
  label: string;
  intakeKey: IntakeFieldKey;
  extractionKey: ExtractionFieldKey;
};

export const FIELD_SPECS: FieldSpec[] = [
  {
    id: 'brand-name',
    label: 'Brand name',
    intakeKey: 'brandName',
    extractionKey: 'brandName'
  },
  {
    id: 'class-type',
    label: 'Class / Type',
    intakeKey: 'classType',
    extractionKey: 'classType'
  },
  {
    id: 'alcohol-content',
    label: 'Alcohol content',
    intakeKey: 'alcoholContent',
    extractionKey: 'alcoholContent'
  },
  {
    id: 'net-contents',
    label: 'Net contents',
    intakeKey: 'netContents',
    extractionKey: 'netContents'
  },
  {
    id: 'applicant-address',
    label: 'Bottler/producer name & address',
    intakeKey: 'applicantAddress',
    extractionKey: 'applicantAddress'
  },
  {
    id: 'country-of-origin',
    label: 'Country of origin',
    intakeKey: 'country',
    extractionKey: 'countryOfOrigin'
  }
];

export type VerificationReportInput = {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
};

export function compareFieldValues(
  applicationValue: string,
  extractedValue: string
): { status: ComparisonStatus; note: string } {
  const normalizedApplication = normalizeExact(applicationValue);
  const normalizedExtracted = normalizeExact(extractedValue);

  if (normalizedApplication === normalizedExtracted) {
    return {
      status: 'match',
      note: 'Normalized strings match exactly.'
    };
  }

  if (normalizedApplication.toLowerCase() === normalizedExtracted.toLowerCase()) {
    return {
      status: 'case-mismatch',
      note: 'Only letter casing differs after normalization.'
    };
  }

  if (normalizeCosmetic(applicationValue) === normalizeCosmetic(extractedValue)) {
    return {
      status: 'case-mismatch',
      note: 'Only casing, spacing, or punctuation differs after normalization.'
    };
  }

  return {
    status: 'value-mismatch',
    note: 'Submitted application value does not match extracted label text.'
  };
}

export function countStatuses(
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

export function deriveVerdict(input: {
  counts: VerificationCounts;
  standalone: boolean;
  extraction: ReviewExtraction;
}): VerificationReport['verdict'] {
  if (input.counts.fail > 0) {
    return 'reject';
  }

  if (
    input.standalone ||
    input.counts.review > 0 ||
    input.extraction.imageQuality.state !== 'ok'
  ) {
    return 'review';
  }

  return 'approve';
}

export function deriveVerdictSecondary(input: {
  verdict: VerificationReport['verdict'];
  checks: CheckReview[];
  crossFieldChecks: CheckReview[];
  standalone: boolean;
  extraction: ReviewExtraction;
}) {
  if (input.verdict === 'reject') {
    const failingCheck = [...input.checks, ...input.crossFieldChecks].find(
      (check) => check.status === 'fail'
    );
    return failingCheck ? `${failingCheck.label} is the deciding check.` : undefined;
  }

  if (input.standalone) {
    return 'Standalone review — comparison checks were not run.';
  }

  if (input.extraction.imageQuality.state === 'low-confidence') {
    return 'Low extraction confidence — review carefully.';
  }

  if ([...input.checks, ...input.crossFieldChecks].some((check) => check.status === 'review')) {
    return 'One or more checks still need human review.';
  }

  return undefined;
}

export function deriveSummary(input: {
  verdict: VerificationReport['verdict'];
  standalone: boolean;
  extraction: ReviewExtraction;
}) {
  if (input.verdict === 'reject') {
    return 'One or more deterministic checks failed.';
  }

  if (input.standalone) {
    return 'Standalone review preserves extracted evidence while skipping application comparisons.';
  }

  if (input.extraction.imageQuality.state === 'low-confidence') {
    return 'Low-confidence extraction keeps the label in review.';
  }

  if (input.verdict === 'review') {
    return 'One or more checks need human review.';
  }

  return 'All extracted checks passed for this label.';
}

export function buildExtractionQualityNote(extraction: ReviewExtraction) {
  if (extraction.imageQuality.note) {
    return extraction.imageQuality.note;
  }

  if (extraction.imageQuality.state === 'no-text-extracted') {
    return 'The system could not read enough text to produce a meaningful result.';
  }

  if (extraction.imageQuality.state === 'low-confidence') {
    return extraction.imageQuality.issues.length > 0
      ? extraction.imageQuality.issues.join('; ')
      : 'Image quality is below the threshold required for a confident verdict.';
  }

  return undefined;
}

export function citationsFor(beverageType: BeverageType) {
  switch (beverageType) {
    case 'wine':
      return WINE_CITATIONS;
    case 'malt-beverage':
      return MALT_CITATIONS;
    case 'distilled-spirits':
    case 'unknown':
      return DISTILLED_CITATIONS;
  }
}

export function missingFieldConfidence(extraction: ReviewExtraction) {
  return Math.max(0.25, extraction.imageQuality.score * 0.6);
}

export function hasForbiddenMaltAbvFormat(
  extraction: ReviewExtraction,
  applicationValue: string | undefined,
  extractedValue: string | undefined
) {
  if (extraction.beverageType !== 'malt-beverage') {
    return false;
  }

  return /\bABV\b/i.test(extractedValue ?? applicationValue ?? '');
}

function normalizeExact(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeCosmetic(value: string) {
  return normalizeExact(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}
