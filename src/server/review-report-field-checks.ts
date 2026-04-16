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
import {
  judgeAlcoholContent,
  judgeApplicantAddress,
  judgeBrandName,
  judgeClassType,
  judgeCountryOfOrigin,
  judgeNetContents,
  type FieldJudgment
} from './judgment-field-rules';

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

  // Use field-specific judgment rules when available
  const judgment = runFieldJudgment(input.spec.id, applicationValue, extractedValue, input.extraction.beverageType);
  if (judgment) {
    const rawMatch = applicationValue.trim() === extractedValue.trim();
    const comparisonStatus = judgment.disposition === 'approve'
      ? (rawMatch ? 'match' as const : 'case-mismatch' as const)
      : 'value-mismatch' as const;
    return {
      id: input.spec.id, label: input.spec.label,
      status: judgment.disposition === 'approve' ? 'pass' : judgment.disposition === 'reject' ? 'fail' : 'review',
      severity: judgment.disposition === 'approve' ? 'note' : judgment.disposition === 'reject' ? 'major' : (judgment.confidence >= 0.8 ? 'minor' : 'major'),
      summary: judgment.disposition === 'approve' ? 'Matches the application value.' : judgment.note,
      details: `[${judgment.rule}] ${judgment.note}`,
      confidence: judgment.confidence, citations: citationsFor(input.extraction.beverageType),
      applicationValue, extractedValue,
      comparison: { status: comparisonStatus, applicationValue, extractedValue, note: `[${judgment.rule}] ${judgment.note}` }
    };
  }

  // Fallback to old comparison for fields without specific rules
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

function runFieldJudgment(fieldId: string, applicationValue: string, extractedValue: string, beverageType: string): FieldJudgment | null {
  switch (fieldId) {
    case 'brand-name': return judgeBrandName(applicationValue, extractedValue);
    case 'class-type': return judgeClassType(applicationValue, extractedValue, beverageType);
    case 'alcohol-content': return judgeAlcoholContent(applicationValue, extractedValue, beverageType);
    case 'net-contents': return judgeNetContents(applicationValue, extractedValue);
    case 'applicant-address': return judgeApplicantAddress(applicationValue, extractedValue);
    case 'country-of-origin': return judgeCountryOfOrigin(applicationValue, extractedValue);
    default: return null;
  }
}
