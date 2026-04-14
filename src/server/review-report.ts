import {
  verificationReportSchema,
  type CheckReview,
  type ReviewExtraction,
  type VerificationReport
} from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import { buildCrossFieldChecks } from './review-report-cross-field';
import { buildFieldChecks } from './review-report-field-checks';
import {
  buildExtractionQualityNote,
  countStatuses,
  deriveSummary,
  deriveVerdict,
  deriveVerdictSecondary
} from './review-report-helpers';

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
