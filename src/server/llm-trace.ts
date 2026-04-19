import { traceable } from 'langsmith/traceable';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { isOcrPrepassEnabled } from './ocr-prepass';
import { type WarningOcvResult } from './warning-region-ocv';
import {
  resolveAnchorMergeMode,
  type AnchorTrackResult
} from './anchor-field-track';
import { reconcileExtractionWithOcr } from './extraction-ocr-reconciler';
import { extractFieldsFromOcrText } from './ocr-field-extractor';
import { isRegionDetectionEnabled } from './vlm-region-detector';
import { createJudgmentLlmClient } from './judgment-llm-client-factory';
import { mergeOcrAndVlm, applyRegionOverrides } from './extraction-merge';
import { resolveReviewJudgment } from './review-surface-judgment';
import {
  runAnchorTrackOverLabels,
  runOcrPrepassOverLabels,
  runSpiritsColocationOverLabels,
  runVlmRegionDetectionOverLabels,
  runWarningOcrCrossCheckOverLabels,
  runWarningOcvOverLabels
} from './multi-label-stages';
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
  isSpiritsColocationAvailable,
  type SpiritsColocationResult
} from './spirits-colocation-check';

export type { TracedReviewExtractionInput };

export type TracedReviewSurfaceInput = TracedReviewExtractionInput & {
  reportId?: string;
  latencyObserver?: ReviewLatencyObserver;
  /**
   * Batch aggregation path: skip the per-label resolver (see
   * review-report.ts `deferResolver`). Set by batch-session.ts when it
   * wants to aggregate ambiguous fields across all labels into one
   * resolver call.
   */
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

    // Parallelize OCR pre-pass, warning OCV, and VLM extraction. They do not
    // depend on one another and running them together cuts 1-3s from the path.
    let augmentedIntake = input.intake;
    let warningOcv: WarningOcvResult | undefined;

    // The VLM is usually the long pole, so keep OCR pre-pass and OCV fully
    // independent instead of serializing OCV behind OCR text reuse.
    const prepassEnabled = isOcrPrepassEnabled();
    // EXTRACTION_PIPELINE=simple skips OCR pre-pass + merge and trusts the
    // VLM structure, but still keeps warning OCV as a canonical-text check.
    const useSimplePipeline = process.env.EXTRACTION_PIPELINE?.trim().toLowerCase() === 'simple';

    const ocrPromise = prepassEnabled && !useSimplePipeline
      ? measureStage(() => runOcrPrepassOverLabels(input.intake.labels))
      : Promise.resolve(null);

    // OCV's slow rotation fallbacks are cancellable once the VLM returns so
    // they never extend wall-clock after the long pole completes.
    const ocvController = new AbortController();
    const ocvPromise = prepassEnabled
      ? measureStage(() =>
          runWarningOcvOverLabels({
            labels: input.intake.labels,
            signal: ocvController.signal
          })
        )
      : Promise.resolve(null);

    // VLM extraction always uses the standard prompt; OCR values override text
    // fields later instead of biasing the model with an OCR-first prompt.
    const vlmPromise = measureStage(() =>
      runTracedReviewExtraction({ ...input, intake: input.intake, latencyCapture })
    );
    // Stop OCV rotation fallbacks once the VLM resolves.
    vlmPromise.finally(() => ocvController.abort()).catch(() => {});

    // Parallel anchor track confirms application values against full-label OCR
    // and can upgrade uncertain review results when ANCHOR_MERGE is enabled.
    const anchorMergeMode = resolveAnchorMergeMode();
    const anchorPromise: Promise<{ result: AnchorTrackResult | null; elapsedMs: number }> =
      anchorMergeMode === 'disabled'
        ? Promise.resolve({ result: null, elapsedMs: 0 })
        : measureStage(() =>
            runAnchorTrackOverLabels(input.intake.labels, input.intake.fields)
          );

    // Await all four in parallel. Anchor adds work but does not typically
    // extend wall-clock because the VLM remains the long pole.
    const [ocrStage, ocvStage, vlmStage, anchorStage] = await Promise.all([
      ocrPromise,
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
    // In shadow mode we still capture anchor telemetry but skip the merge.
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

    // OCR-first extraction: regex harvests text fields, VLM still covers
    // visual signals and sparse-OCR fallback.
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

    // VLM finds regions; OCR supplies verified text for those regions.
    if (isRegionDetectionEnabled()) {
      const regionStage = await measureStage(() =>
        runVlmRegionDetectionOverLabels(input.intake.labels)
      );
      latencyCapture.recordSpan({
        stage: 'region-detection',
        outcome: regionStage.result.regions.length > 0 ? 'success' : 'fast-fail',
        durationMs: regionStage.elapsedMs
      });
      extractionElapsedMs += regionStage.elapsedMs;

      extractionResult = applyRegionOverrides(extractionResult, regionStage.result.regions);
    }

    // Reconcile remaining VLM-only fields
    const { extraction: reconciledExtraction } = reconcileExtractionWithOcr(
      extractionResult,
      augmentedIntake.ocrText
    );

    const vlmWarning = reconciledExtraction.fields.governmentWarning.value ?? '';
    let ocrCrossCheck: import('./warning-ocr-cross-check').OcrCrossCheckResult =
      { status: 'abstain', reason: 'no-vlm-warning-text' };
    if (vlmWarning.length > 0) {
      try {
        ocrCrossCheck = await runWarningOcrCrossCheckOverLabels({
          labels: input.intake.labels,
          vlmWarningText: vlmWarning
        });
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

    // Spirits same-field-of-vision check (27 CFR 5.61) only runs for
    // distilled-spirits reviews when Gemini is configured.
    let spiritsColocation: SpiritsColocationResult | null = null;
    if (
      reconciledExtraction.beverageType === 'distilled-spirits' &&
      isSpiritsColocationAvailable()
    ) {
      const colocationStage = await measureStage(() =>
        runSpiritsColocationOverLabels(input.intake.labels)
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

    // LLM judgment resolves the remaining ambiguous high-variance fields.
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
    // Return the report directly for backward compatibility with the
    // single-label review route (which only needs the report), but
    // attach the reconciled extraction as a non-enumerable property so
    // the batch orchestrator can pick it up when it needs to re-derive
    // the verdict after aggregated-resolver patching.
    //
    // Callers that don't know about extraction just see it as
    // `result.report` and are unaffected. Callers that do — i.e.
    // batch-session.ts in the Opt D path — read `result.extraction`
    // after type-narrowing.
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
