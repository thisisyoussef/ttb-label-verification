// OCR fast-exit for blank / non-label images.
//
// The OCR pre-pass (Tesseract) runs in parallel with the VLM call.
// When Tesseract returns zero characters, the image almost certainly
// isn't a TTB label — real labels are required by law to carry the
// government warning text, so "no text at all" is a very strong
// negative signal. This module builds the short-circuit response so
// the user sees a "no text detected" verdict immediately instead of
// waiting 3-7s for the VLM to confirm what Tesseract told us in ~1s.
//
// Extracted out of llm-trace.ts to keep that file under the source
// size cap.

import type { CheckReview, ReviewExtraction, VerificationReport } from '../../shared/contracts/review';
import { buildGovernmentWarningCheck } from '../validators/government-warning-validator';
import {
  buildNoTextExtractionModelOutput,
  finalizeReviewExtraction
} from '../extractors/review-extraction';
import type { NormalizedReviewIntake } from '../review/review-intake';
import type {
  ReviewLatencyCapture,
  ReviewLatencyStage,
  ReviewLatencySummary
} from '../review/review-latency';
import { buildVerificationReport } from '../review/review-report';
import { resolveSuccessLatencyPath, type TraceStageTimings } from './llm-trace-support';

const SKIPPED_STAGES: ReviewLatencyStage[] = [
  'warning-ocv',
  'deterministic-validation',
  'report-shaping'
];

export type NoTextShortCircuitInput = {
  intake: NormalizedReviewIntake;
  reportId?: string;
  ocrDurationMs: number;
  surfaceStartedAt: number;
  latencyCapture: ReviewLatencyCapture;
  /**
   * In-flight promises to mark as handled. VLM/OCV/anchor promises
   * were started in parallel with OCR; we swallow their eventual
   * settlement so pending rejections don't surface as unhandled.
   * Not cancelled — plumbing an external AbortSignal through every
   * extractor is invasive for a marginal cost win on an uncommon
   * input.
   */
  pending: Array<Promise<unknown>>;
};

export type NoTextShortCircuitResult = {
  report: VerificationReport;
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  stageTimingsMs: TraceStageTimings;
  latencySummary: ReviewLatencySummary;
};

export async function buildNoTextShortCircuit(
  input: NoTextShortCircuitInput
): Promise<NoTextShortCircuitResult> {
  for (const p of input.pending) {
    void p.catch(() => {});
  }

  input.latencyCapture.recordSpan({
    stage: 'ocr-prepass',
    outcome: 'fast-fail',
    durationMs: input.ocrDurationMs
  });
  for (const stage of SKIPPED_STAGES) {
    input.latencyCapture.recordSpan({ stage, outcome: 'skipped', durationMs: 0 });
  }

  const extraction = finalizeReviewExtraction({
    intake: input.intake,
    model: 'ocr-prepass-no-text',
    extracted: buildNoTextExtractionModelOutput()
  });
  const warningCheck = buildGovernmentWarningCheck(extraction);
  const report = await buildVerificationReport({
    intake: input.intake,
    extraction,
    warningCheck,
    id: input.reportId
  });

  input.latencyCapture.setOutcomePath(
    resolveSuccessLatencyPath(input.latencyCapture)
  );

  return {
    report,
    extraction,
    warningCheck,
    stageTimingsMs: {
      extraction: input.ocrDurationMs,
      warning: 0,
      report: 0,
      total: Math.round(performance.now() - input.surfaceStartedAt)
    },
    latencySummary: input.latencyCapture.finalize()
  };
}
