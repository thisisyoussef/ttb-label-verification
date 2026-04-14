import {
  verificationReportSchema,
  type BeverageType,
  type CheckReview,
  type ComparisonStatus,
  type ReviewExtraction,
  type ReviewExtractionField,
  type VerificationCounts,
  type VerificationReport
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

const MALT_ABV_CITATIONS = [
  '27 CFR 7.65 alcohol content statement',
  'TTB malt beverage ABV format guidance'
];

type ComparedFieldKey = 'brandName' | 'classType' | 'alcoholContent' | 'netContents';

type FieldSpec = {
  id: string;
  label: string;
  intakeKey: ComparedFieldKey;
  extractionKey: ComparedFieldKey;
};

const FIELD_SPECS: FieldSpec[] = [
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
  }
];

export function buildVerificationReport(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  id?: string;
}): VerificationReport {
  const extractionQuality = {
    globalConfidence: input.extraction.imageQuality.score,
    state: input.extraction.imageQuality.state,
    note: buildExtractionQualityNote(input.extraction)
  } as const;

  if (input.extraction.imageQuality.state === 'no-text-extracted') {
    return verificationReportSchema.parse({
      id: input.id ?? input.extraction.id,
      mode: 'single-label',
      beverageType: input.extraction.beverageType,
      verdict: 'review',
      standalone: input.intake.standalone,
      extractionQuality,
      counts: {
        pass: 0,
        review: 0,
        fail: 0
      },
      checks: [],
      crossFieldChecks: [],
      latencyBudgetMs: 5000,
      noPersistence: true,
      summary: 'No text could be extracted from the submitted label image.'
    });
  }

  const checks = buildFieldChecks(input);
  checks.push(input.warningCheck);

  const crossFieldChecks = buildCrossFieldChecks(input);
  const counts = countStatuses(checks, crossFieldChecks);
  const verdict = deriveVerdict({
    counts,
    standalone: input.intake.standalone,
    extraction: input.extraction
  });

  return verificationReportSchema.parse({
    id: input.id ?? input.extraction.id,
    mode: 'single-label',
    beverageType: input.extraction.beverageType,
    verdict,
    verdictSecondary: deriveVerdictSecondary({
      verdict,
      checks,
      crossFieldChecks,
      standalone: input.intake.standalone,
      extraction: input.extraction
    }),
    standalone: input.intake.standalone,
    extractionQuality,
    counts,
    checks,
    crossFieldChecks,
    latencyBudgetMs: 5000,
    noPersistence: true,
    summary: deriveSummary({
      verdict,
      standalone: input.intake.standalone,
      extraction: input.extraction
    })
  });
}

function buildFieldChecks(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview[] {
  return FIELD_SPECS.map((spec) => buildFieldCheck({ ...input, spec })).filter(
    (check): check is CheckReview => check !== null
  );
}

function buildFieldCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  spec: FieldSpec;
}): CheckReview | null {
  const applicationValue = input.intake.fields[input.spec.intakeKey];
  const extractedField = input.extraction.fields[input.spec.extractionKey];
  const extractedValue = extractedField.present ? extractedField.value : undefined;

  if (!applicationValue && !extractedField.present) {
    return null;
  }

  if (input.spec.id === 'alcohol-content' && hasForbiddenMaltAbvFormat(input.extraction, applicationValue, extractedValue)) {
    return buildForbiddenMaltAbvCheck({
      label: input.spec.label,
      applicationValue,
      extractedValue,
      confidence: extractedField.confidence
    });
  }

  if (!applicationValue) {
    return buildStandaloneFieldCheck({
      extraction: input.extraction,
      extractedField,
      extractedValue,
      id: input.spec.id,
      label: input.spec.label
    });
  }

  if (!extractedField.present || !extractedValue) {
    return {
      id: input.spec.id,
      label: input.spec.label,
      status: 'review',
      severity: 'major',
      summary: `Could not confirm ${input.spec.label.toLowerCase()} from the label.`,
      details:
        'The submitted application value is available, but extraction did not return a reliable label value for this row. Leave this in review rather than rejecting automatically.',
      confidence: missingFieldConfidence(input.extraction),
      citations: citationsFor(input.extraction.beverageType),
      applicationValue,
      comparison: {
        status: 'value-mismatch',
        applicationValue,
        note: 'No reliable extracted value was available for this comparison.'
      }
    };
  }

  const comparison = compareFieldValues(applicationValue, extractedValue);

  if (comparison.status === 'match') {
    return {
      id: input.spec.id,
      label: input.spec.label,
      status: 'pass',
      severity: 'note',
      summary: 'Matches the application value.',
      details:
        'Application value and extracted label text match exactly within normalization.',
      confidence: extractedField.confidence,
      citations: citationsFor(input.extraction.beverageType),
      applicationValue,
      extractedValue,
      comparison: {
        status: 'match',
        applicationValue,
        extractedValue,
        note: comparison.note
      }
    };
  }

  return {
    id: input.spec.id,
    label: input.spec.label,
    status: 'review',
    severity: comparison.status === 'case-mismatch' ? 'minor' : 'major',
    summary:
      comparison.status === 'case-mismatch'
        ? 'Cosmetic difference detected.'
        : 'Application value and label text do not match.',
    details:
      comparison.status === 'case-mismatch'
        ? 'The difference is limited to casing, spacing, or punctuation, so this stays in review instead of becoming a hard fail.'
        : 'The submitted application value does not match the extracted label text. Keep this evidence-backed mismatch in review for a human decision.',
    confidence: extractedField.confidence,
    citations: citationsFor(input.extraction.beverageType),
    applicationValue,
    extractedValue,
    comparison: {
      status: comparison.status,
      applicationValue,
      extractedValue,
      note: comparison.note
    }
  };
}

