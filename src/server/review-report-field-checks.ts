import {
  OCR_FALLBACK_SENTINEL,
  type CheckReview,
  type ReviewExtraction,
  type ReviewExtractionField
} from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import {
  findPriorityLiteralAnchorForCheck,
  maybeUpgradeChecksWithAnchors
} from './review-report-anchor-upgrade';
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
import type { AnchorTrackResult } from './anchor-field-track';

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
  anchorTrack?: AnchorTrackResult | null;
}): CheckReview[] {
  const anchorTrack = input.anchorTrack ?? null;
  const checks = FIELD_SPECS
    .map((spec) => buildFieldCheck({ ...input, spec }))
    .filter((check): check is CheckReview => check !== null);
  return maybeUpgradeChecksWithAnchors(checks, anchorTrack);
}

function buildFieldCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  spec: FieldSpec;
  anchorTrack?: AnchorTrackResult | null;
}): CheckReview | null {
  const applicationValue = input.intake.fields[input.spec.intakeKey];
  const extractedField = input.extraction.fields[input.spec.extractionKey];
  // Verification-mode populates `visibleText` with the exact label text.
  // Prefer it when present; fall back to the bottom-up `value` otherwise.
  // Both paths coexist so existing consumers keep working during rollout.
  const extractedValue = extractedField.present
    ? (extractedField.visibleText?.trim() || extractedField.value)
    : undefined;
  const alternativeReading = extractedField.alternativeReading?.trim() || undefined;

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

  const priorityLiteralAnchor = findPriorityLiteralAnchorForCheck(
    input.spec.id,
    input.anchorTrack ?? null
  );

  if (priorityLiteralAnchor) {
    return buildLiteralAnchorPriorityCheck({
      id: input.spec.id,
      label: input.spec.label,
      beverageType: input.extraction.beverageType,
      applicationValue,
      extractedField
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
    // Verification-mode: the model reported a DIFFERENT prominent value
    // in the expected position. Downgrade an otherwise-passing judgment
    // to review so the human sees the mismatch, and surface the
    // alternative in the comparison note.
    const hasConflictingAlternative = Boolean(
      alternativeReading &&
        alternativeReading.toLowerCase() !== extractedValue.toLowerCase() &&
        alternativeReadingForcesReview({
          fieldId: input.spec.id,
          applicationValue,
          alternativeReading,
          beverageType: input.extraction.beverageType
        })
    );
    const effectiveDisposition =
      judgment.disposition === 'approve' && hasConflictingAlternative
        ? 'review'
        : judgment.disposition;
    const comparisonStatus = effectiveDisposition === 'approve'
      ? (rawMatch ? 'match' as const : 'case-mismatch' as const)
      : 'value-mismatch' as const;
    const altNote = hasConflictingAlternative
      ? ` The label also appears to show "${alternativeReading}" — a human reviewer should take a look.`
      : '';
    return {
      id: input.spec.id, label: input.spec.label,
      status: effectiveDisposition === 'approve' ? 'pass' : effectiveDisposition === 'reject' ? 'fail' : 'review',
      severity: effectiveDisposition === 'approve' ? 'note' : effectiveDisposition === 'reject' ? 'major' : (judgment.confidence >= 0.8 ? 'minor' : 'major'),
      summary: effectiveDisposition === 'approve'
        ? 'Label matches the approved record.'
        : hasConflictingAlternative
          ? `Label appears to show "${alternativeReading}" where the approved value was expected.`
          : judgment.note,
      details: `[${judgment.rule}] ${judgment.note}${altNote}`,
      confidence: judgment.confidence, citations: citationsFor(input.extraction.beverageType),
      applicationValue, extractedValue,
      comparison: { status: comparisonStatus, applicationValue, extractedValue, note: `[${judgment.rule}] ${judgment.note}${altNote}` }
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

function buildLiteralAnchorPriorityCheck(input: {
  id: string;
  label: string;
  beverageType: ReviewExtraction['beverageType'];
  applicationValue: string;
  extractedField: ReviewExtractionField;
}): CheckReview {
  return {
    id: input.id,
    label: input.label,
    status: 'pass',
    severity: 'note',
    summary: 'Label matches the approved record.',
    details: 'The approved value is clearly printed on the label.',
    confidence: Math.max(input.extractedField.confidence, 0.9),
    citations: citationsFor(input.beverageType),
    applicationValue: input.applicationValue,
    extractedValue: input.applicationValue,
    comparison: {
      status: 'match',
      applicationValue: input.applicationValue,
      extractedValue: input.applicationValue,
      note: 'The approved value is clearly printed on the label.'
    }
  };
}

function alternativeReadingForcesReview(input: {
  fieldId: string;
  applicationValue: string;
  alternativeReading: string;
  beverageType: string;
}): boolean {
  const normalizedApp = input.applicationValue.trim().toLowerCase();
  const normalizedAlt = input.alternativeReading.trim().toLowerCase();

  if (normalizedAlt === normalizedApp) {
    return false;
  }

  const alternativeJudgment = runFieldJudgment(
    input.fieldId,
    input.applicationValue,
    input.alternativeReading,
    input.beverageType
  );
  if (alternativeJudgment?.disposition === 'approve') {
    return false;
  }

  if (!alternativeJudgment) {
    const comparison = compareFieldValues(input.applicationValue, input.alternativeReading);
    if (comparison.status === 'match' || comparison.status === 'case-mismatch') {
      return false;
    }
  }

  return true;
}

function buildStandaloneFieldCheck(input: {
  extraction: ReviewExtraction;
  extractedField: ReviewExtractionField;
  extractedValue: string | undefined;
  id: string;
  label: string;
  ocrFallback: { value: string; confidence: number } | null;
}): CheckReview | null {
  // The application form was left blank for this field. There's no
  // approved value to compare against, so the row is informational
  // only — whatever we find on the label is "found, not matched".
  // It always gets status='pass' (which renders as the green
  // "Found on label" badge in the UI), regardless of how confident
  // the extractor was, so the reviewer doesn't see a "Needs review"
  // pill on a row that isn't actually a comparison failure.
  // Government warning is checked elsewhere by buildGovernmentWarningCheck
  // and never routes through here.
  if (!input.extractedField.present || !input.extractedValue) {
    if (input.ocrFallback) {
      return {
        id: input.id,
        label: input.label,
        status: 'pass',
        severity: 'note',
        summary: `Found on the label: ${input.ocrFallback.value}.`,
        details:
          'This field was not filled in the application data, so there was nothing to compare against. The vision model did not read this field cleanly, so we read the value above directly off the label image — confirm it reads correctly.',
        confidence: input.ocrFallback.confidence,
        citations: citationsFor(input.extraction.beverageType),
        extractedValue: input.ocrFallback.value,
        comparison: {
          status: 'not-applicable',
          extractedValue: input.ocrFallback.value,
          note: 'No matching value was provided in the application data.'
        }
      };
    }
    return null;
  }

  const lowConfidence =
    input.extraction.imageQuality.state !== 'ok' || input.extractedField.confidence < 0.9;

  return {
    id: input.id,
    label: input.label,
    status: 'pass',
    severity: 'note',
    summary: lowConfidence
      ? `Found on the label (image was a bit unclear): ${input.extractedValue}.`
      : `Found on the label: ${input.extractedValue}.`,
    details: lowConfidence
      ? 'This field was not filled in the application data, so there was nothing to compare against. The value above is what we read from the label image — the image is a bit unclear, so double-check the reading.'
      : 'This field was not filled in the application data, so there was nothing to compare against. The value above is what we read from the label image — confirm it reads correctly.',
    confidence: input.extractedField.confidence,
    citations: citationsFor(input.extraction.beverageType),
    extractedValue: input.extractedValue,
    comparison: {
      status: 'not-applicable',
      note: 'No matching value was provided in the application data.'
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
