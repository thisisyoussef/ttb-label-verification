import type {
  CheckReview,
  ReviewExtraction,
  ReviewExtractionField
} from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import {
  citationsFor,
  compareFieldValues,
  FIELD_SPECS,
  hasForbiddenMaltAbvFormat,
  MALT_ABV_CITATIONS,
  missingFieldConfidence,
  type FieldSpec
} from './review-report-helpers';

export function buildFieldChecks(input: {
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

  if (
    input.spec.id === 'alcohol-content' &&
    hasForbiddenMaltAbvFormat(input.extraction, applicationValue, extractedValue)
  ) {
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