function buildStandaloneFieldCheck(input: {
  extraction: ReviewExtraction;
  extractedField: ReviewExtractionField;
  extractedValue: string | undefined;
  id: string;
  label: string;
}): CheckReview | null {
  if (!input.extractedField.present || !input.extractedValue) {
    return null;
  }

  const confident =
    input.extraction.imageQuality.state === 'ok' && input.extractedField.confidence >= 0.9;

  return {
    id: input.id,
    label: input.label,
    status: confident ? 'pass' : 'review',
    severity: confident ? 'note' : 'minor',
    summary: confident
      ? `Extracted ${input.label.toLowerCase()} is available for standalone review.`
      : 'Low extraction confidence.',
    details: confident
      ? 'No application value was supplied, so this row preserves the extracted label text without a comparison verdict.'
      : 'No application value was supplied, and extraction confidence is too low to auto-pass this row.',
    confidence: input.extractedField.confidence,
    citations: citationsFor(input.extraction.beverageType),
    extractedValue: input.extractedValue,
    comparison: {
      status: 'not-applicable',
      note: 'No application value was supplied for standalone review.'
    }
  };
}

function buildForbiddenMaltAbvCheck(input: {
  label: string;
  applicationValue: string | undefined;
  extractedValue: string | undefined;
  confidence: number;
}): CheckReview {
  return {
    id: 'alcohol-content',
    label: input.label,
    status: 'fail',
    severity: 'major',
    summary: 'ABV uses a forbidden format.',
    details:
      'Malt beverage alcohol statements must use a percentage-of-alcohol-by-volume form such as "5.2% Alc./Vol." The available value uses "ABV," which is not permitted.',
    confidence: input.confidence,
    citations: MALT_ABV_CITATIONS,
    applicationValue: input.applicationValue,
    extractedValue: input.extractedValue,
    comparison: input.applicationValue
      ? {
          status: 'value-mismatch',
          applicationValue: input.applicationValue,
          extractedValue: input.extractedValue,
          note: 'Format is disallowed for malt beverages.'
        }
      : {
          status: 'not-applicable',
          note: 'The extracted value uses a format that is disallowed for malt beverages.'
        }
  };
}

