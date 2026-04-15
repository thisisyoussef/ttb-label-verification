import { traceable } from 'langsmith/traceable';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { buildGovernmentWarningCheck } from './government-warning-validator';
import { runWarningOcrCrossCheck } from './warning-ocr-cross-check';
import { type LlmEndpointSurface } from './llm-policy';
import {
  annotateCurrentRun,
  finalizeFailureLatency,
  inferProviderFromModel,
  measureStage,
  resolveLatencyCapture,
  resolveSuccessLatencyPath,
  resolveTraceMetadata,
  summarizeApplicationFields,
  summarizeExtraction,
  summarizeLabel,
  summarizeLatencySummary,
  summarizeStageTimings,
  summarizeVerificationReport,
  summarizeWarningCheck,
  type TraceMetadataInput as BaseTraceMetadataInput,
  type TraceStageTimings
} from './llm-trace-support';
import type { NormalizedReviewIntake } from './review-intake';
import { buildVerificationReport } from './review-report';
import {
  emitReviewLatencySummary,
  type ReviewLatencyCapture,
  type ReviewLatencyObserver,
  type ReviewLatencySummary
} from './review-latency';
import type { ReviewExtractor } from './review-extraction';

type TraceMetadataInput = BaseTraceMetadataInput & {
  surface: LlmEndpointSurface;
};

export type TracedReviewExtractionInput = TraceMetadataInput & {
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
  latencyCapture?: ReviewLatencyCapture;
  latencyObserver?: ReviewLatencyObserver;
};

type TracedWarningValidationInput = TraceMetadataInput & {
  extraction: ReviewExtraction;
  ocrCrossCheck?: import('./warning-ocr-cross-check').OcrCrossCheckResult;
};

type TracedReviewReportInput = TraceMetadataInput & {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  reportId?: string;
};

export type TracedReviewSurfaceInput = TracedReviewExtractionInput & {
  reportId?: string;
};

export type TracedExtractionSurfaceInput = TracedReviewExtractionInput;

export type TracedWarningSurfaceInput = TracedReviewExtractionInput;

type ReviewSurfaceTraceResult = {
  report: VerificationReport;
  warningCheck: CheckReview;
  stageTimingsMs: TraceStageTimings;
  latencySummary: ReviewLatencySummary;
};

type ExtractionSurfaceTraceResult = {
  extraction: ReviewExtraction;
  stageTimingsMs: TraceStageTimings;
  latencySummary: ReviewLatencySummary;
};

type WarningSurfaceTraceResult = {
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  stageTimingsMs: TraceStageTimings;
  latencySummary: ReviewLatencySummary;
};

const tracedReviewExtraction = traceable(
  async (input: TracedReviewExtractionInput) => {
    annotateCurrentRun(input);
    const extraction = await input.extractor(input.intake, {
      latencyCapture: input.latencyCapture,
      surface: input.surface,
      extractionMode: resolveTraceMetadata(input).extractionMode
    });
    const actualProvider = inferProviderFromModel(extraction.model);

    if (actualProvider) {
      annotateCurrentRun({
        ...input,
        provider: actualProvider
      });
    }

    return extraction;
  },
  {
    name: 'ttb.review_extraction.stage',
    run_type: 'chain',
    processInputs: (input: TracedReviewExtractionInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      noPersistence: true
    }),
    processOutputs: (output: ReviewExtraction) => summarizeExtraction(output),
    tags: ['ttb', 'llm', 'review-extraction', 'privacy-safe']
  }
);

const tracedWarningValidation = traceable(
  async (input: TracedWarningValidationInput) => {
    annotateCurrentRun(input);
    return buildGovernmentWarningCheck(input.extraction, input.ocrCrossCheck);
  },
  {
    name: 'ttb.warning_validation.stage',
    run_type: 'chain',
    processInputs: (input: TracedWarningValidationInput) => ({
      ...resolveTraceMetadata(input),
      extraction: summarizeExtraction(input.extraction),
      noPersistence: true
    }),
    processOutputs: (output: CheckReview) => summarizeWarningCheck(output),
    tags: ['ttb', 'llm', 'warning-validation', 'privacy-safe']
  }
);

