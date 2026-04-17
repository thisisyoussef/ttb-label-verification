import {
  OCR_FALLBACK_SENTINEL,
  type CheckReview,
  type ReviewExtraction,
  type ReviewExtractionField
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
import { extractFieldsFromOcrText } from './ocr-field-extractor';

/**
 * When the VLM reports a field as not-present but the Tesseract OCR
 * prepass caught text at the right regex position, surface that text
 * as a "likely" best guess instead of leaving the label side blank.
 *
 * Returns `null` when there's no OCR text, the text is too short to
 * be trustworthy, or the OCR regex didn't recognize the field shape.
 */
function tryOcrFallbackValue(
  spec: FieldSpec,
  ocrText: string | undefined
): { value: string; confidence: number } | null {
  if (!ocrText || ocrText.length < 20) return null;
  const parsed = extractFieldsFromOcrText(ocrText);
  if (!parsed) return null;
  const field = parsed.fields[spec.extractionKey];
  if (!field?.present || !field.value || field.value.trim().length === 0) {
    return null;
  }
  return { value: field.value, confidence: field.confidence };
}

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
      label: input.spec.label,
      ocrFallback: extractedField.present ? null : tryOcrFallbackValue(input.spec, input.intake.ocrText)
    });
  }

  if (!extractedField.present || !extractedValue) {
    const ocrGuess = tryOcrFallbackValue(input.spec, input.intake.ocrText);
    if (ocrGuess) {
      return {
        id: input.spec.id,
        label: input.spec.label,
        status: 'review',
        severity: 'minor',
        summary: `Label ${OCR_FALLBACK_SENTINEL}: ${ocrGuess.value}.`,
        details:
          'Our vision model did not read this field cleanly, so we fell back to the label text directly. A human reviewer should confirm the value.',
        confidence: Math.min(ocrGuess.confidence, missingFieldConfidence(input.extraction) || ocrGuess.confidence),
        citations: citationsFor(input.extraction.beverageType),
        applicationValue,
        extractedValue: ocrGuess.value,
        comparison: {
          status: 'value-mismatch',
          applicationValue,
          extractedValue: ocrGuess.value,
          note: `This value is ${OCR_FALLBACK_SENTINEL} — the vision model did not read it cleanly, so we read the label text directly.`
        }
      };
    }

    return {
      id: input.spec.id,
      label: input.spec.label,
      status: 'review',
      severity: 'major',
      summary: `Could not read ${input.spec.label.toLowerCase()} from the label.`,
      details:
        'The approved record shows a value, but we could not read it clearly on the label. A human reviewer should check this one.',
      confidence: missingFieldConfidence(input.extraction),
      citations: citationsFor(input.extraction.beverageType),
      applicationValue,
      comparison: {
        status: 'value-mismatch',
        applicationValue,
        note: 'Could not read this field from the label.'
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
      summary: judgment.disposition === 'approve' ? 'Label matches the approved record.' : judgment.note,
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
      summary: 'Label matches the approved record.',
      details:
        'The label and the approved record show the same value.',
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
        ? 'Small cosmetic difference.'
        : 'Label does not match the approved record.',
    details:
      comparison.status === 'case-mismatch'
        ? 'Only casing, spacing, or punctuation differs. Take a quick look and confirm.'
        : 'The label does not match what was approved. A human reviewer should check this one.',
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
  ocrFallback: { value: string; confidence: number } | null;
}): CheckReview | null {
  if (!input.extractedField.present || !input.extractedValue) {
    if (input.ocrFallback) {
      return {
        id: input.id,
        label: input.label,
        status: 'review',
        severity: 'minor',
        summary: `Label ${OCR_FALLBACK_SENTINEL}: ${input.ocrFallback.value}.`,
        details:
          'No application data was provided. Our vision model did not read this field cleanly, so we fell back to the label text directly. Confirm the value.',
        confidence: input.ocrFallback.confidence,
        citations: citationsFor(input.extraction.beverageType),
        extractedValue: input.ocrFallback.value,
        comparison: {
          status: 'not-applicable',
          extractedValue: input.ocrFallback.value,
          note: `This value is ${OCR_FALLBACK_SENTINEL} — the vision model did not read it cleanly, so we read the label text directly.`
        }
      };
    }
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
      ? `Label shows ${input.extractedValue}.`
      : 'The label image is hard to read.',
    details: confident
      ? 'No application data was provided to compare against. Confirm the label reads correctly.'
      : 'No application data was provided, and the label image is too unclear to be confident.',
    confidence: input.extractedField.confidence,
    citations: citationsFor(input.extraction.beverageType),
    extractedValue: input.extractedValue,
    comparison: {
      status: 'not-applicable',
      note: 'No application data was provided.'
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
    summary: 'ABV wording is not allowed on beer labels.',
    details:
      'Beer labels must show alcohol content like "5.2% Alc./Vol." The word "ABV" is not allowed.',
    confidence: input.confidence,
    citations: MALT_ABV_CITATIONS,
    applicationValue: input.applicationValue,
    extractedValue: input.extractedValue,
    comparison: input.applicationValue
      ? {
          status: 'value-mismatch',
          applicationValue: input.applicationValue,
          extractedValue: input.extractedValue,
          note: 'This wording is not allowed on beer labels.'
        }
      : {
          status: 'not-applicable',
          note: 'The label uses wording that is not allowed on beer labels.'
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
