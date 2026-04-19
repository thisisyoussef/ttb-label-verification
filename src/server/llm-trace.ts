import { traceable } from './trace-runtime';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { runWarningOcrCrossCheck } from './warning-ocr-cross-check';
import { runOcrPrepass, isOcrPrepassEnabled } from './ocr-prepass';
import { runWarningOcv, type WarningOcvResult } from './warning-region-ocv';
import { buildNoTextShortCircuit } from './llm-trace-no-text-exit';
import {
  runAnchorTrack,
  resolveAnchorMergeMode,
  type AnchorTrackResult
} from './anchor-field-track';
import { reconcileExtractionWithOcr } from './extraction-ocr-reconciler';
import { extractFieldsFromOcrText } from './ocr-field-extractor';
import { runVlmRegionDetection, isRegionDetectionEnabled } from './vlm-region-detector';
import { createJudgmentLlmClient } from './judgment-llm-client-factory';
import { mergeOcrAndVlm, applyRegionOverrides } from './extraction-merge';
import { resolveReviewJudgment } from './review-surface-judgment';
import {
  tracedReviewExtraction,
  tracedWarningValidation,
  tracedReviewReport,
  type TracedReviewExtractionInput
} from './llm-trace-stages';
import {
  annotateCurrentRun,
  finalizeFailureLatency,
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
  type TraceStageTimings
} from './llm-trace-support';
import {
  emitReviewLatencySummary,
  type ReviewLatencyObserver,
  type ReviewLatencySummary
} from './review-latency';
import {
  checkSpiritsColocation,
  isSpiritsColocationAvailable,
  type SpiritsColocationResult
} from './spirits-colocation-check';

export type { TracedReviewExtractionInput };

export type TracedReviewSurfaceInput = TracedReviewExtractionInput & {
  reportId?: string;
  latencyObserver?: ReviewLatencyObserver;
  deferResolver?: boolean;
};

export type TracedExtractionSurfaceInput = TracedReviewExtractionInput & {
  latencyObserver?: ReviewLatencyObserver;
};

export type TracedWarningSurfaceInput = TracedReviewExtractionInput & {
  latencyObserver?: ReviewLatencyObserver;
};