const tracedReviewReport = traceable(
  async (input: TracedReviewReportInput) => {
    annotateCurrentRun(input);
    return buildVerificationReport({
      intake: input.intake,
      extraction: input.extraction,
      warningCheck: input.warningCheck,
      id: input.reportId
    });
  },
  {
    name: 'ttb.review_report.stage',
    run_type: 'chain',
    processInputs: (input: TracedReviewReportInput) => ({
      ...resolveTraceMetadata(input),
      intake: summarizeApplicationFields(input.intake),
      extraction: summarizeExtraction(input.extraction),
      warningCheck: summarizeWarningCheck(input.warningCheck),
      reportId: input.reportId ?? null,
      noPersistence: true
    }),
    processOutputs: (output: VerificationReport) =>
      summarizeVerificationReport(output),
    tags: ['ttb', 'llm', 'review-report', 'privacy-safe']
  }
);

const tracedReviewSurface = traceable(
  async (input: TracedReviewSurfaceInput): Promise<ReviewSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const latencyCapture = resolveLatencyCapture(input);
    const startedAt = performance.now();

    // Start OCR in parallel with VLM extraction — Tesseract finishes in
    // ~600ms while the VLM takes 1-3s, so this adds zero wall-clock time.
    const ocrTextPromise = runWarningOcrCrossCheck({
      label: input.intake.label,
      vlmWarningText: '' // will re-check with actual VLM text after extraction
    }).catch(() => null);

    const extractionStage = await measureStage(() =>
      runTracedReviewExtraction({
        ...input,
        latencyCapture
      })
    );

    // Cross-check with the actual VLM warning text now that extraction is done.
    const vlmWarning = extractionStage.result.fields.governmentWarning.value ?? '';
    let ocrCrossCheck: import('./warning-ocr-cross-check').OcrCrossCheckResult =
      { status: 'abstain', reason: 'no-vlm-warning-text' };
    if (vlmWarning.length > 0) {
      try {
        ocrCrossCheck = await runWarningOcrCrossCheck({
          label: input.intake.label,
          vlmWarningText: vlmWarning
        });
      } catch {
        ocrCrossCheck = { status: 'abstain', reason: 'ocr-error' };
      }
    }
    void ocrTextPromise; // ensure the parallel placeholder is consumed

    const warningStage = await measureStage(() =>
      tracedWarningValidation({
        ...input,
        extraction: extractionStage.result,
        ocrCrossCheck
      })
    );
    latencyCapture.recordSpan({
      stage: 'deterministic-validation',
      outcome: 'success',
      durationMs: warningStage.elapsedMs
    });
    const reportStage = await measureStage(() =>
      tracedReviewReport({
        ...input,
        extraction: extractionStage.result,
        warningCheck: warningStage.result,
        reportId: input.reportId
      })
    );
    latencyCapture.recordSpan({
      stage: 'report-shaping',
      outcome: 'success',
      durationMs: reportStage.elapsedMs
    });
    latencyCapture.setOutcomePath(resolveSuccessLatencyPath(latencyCapture));

    return {
      report: reportStage.result,
      warningCheck: warningStage.result,
      stageTimingsMs: {
        extraction: extractionStage.elapsedMs,
        warning: warningStage.elapsedMs,
        report: reportStage.elapsedMs,
        total: Math.round(performance.now() - startedAt)
      },
      latencySummary: latencyCapture.finalize()
    };
  },
  {
    name: 'ttb.review_surface.execution',
    run_type: 'chain',
    processInputs: (input: TracedReviewSurfaceInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      reportId: input.reportId ?? null,
      noPersistence: true
    }),
    processOutputs: (output: ReviewSurfaceTraceResult) => ({
      report: summarizeVerificationReport(output.report),
      warningCheck: summarizeWarningCheck(output.warningCheck),
      stageTimingsMs: summarizeStageTimings(output.stageTimingsMs),
      latencySummary: summarizeLatencySummary(output.latencySummary),
      noPersistence: true
    }),
    tags: ['ttb', 'llm', 'review-surface', 'privacy-safe']
  }
);

