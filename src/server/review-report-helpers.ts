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
      note: 'Values match exactly.'
    };
  }

  if (normalizedApplication.toLowerCase() === normalizedExtracted.toLowerCase()) {
    return {
      status: 'case-mismatch',
      note: 'Only letter casing differs.'
    };
  }

  if (normalizeCosmetic(applicationValue) === normalizeCosmetic(extractedValue)) {
    return {
      status: 'case-mismatch',
      note: 'Only casing, spacing, or punctuation differs.'
    };
  }

  return {
    status: 'value-mismatch',
    note: 'The label does not match the approved record.'
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
    return 'No application data to compare against.';
  }

  if (input.extraction.imageQuality.state === 'low-confidence') {
    return 'The label image is hard to read. Please review carefully.';
  }

  const profile = summarizeReviewSeverity([
    ...input.checks,
    ...input.crossFieldChecks
  ]);

  return resolveDynamicReviewPhrase(profile);
}

export function deriveSummary(input: {
  verdict: VerificationReport['verdict'];
  standalone: boolean;
  extraction: ReviewExtraction;
}) {
  if (input.verdict === 'reject') {
    return 'One or more required fields do not match.';
  }

  if (input.standalone) {
    return 'No application data to compare against. Confirm the label details below match what was approved.';
  }

  if (input.extraction.imageQuality.state === 'low-confidence') {
    return 'The label image is too unclear to be confident. A human reviewer should look at this one.';
  }

  if (input.verdict === 'review') {
    // Reviews returned with no checks attached (e.g. when the
    // pipeline short-circuits on imageQuality) keep a generic
    // line. With checks present, fall through to the dynamic
    // phrase below for granularity.
    return 'One or more fields need a human look.';
  }

  return 'All fields match the approved record.';
}

// ─── Dynamic verdict copy ─────────────────────────────────────────
// The static "One or more fields need a human look." rendered the
// same way for one cosmetic flag and ten substantive ones, which
// hid useful triage signal. The helpers below classify the review-
// status checks by severity + count so the verdict subtitle can
// distinguish "almost good — one quick check" from "several checks
// need a closer look".

const SEVERITY_RANK: Record<CheckReview['severity'], number> = {
  note: 0,
  minor: 1,
  major: 2,
  blocker: 3
};

export interface ReviewSeverityProfile {
  /** Number of review-status rows across primary + cross-field checks. */
  count: number;
  /** Highest severity among those review rows. 'note' when none. */
  maxSeverity: CheckReview['severity'];
}

export function summarizeReviewSeverity(
  allChecks: CheckReview[]
): ReviewSeverityProfile {
  let count = 0;
  let maxSeverity: CheckReview['severity'] = 'note';
  for (const check of allChecks) {
    if (check.status !== 'review') continue;
    count += 1;
    if (SEVERITY_RANK[check.severity] > SEVERITY_RANK[maxSeverity]) {
      maxSeverity = check.severity;
    }
  }
  return { count, maxSeverity };
}

/**
 * Maps the review severity profile to a short, human phrase that
 * tells the reviewer how much work to expect. Falls back to the
 * generic "human look" line when there are no review rows (other
 * branches of `deriveVerdictSecondary` should have caught that
 * case already, but keep the function total for safety).
 */
export function resolveDynamicReviewPhrase(
  profile: ReviewSeverityProfile
): string | undefined {
  if (profile.count === 0) return undefined;
  const heavy =
    profile.maxSeverity === 'major' || profile.maxSeverity === 'blocker';

  if (profile.count === 1) {
    return heavy
      ? 'One field needs a closer look.'
      : 'Almost good — one quick check left.';
  }

  if (profile.count === 2) {
    return heavy
      ? 'A couple of fields need a closer look.'
      : 'A couple of quick checks left.';
  }

  if (profile.count <= 4) {
    return heavy
      ? `${profile.count} fields need a closer look.`
      : `${profile.count} quick checks left.`;
  }

  return heavy
    ? `${profile.count} fields need a closer look — start with the major flags.`
    : `${profile.count} quick checks left.`;
}

export function buildExtractionQualityNote(extraction: ReviewExtraction) {
  if (extraction.imageQuality.note) {
    return extraction.imageQuality.note;
  }

  if (extraction.imageQuality.state === 'no-text-extracted') {
    return 'We could not read enough text from the label image to review it.';
  }

  if (extraction.imageQuality.state === 'low-confidence') {
    return extraction.imageQuality.issues.length > 0
      ? extraction.imageQuality.issues.join('; ')
      : 'The label image is too unclear to be confident in what was read.';
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