type ReviewSurfaceTraceResult = {
  report: VerificationReport;
  extraction: ReviewExtraction;
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

const tracedReviewSurface = traceable(
  async (input: TracedReviewSurfaceInput): Promise<ReviewSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const latencyCapture = resolveLatencyCapture(input);
    const startedAt = performance.now();

    let augmentedIntake = input.intake;
    let warningOcv: WarningOcvResult | undefined;

    const prepassEnabled = isOcrPrepassEnabled();
    const useSimplePipeline = process.env.EXTRACTION_PIPELINE?.trim().toLowerCase() === 'simple';

    const ocrPromise = prepassEnabled && !useSimplePipeline
      ? measureStage(() => runOcrPrepass(input.intake.label))
      : Promise.resolve(null);

    const ocvController = new AbortController();
    const ocvPromise = prepassEnabled
      ? measureStage(() =>
          runWarningOcv({ label: input.intake.label, signal: ocvController.signal })
        )
      : Promise.resolve(null);

    const vlmPromise = measureStage(() =>
      runTracedReviewExtraction({ ...input, intake: input.intake, latencyCapture })
    );
    vlmPromise.finally(() => ocvController.abort()).catch(() => {});

    const anchorMergeMode = resolveAnchorMergeMode();
    const anchorPromise: Promise<{ result: AnchorTrackResult | null; elapsedMs: number }> =
      anchorMergeMode === 'disabled'
        ? Promise.resolve({ result: null, elapsedMs: 0 })
        : measureStage(() => runAnchorTrack(input.intake.label, input.intake.fields));

    // OCR fast-exit: Tesseract returning zero characters is a strong
    // signal the image isn't a label. Await OCR first (~1-2s vs VLM's
    // 3-7s long pole -> no wall-clock regression on good labels). See
    // llm-trace-no-text-exit.ts for the synthetic-extraction path.
    const ocrStage = await ocrPromise;
    if (
      ocrStage?.result.status === 'failed' &&
      ocrStage.result.reason === 'no-text-extracted'
    ) {
      ocvController.abort();
      return buildNoTextShortCircuit({
        intake: input.intake,
        reportId: input.reportId,
        ocrDurationMs: ocrStage.elapsedMs,
        surfaceStartedAt: startedAt,
        latencyCapture,
        pending: [vlmPromise, ocvPromise, anchorPromise]
      });
    }

    // OCR has resolved; await the other three in parallel. Equivalent
    // in wall-clock to the old Promise.all([ocr, ocv, vlm, anchor]).
    const [ocvStage, vlmStage, anchorStage] = await Promise.all([
      ocvPromise,
      vlmPromise,
      anchorPromise
    ]);

    if (ocrStage) {
      latencyCapture.recordSpan({
        stage: 'ocr-prepass',
        outcome: ocrStage.result.status === 'failed' ? 'fast-fail' : 'success',
        durationMs: ocrStage.elapsedMs
      });
      if (ocrStage.result.status !== 'failed') {
        augmentedIntake = { ...input.intake, ocrText: ocrStage.result.text };
      }
    }
    if (ocvStage) {
      warningOcv = ocvStage.result;
      latencyCapture.recordSpan({
        stage: 'warning-ocv',
        outcome: warningOcv.status === 'error' ? 'fast-fail' : 'success',
        durationMs: ocvStage.elapsedMs
      });
    }
    if (anchorStage.result) {
      latencyCapture.recordSpan({
        stage: 'anchor-track',
        outcome: anchorStage.result.canFastApprove ? 'success' : 'fast-fail',
        durationMs: anchorStage.elapsedMs
      });
    }
    const anchorTrackForReport =
      anchorMergeMode === 'enabled' ? anchorStage.result : null;

    let extractionElapsedMs = vlmStage.elapsedMs;

    let extractionResult: ReviewExtraction;

    const ocrRegexOutput = augmentedIntake.ocrText
      ? extractFieldsFromOcrText(augmentedIntake.ocrText)
      : null;

    if (ocrRegexOutput) {
      const merged = mergeOcrAndVlm(ocrRegexOutput, vlmStage.result);
      extractionResult = merged;
    } else {
      extractionResult = vlmStage.result;
    }

    if (isRegionDetectionEnabled()) {
      const regionStage = await measureStage(() =>
        runVlmRegionDetection(input.intake.label)
      );
      latencyCapture.recordSpan({
        stage: 'region-detection',
        outcome: regionStage.result.regions.length > 0 ? 'success' : 'fast-fail',
        durationMs: regionStage.elapsedMs
      });
      extractionElapsedMs += regionStage.elapsedMs;

      extractionResult = applyRegionOverrides(extractionResult, regionStage.result.regions);
    }

    const { extraction: reconciledExtraction } = reconcileExtractionWithOcr(
      extractionResult,
      augmentedIntake.ocrText
    );

    const vlmWarning = reconciledExtraction.fields.governmentWarning.value ?? '';
    let ocrCrossCheck: import('./warning-ocr-cross-check').OcrCrossCheckResult =
      { status: 'abstain', reason: 'no-vlm-warning-text' };
    if (vlmWarning.length > 0) {
      try {
        ocrCrossCheck = await runWarningOcrCrossCheck({ label: input.intake.label, vlmWarningText: vlmWarning });
      } catch {
        ocrCrossCheck = { status: 'abstain', reason: 'ocr-error' };
      }
    }

    const warningStage = await measureStage(() =>
      tracedWarningValidation({ ...input, extraction: reconciledExtraction, ocrCrossCheck, warningOcv })
    );
    latencyCapture.recordSpan({
      stage: 'deterministic-validation',
      outcome: 'success',
      durationMs: warningStage.elapsedMs
    });

    let spiritsColocation: SpiritsColocationResult | null = null;
    if (
      reconciledExtraction.beverageType === 'distilled-spirits' &&
      isSpiritsColocationAvailable()
    ) {
      const colocationStage = await measureStage(() =>
        checkSpiritsColocation(input.intake.label)
      );
      spiritsColocation = colocationStage.result;
      latencyCapture.recordSpan({
        stage: 'spirits-colocation',
        outcome: spiritsColocation ? 'success' : 'fast-fail',
        durationMs: colocationStage.elapsedMs
      });
    }

    const reportStage = await measureStage(() =>
      tracedReviewReport({
        ...input,
        extraction: reconciledExtraction,
        warningCheck: warningStage.result,
        spiritsColocation,
        reportId: input.reportId,
        deferResolver: input.deferResolver,
        anchorTrack: anchorTrackForReport
      })
    );
    latencyCapture.recordSpan({
      stage: 'report-shaping',
      outcome: 'success',
      durationMs: reportStage.elapsedMs
    });

    let finalReport = reportStage.result;
    const judgmentClient = createJudgmentLlmClient();
    if (judgmentClient) {
      const judgmentStage = await measureStage(() =>
        resolveReviewJudgment({
          report: finalReport,
          extraction: reconciledExtraction,
          client: judgmentClient
        })
      );
      finalReport = judgmentStage.result;
      latencyCapture.recordSpan({
        stage: 'llm-judgment',
        outcome: 'success',
        durationMs: judgmentStage.elapsedMs
      });
    }

    latencyCapture.setOutcomePath(resolveSuccessLatencyPath(latencyCapture));

    return {
      report: finalReport,
      extraction: reconciledExtraction,
      warningCheck: warningStage.result,
      stageTimingsMs: {
        extraction: extractionElapsedMs,
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
    const report = result.report as VerificationReport & { __extraction?: ReviewExtraction };
    Object.defineProperty(report, '__extraction', {
      value: result.extraction,
      enumerable: false,
      writable: false,
      configurable: false
    });
    return report;
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
