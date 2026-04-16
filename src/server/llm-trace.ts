import { traceable } from 'langsmith/traceable';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { buildGovernmentWarningCheck } from './government-warning-validator';
import { runWarningOcrCrossCheck } from './warning-ocr-cross-check';
import { runOcrPrepass, isOcrPrepassEnabled } from './ocr-prepass';
import { runWarningOcv, type WarningOcvResult } from './warning-region-ocv';
import { reconcileExtractionWithOcr } from './extraction-ocr-reconciler';
import { extractFieldsFromOcrText } from './ocr-field-extractor';
import { finalizeReviewExtraction } from './review-extraction';
import { runVlmRegionDetection, isRegionDetectionEnabled, type RegionOcrResult } from './vlm-region-detector';
import { resolveAmbiguousChecks } from './judgment-llm-executor';
import { createJudgmentLlmClient } from './judgment-llm-client-factory';
import { deriveWeightedVerdict } from './judgment-scoring';
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
  warningOcv?: WarningOcvResult;
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
    return buildGovernmentWarningCheck(input.extraction, input.ocrCrossCheck, input.warningOcv);
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
    // the OCR pre-pass and OCV should finish well before the VLM returns.
    const prepassEnabled = isOcrPrepassEnabled();

    const ocrPromise = prepassEnabled
      ? measureStage(() => runOcrPrepass(input.intake.label))
      : Promise.resolve(null);

    // OCV can reuse OCR text when available, but starts its own measurement
    // immediately. We kick it off with the OCR promise so it can piggyback
    // on the pre-pass text as soon as OCR finishes. When OCR fails or is
    // disabled, OCV falls back to running its own Tesseract pass.
    const ocvPromise = prepassEnabled
      ? ocrPromise.then(async (ocrStage) => {
          const prepassText =
            ocrStage && ocrStage.result.status !== 'failed'
              ? ocrStage.result.text
              : undefined;
          return measureStage(() =>
            runWarningOcv({ label: input.intake.label, prepassOcrText: prepassText })
          );
        })
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
    // tables can't cover the long tail.
    //
    // All ambiguous checks fire in parallel to Gemini Flash with temp 0.
    // Typical added latency: 300-700ms total (parallelized across fields).
    //
    // Opt-out with LLM_JUDGMENT=disabled env var.
    let finalReport = reportStage.result;
    const judgmentClient = createJudgmentLlmClient();
    if (judgmentClient) {
      const judgmentStage = await measureStage(async () => {
        // Only upgrade fields that benefit from semantic LLM judgment.
        // Keep brand/class/ABV/net-contents in the deterministic fast path.
        const LLM_JUDGMENT_FIELDS = new Set([
          'country-of-origin',
          'applicant-address'
        ]);

        const checksToJudge = finalReport.checks.filter((c) =>
          LLM_JUDGMENT_FIELDS.has(c.id) && c.status === 'review'
        );
        const checksToSkip = finalReport.checks.filter(
          (c) => !LLM_JUDGMENT_FIELDS.has(c.id) || c.status !== 'review'
        );

        if (checksToJudge.length === 0) {
          return finalReport;
        }

        // Parallelize: resolveAmbiguousChecks itself awaits each judgment
        // sequentially, so we wrap individual checks in Promise.all to
        // fire them concurrently.
        const judgedChecks = await Promise.all(
          checksToJudge.map((check) =>
            resolveAmbiguousChecks({
              checks: [check],
              beverageType: finalReport.beverageType,
              client: judgmentClient
            }).then((arr) => arr[0])
          )
        );

        // Recompute verdict + counts with upgraded checks
        const updatedChecks = [...checksToSkip, ...judgedChecks];

        const verdictResult = deriveWeightedVerdict({
          checks: updatedChecks,
          crossFieldChecks: finalReport.crossFieldChecks,
          standalone: finalReport.standalone,
          extraction: reconciledExtraction
        });

        const pass = updatedChecks.filter((c) => c.status === 'pass').length +
          finalReport.crossFieldChecks.filter((c) => c.status === 'pass').length;
        const review = updatedChecks.filter((c) => c.status === 'review').length +
          finalReport.crossFieldChecks.filter((c) => c.status === 'review').length;
        const fail = updatedChecks.filter((c) => c.status === 'fail').length +
          finalReport.crossFieldChecks.filter((c) => c.status === 'fail').length;

        return {
          ...finalReport,
          verdict: verdictResult.verdict,
          checks: updatedChecks,
          counts: { pass, review, fail }
        };
      });
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

/**
 * Merge OCR-regex extraction with VLM extraction.
 * OCR-regex fields take priority (no pollution). VLM provides visual signals,
 * image quality, and fills in fields that OCR couldn't extract.
 */
function mergeOcrAndVlm(
  ocrOutput: import('./review-extraction').ReviewExtractionModelOutput,
  vlmExtraction: ReviewExtraction
): ReviewExtraction {
  const fieldKeys = [
    'brandName', 'fancifulName', 'classType', 'alcoholContent',
    'netContents', 'applicantAddress', 'countryOfOrigin', 'ageStatement',
    'sulfiteDeclaration', 'appellation', 'vintage', 'governmentWarning'
  ] as const;

  type FieldShape = { present: boolean; value?: string; confidence: number; note?: string };
  const mergedFields = { ...vlmExtraction.fields };

  for (const key of fieldKeys) {
    const ocrField = ocrOutput.fields[key] as FieldShape;

    // Government warning + brand name: EXEMPT from OCR override.
    // VLM reads small/rotated warnings and decorative brand fonts better than OCR.
    if (key === 'governmentWarning' || key === 'brandName') continue;

    // For other fields: trust OCR when it found a high-confidence pattern.
    if (ocrField.present && ocrField.value && ocrField.confidence >= 0.80) {
      (mergedFields as Record<string, FieldShape>)[key] = ocrField;
    } else if ((mergedFields as Record<string, FieldShape>)[key]?.present) {
      const vlmField = (mergedFields as Record<string, FieldShape>)[key];
      (mergedFields as Record<string, FieldShape>)[key] = {
        ...vlmField,
        confidence: Math.min(vlmField.confidence, 0.55),
        note: vlmField.note ? `${vlmField.note} | VLM-only (OCR miss)` : 'VLM-only: not found in OCR text.'
      };
    }
  }

  return {
    ...vlmExtraction,
    fields: mergedFields,
    warningSignals: vlmExtraction.warningSignals,
    imageQuality: vlmExtraction.imageQuality,
    summary: `OCR-first: ${ocrOutput.summary}`
  };
}

/**
 * Apply VLM-guided region OCR overrides to the extraction.
 * Where per-region OCR verified a field value, override the VLM extraction.
 * This is the final decontamination step — verified OCR always wins.
 */
function applyRegionOverrides(
  extraction: ReviewExtraction,
  regions: RegionOcrResult[]
): ReviewExtraction {
  type FieldShape = { present: boolean; value?: string; confidence: number; note?: string };
  const fields = { ...extraction.fields };

  const fieldKeyMap: Record<string, string> = {
    'government_warning': 'governmentWarning',
    'alcohol_content': 'alcoholContent',
    'net_contents': 'netContents',
    'brand_name': 'brandName'
  };

  for (const region of regions) {
    if (!region.verified || !region.ocrText) continue;

    const fieldKey = fieldKeyMap[region.field];
    if (!fieldKey) continue;

    const currentField = (fields as Record<string, FieldShape>)[fieldKey];

    // Extract the most relevant text for this field from the OCR output
    const extractedValue = extractFieldValue(region.field, region.ocrText);
    if (!extractedValue) continue;

    // Brand names: DON'T override VLM with OCR. Brand names are in decorative
    // fonts that OCR garbles into "ae aw a _", "~ hil og", "c e :".
    // The VLM reads decorative text better than OCR.
    if (fieldKey === 'brandName') continue;

    // Override with verified OCR value
    (fields as Record<string, FieldShape>)[fieldKey] = {
      present: true,
      value: extractedValue,
      confidence: 0.92, // High confidence — verified by per-region OCR
      note: `Verified by VLM-guided region OCR. ${currentField?.note ? 'Previous: ' + currentField.note : ''}`
    };
  }

  return { ...extraction, fields };
}

/** Extract the relevant value for a field from raw OCR text. */
function extractFieldValue(field: string, ocrText: string): string | null {
  switch (field) {
    case 'government_warning': {
      const match = ocrText.match(/GOVERNMENT\s*WARN(?:ING|SING)[\s\S]*/i);
      if (!match) return null;
      return match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
    case 'alcohol_content': {
      // Find ABV pattern
      const abv = ocrText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:ALC|Alc|alc)[^a-z]*/i)
        ?? ocrText.match(/(?:ALC|Alc)[^a-z]*\s*(\d+(?:\.\d+)?)\s*%/i)
        ?? ocrText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:by\s+vol|BY\s+VOL)/i);
      return abv ? abv[0].trim() : null;
    }
    case 'net_contents': {
      const net = ocrText.match(/\d+(?:\.\d+)?\s*(?:mL|ML|ml|FL\.?\s*OZ\.?|fl\.?\s*oz\.?|PINT|pint|L\b|cl\b)/i);
      return net ? net[0].trim() : null;
    }
    case 'brand_name': {
      // First substantial capitalized line
      const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length >= 3 && l.length <= 40);
      return lines[0] ?? null;
    }
    default:
      return null;
  }
}