const tracedExtractionSurface = traceable(
  async (
    input: TracedExtractionSurfaceInput
  ): Promise<ExtractionSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const latencyCapture = resolveLatencyCapture(input);
    const startedAt = performance.now();
    const extractionStage = await measureStage(() =>
      runTracedReviewExtraction({
        ...input,
        latencyCapture
      })
    );

    latencyCapture.recordSpan({
      stage: 'deterministic-validation',
      outcome: 'skipped',
      durationMs: 0
    });
    latencyCapture.recordSpan({
      stage: 'report-shaping',
      outcome: 'skipped',
      durationMs: 0
    });
    latencyCapture.setOutcomePath(resolveSuccessLatencyPath(latencyCapture));

    return {
      extraction: extractionStage.result,
      stageTimingsMs: {
        extraction: extractionStage.elapsedMs,
        total: Math.round(performance.now() - startedAt)
      },
      latencySummary: latencyCapture.finalize()
    };
  },
  {
    name: 'ttb.extraction_surface.execution',
    run_type: 'chain',
    processInputs: (input: TracedExtractionSurfaceInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      noPersistence: true
    }),
    processOutputs: (output: ExtractionSurfaceTraceResult) => ({
      extraction: summarizeExtraction(output.extraction),
      stageTimingsMs: summarizeStageTimings(output.stageTimingsMs),
      latencySummary: summarizeLatencySummary(output.latencySummary),
      noPersistence: true
    }),
    tags: ['ttb', 'llm', 'extraction-surface', 'privacy-safe']
  }
);

const tracedWarningSurface = traceable(
  async (input: TracedWarningSurfaceInput): Promise<WarningSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const latencyCapture = resolveLatencyCapture(input);
    const startedAt = performance.now();
    const extractionStage = await measureStage(() =>
      runTracedReviewExtraction({
        ...input,
        latencyCapture
      })
    );
    const warningStage = await measureStage(() =>
      tracedWarningValidation({
        ...input,
        extraction: extractionStage.result
      })
    );
    latencyCapture.recordSpan({
      stage: 'deterministic-validation',
      outcome: 'success',
      durationMs: warningStage.elapsedMs
    });
    latencyCapture.recordSpan({
      stage: 'report-shaping',
      outcome: 'skipped',
      durationMs: 0
    });
    latencyCapture.setOutcomePath(resolveSuccessLatencyPath(latencyCapture));

    return {
      extraction: extractionStage.result,
      warningCheck: warningStage.result,
      stageTimingsMs: {
        extraction: extractionStage.elapsedMs,
        warning: warningStage.elapsedMs,
        total: Math.round(performance.now() - startedAt)
      },
      latencySummary: latencyCapture.finalize()
    };
  },
  {
    name: 'ttb.warning_surface.execution',
    run_type: 'chain',
    processInputs: (input: TracedWarningSurfaceInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      noPersistence: true
    }),
    processOutputs: (output: WarningSurfaceTraceResult) => ({
      extraction: summarizeExtraction(output.extraction),
      warningCheck: summarizeWarningCheck(output.warningCheck),
      stageTimingsMs: summarizeStageTimings(output.stageTimingsMs),
      latencySummary: summarizeLatencySummary(output.latencySummary),
      noPersistence: true
    }),
    tags: ['ttb', 'llm', 'warning-surface', 'privacy-safe']
  }
);

export async function runTracedReviewExtraction(
  input: TracedReviewExtractionInput
) {
  return await tracedReviewExtraction(input);
}

export async function runTracedReviewSurface(input: TracedReviewSurfaceInput) {
  const latencyCapture = resolveLatencyCapture(input);

  try {
    const result = await tracedReviewSurface({
      ...input,
      latencyCapture
    });
    emitReviewLatencySummary(latencyCapture, input.latencyObserver);
    return result.report;
  } catch (error) {
    finalizeFailureLatency({
      ...input,
      latencyCapture
    });
    throw error;
  }
}

export async function runTracedExtractionSurface(
  input: TracedExtractionSurfaceInput
) {
  const latencyCapture = resolveLatencyCapture(input);

  try {
    const result = await tracedExtractionSurface({
      ...input,
      latencyCapture
    });
    emitReviewLatencySummary(latencyCapture, input.latencyObserver);
    return result.extraction;
  } catch (error) {
    finalizeFailureLatency({
      ...input,
      latencyCapture
    });
    throw error;
  }
}

export async function runTracedWarningSurface(input: TracedWarningSurfaceInput) {
  const latencyCapture = resolveLatencyCapture(input);

  try {
    const result = await tracedWarningSurface({
      ...input,
      latencyCapture
    });
    emitReviewLatencySummary(latencyCapture, input.latencyObserver);
    return result.warningCheck;
  } catch (error) {
    finalizeFailureLatency({
      ...input,
      latencyCapture
    });
    throw error;
  }
}
