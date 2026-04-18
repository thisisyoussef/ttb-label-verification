// Inner traceable stage wrappers for the review surface.
//
// These three wrappers are each a simple `traceable(fn, options)` factory
// that wraps the base operation (extraction, warning validation, report
// assembly) with LangSmith tracing metadata. They were originally inline in
// llm-trace.ts but extracted to keep that file under the 500-line source
// cap. No behavior change.
//
// Each traceable emits a span under the "ttb" / "llm" tags and uses the
// processInputs/processOutputs summarizers to strip PII from the recorded
// payload before it goes to LangSmith. processInputs always returns
// `noPersistence: true` so the spans keep their metadata but the raw label
// image bytes never leave our process.

import { traceable } from 'langsmith/traceable';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { buildGovernmentWarningCheck } from './warning/government-warning-validator';
import { buildVerificationReport } from './review-report';
import type { NormalizedReviewIntake } from './review-intake';
import type { ReviewExtractor } from './review-extraction';
import type { LlmEndpointSurface } from './llm-policy';
import type { WarningOcvResult } from './warning/warning-region-ocv';
import type { OcrCrossCheckResult } from './warning/warning-ocr-cross-check';
import type { ReviewLatencyCapture } from './review-latency';
import type { AnchorTrackResult } from './anchor/anchor-field-track';
import {
  annotateCurrentRun,
  inferProviderFromModel,
  resolveTraceMetadata,
  summarizeApplicationFields,
  summarizeExtraction,
  summarizeLabel,
  summarizeVerificationReport,
  summarizeWarningCheck,
  type TraceMetadataInput as BaseTraceMetadataInput
} from './llm-trace-support';

type TraceMetadataInput = BaseTraceMetadataInput & {
  surface: LlmEndpointSurface;
};

export type TracedReviewExtractionInput = TraceMetadataInput & {
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
  latencyCapture?: ReviewLatencyCapture;
  /**
   * Streaming progress callback. Forwarded into the extractor's
   * context so the Gemini streaming path can emit vlm-field frames
   * as each top-level field's JSON value closes. Non-streaming
   * extractors ignore this.
   */
  onVlmFieldProgress?: (field: { name: string; value: unknown }) => void;
};

export type TracedWarningValidationInput = TraceMetadataInput & {
  extraction: ReviewExtraction;
  ocrCrossCheck?: OcrCrossCheckResult;
  warningOcv?: WarningOcvResult;
};

export type TracedReviewReportInput = TraceMetadataInput & {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  reportId?: string;
  /**
   * Batch aggregation path: set true to skip the per-label resolver so
   * the batch orchestrator can collect ambiguous fields across all
   * labels and make one aggregated Gemini call instead of N sequential
   * per-label calls. See batch-session.ts for the aggregation code.
   */
  deferResolver?: boolean;
  /**
   * Forwarded into buildVerificationReport so the spirits same-
   * field-of-vision cross-field check can render a real status
   * instead of the placeholder. Computed upstream by the parallel
   * VLM call in `spirits-colocation-check.ts`.
   */
  spiritsColocation?: import('./spirits-colocation-check').SpiritsColocationResult | null;
  /**
   * Optional per-field anchor track result. When present, the review
   * report layer uses anchor confirmations to upgrade review→pass on
   * individual fields. Only runs when ANCHOR_MERGE=enabled.
   */
  anchorTrack?: AnchorTrackResult | null;
};

export const tracedReviewExtraction = traceable(
  async (input: TracedReviewExtractionInput) => {
    annotateCurrentRun(input);
    const extraction = await input.extractor(input.intake, {
      latencyCapture: input.latencyCapture,
      surface: input.surface,
      extractionMode: resolveTraceMetadata(input).extractionMode,
      onVlmFieldProgress: input.onVlmFieldProgress
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

export const tracedWarningValidation = traceable(
  async (input: TracedWarningValidationInput) => {
    annotateCurrentRun(input);
    return buildGovernmentWarningCheck(
      input.extraction,
      input.ocrCrossCheck,
      input.warningOcv
    );
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

export const tracedReviewReport = traceable(
  async (input: TracedReviewReportInput) => {
    annotateCurrentRun(input);
    return buildVerificationReport({
      intake: input.intake,
      extraction: input.extraction,
      warningCheck: input.warningCheck,
      id: input.reportId,
      deferResolver: input.deferResolver,
      spiritsColocation: input.spiritsColocation,
      anchorTrack: input.anchorTrack
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