function buildCrossFieldChecks(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview[] {
  const checks: CheckReview[] = [];

  if (input.extraction.beverageType === 'distilled-spirits') {
    checks.push(buildSpiritsSameFieldOfVisionCheck(input));
  }

  if (input.extraction.beverageType === 'wine') {
    const wineCheck = buildWineVintageAppellationCheck(input);
    if (wineCheck) {
      checks.push(wineCheck);
    }
  }

  if (input.extraction.beverageType === 'malt-beverage') {
    const maltCheck = buildMaltAbvFormatCheck(input);
    if (maltCheck) {
      checks.push(maltCheck);
    }
  }

  return checks;
}

function buildSpiritsSameFieldOfVisionCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview {
  if (input.intake.standalone) {
    return {
      id: 'same-field-of-vision',
      label: 'Same field of vision',
      status: 'info',
      severity: 'note',
      summary: 'Cross-field dependency skipped in standalone mode.',
      details:
        'Application-backed spatial checks are skipped when no application form was provided.',
      confidence: 1,
      citations: DISTILLED_CITATIONS
    };
  }

  return {
    id: 'same-field-of-vision',
    label: 'Same field of vision',
    status: 'review',
    severity: 'major',
    summary: 'Same-field-of-vision still needs human confirmation.',
    details:
      'Brand name, class/type, and alcohol content must appear in the same field of vision for distilled spirits labels. This build does not yet have spatial evidence strong enough to auto-pass or auto-fail that rule.',
    confidence: input.extraction.imageQuality.state === 'ok' ? 0.54 : 0.42,
    citations: [
      '27 CFR 5.61 mandatory label information',
      'TTB distilled spirits same field of vision guidance'
    ]
  };
}

function buildWineVintageAppellationCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview | null {
  const hasVintageClaim = Boolean(
    input.intake.fields.vintage || input.extraction.fields.vintage.present
  );
  if (!hasVintageClaim) {
    return null;
  }

  const hasAppellation = Boolean(
    input.intake.fields.appellation || input.extraction.fields.appellation.present
  );

  if (!hasAppellation) {
    return {
      id: 'vintage-requires-appellation',
      label: 'Vintage requires appellation',
      status: 'fail',
      severity: 'major',
      summary: 'Appellation missing while vintage is present.',
      details:
        'When a vintage date is shown on a wine label, an appellation of origin must also be shown. This is a clear dependency failure.',
      confidence: 0.94,
      citations: ['27 CFR 4.34']
    };
  }

  return {
    id: 'vintage-requires-appellation',
    label: 'Vintage requires appellation',
    status: 'pass',
    severity: 'note',
    summary: 'Vintage claim is paired with an appellation.',
    details:
      'The wine label includes an appellation alongside the vintage claim, so the dependency is satisfied.',
    confidence: 0.94,
    citations: ['27 CFR 4.34']
  };
}

function buildMaltAbvFormatCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview | null {
  const alcoholValue =
    input.extraction.fields.alcoholContent.value ?? input.intake.fields.alcoholContent;

  if (!alcoholValue) {
    return null;
  }

  if (!/\bABV\b/i.test(alcoholValue)) {
    return {
      id: 'abv-format-permitted',
      label: 'ABV format permitted for beverage type',
      status: 'pass',
      severity: 'note',
      summary: 'Alcohol statement uses permitted wording.',
      details:
        'The alcohol statement uses an "Alc./Vol." style format that is acceptable for malt beverages.',
      confidence: 0.96,
      citations: MALT_ABV_CITATIONS
    };
  }

  return {
    id: 'abv-format-permitted',
    label: 'ABV format permitted for beverage type',
    status: 'fail',
    severity: 'major',
    summary: 'Malt beverage ABV must use "Alc./Vol." wording.',
    details:
      '27 CFR 7.65 requires malt beverage alcohol statements to use a percentage-of-alcohol-by-volume form such as "5.2% Alc./Vol." The available value uses "ABV," which is not permitted.',
    confidence: 0.98,
    citations: MALT_ABV_CITATIONS
  };
}

function compareFieldValues(
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

function countStatuses(
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

function deriveVerdict(input: {
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

function deriveVerdictSecondary(input: {
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

function deriveSummary(input: {
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

function buildExtractionQualityNote(extraction: ReviewExtraction) {
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

function citationsFor(beverageType: BeverageType) {
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

function normalizeExact(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeCosmetic(value: string) {
  return normalizeExact(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function missingFieldConfidence(extraction: ReviewExtraction) {
  return Math.max(0.25, extraction.imageQuality.score * 0.6);
}

function hasForbiddenMaltAbvFormat(
  extraction: ReviewExtraction,
  applicationValue: string | undefined,
  extractedValue: string | undefined
) {
  if (extraction.beverageType !== 'malt-beverage') {
    return false;
  }

  return /\bABV\b/i.test(extractedValue ?? applicationValue ?? '');
}
