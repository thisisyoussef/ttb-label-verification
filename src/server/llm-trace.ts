import { traceable } from 'langsmith/traceable';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { runWarningOcrCrossCheck } from './warning-ocr-cross-check';
import { runOcrPrepass, isOcrPrepassEnabled } from './ocr-prepass';
import { runWarningOcv, type WarningOcvResult } from './warning-region-ocv';
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

export type { TracedReviewExtractionInput };

export type TracedReviewSurfaceInput = TracedReviewExtractionInput & {
  reportId?: string;
  latencyObserver?: ReviewLatencyObserver;
};

export type TracedExtractionSurfaceInput = TracedReviewExtractionInput & {
  latencyObserver?: ReviewLatencyObserver;
};

export type TracedWarningSurfaceInput = TracedReviewExtractionInput & {
  latencyObserver?: ReviewLatencyObserver;
};

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

const tracedReviewSurface = traceable(
  async (input: TracedReviewSurfaceInput): Promise<ReviewSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const latencyCapture = resolveLatencyCapture(input);
    const startedAt = performance.now();

    // PARALLEL PRE-EXTRACTION PIPELINE
    //
    // OCR pre-pass, warning OCV, and VLM extraction are all independent —
    // they don't consume each other's outputs, so they can run concurrently.
    // This shaves 1-3s off the critical path compared to running them
    // sequentially (see latency analysis in accuracy-research-2026-04-15.md).
    //
    // Warning OCV can optionally consume the pre-pass OCR text to skip
    // re-running Tesseract. We thread that dependency with a fast Promise
    // chain while still firing the other two in parallel.
    let augmentedIntake = input.intake;
    let warningOcv: WarningOcvResult | undefined;

    // Fire all three in parallel. The VLM is always the long pole (3-5s);
    // OCR pre-pass and OCV finish well before the VLM returns.
    //
    // KEY FIX: previously OCV was wrapped in `ocrPromise.then(...)` as a
    // piggyback optimization — reusing OCR text to skip a second Tesseract
    // pass. That saved ~500ms of Tesseract work but SERIALIZED OCV behind
    // OCR, costing ~1s of wall-clock time on labels where OCR is slower
    // than OCV. OCV runs its own Tesseract on a different (cropped +
    // rotated) region anyway, so the reuse was marginal. We now fire
    // OCV truly independently — it always does its own pass, but gets
    // the wall-clock parallelism with OCR + VLM.
    const prepassEnabled = isOcrPrepassEnabled();
    // EXTRACTION_PIPELINE=simple: skip OCR pre-pass + merge entirely,
    // trust the VLM's structured extraction as-is. Keep the warning OCV
    // because it's a canonical-text verifier (checking known text against
    // a fixed target), not an extractor — a genuinely complementary signal.
    // See docs/ARCHITECTURE_AND_DECISIONS.md for the rationale.
    const useSimplePipeline = process.env.EXTRACTION_PIPELINE?.trim().toLowerCase() === 'simple';

    const ocrPromise = prepassEnabled && !useSimplePipeline
      ? measureStage(() => runOcrPrepass(input.intake.label))
      : Promise.resolve(null);

    const ocvPromise = prepassEnabled
      ? measureStage(() =>
          runWarningOcv({ label: input.intake.label })
        )
      : Promise.resolve(null);

    // VLM extraction — always runs, uses the standard prompt (no OCR text
    // injected). The OCR-augmented prompt suppresses VLM warning detection
    // because the VLM obeys "use OCR as primary source" and reports fields
    // absent from OCR as not present — even when it can see them in the image.
    // Instead, we use VLM for full extraction, then override text fields with
    // OCR values in the merge step below.
    const vlmPromise = measureStage(() =>
      runTracedReviewExtraction({ ...input, intake: input.intake, latencyCapture })
    );

    // Await all three in parallel.
    const [ocrStage, ocvStage, vlmStage] = await Promise.all([
      ocrPromise,
      ocvPromise,
      vlmPromise
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

    let extractionElapsedMs = vlmStage.elapsedMs;

    // OCR-first extraction: regex extracts fields from OCR text (no LLM, no pollution).
    // VLM still runs for visual signals and as fallback when OCR has insufficient text.
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

    // VLM region detection → per-region OCR override.
    // VLM tells us WHERE fields are, OCR reads WHAT they say.
    // Verified OCR text overrides VLM extraction (no hallucination).
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

      // Override fields with verified per-region OCR text
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
    const reportStage = await measureStage(() =>
      tracedReviewReport({
        ...input,
        extraction: reconciledExtraction,
        warningCheck: warningStage.result,
        reportId: input.reportId
      })
    );
    latencyCapture.recordSpan({
      stage: 'report-shaping',
      outcome: 'success',
      durationMs: reportStage.elapsedMs
    });

    // LLM JUDGMENT LAYER — resolves ambiguous field mismatches that survive
    // deterministic normalization. Only runs for fields with high
    // variability (country-of-origin, applicant-address) where lookup
    // tables can't cover the long tail. See review-surface-judgment.ts
    // for the allowlist + verdict re-derivation logic.
    //
    // Typical added latency: 300-700ms total (parallelized across fields).
    // Opt-out with LLM_JUDGMENT=disabled env var.
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

