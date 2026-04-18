import { z } from 'zod';

import {
  reviewExtractionFieldSchema,
  verificationReportSchema,
  warningEvidenceSchema,
  type ReviewExtractionField
} from './review-base';

/**
 * Single-review streaming contract.
 *
 * The standard `/api/review` endpoint runs OCR → VLM → warning OCV →
 * judgment → report and only responds with the final VerificationReport
 * after every stage completes (typically 5–7s on cola-cloud-all).
 * `/api/review/stream` runs the same pipeline but emits Server-Sent
 * Events as each stage produces data, so the client can render
 * progressively:
 *
 *   t~0    intake   — image received, pipeline started
 *   t~1–2s ocr      — Tesseract text + regex-extracted fields
 *   t~2–5s vlm-field — Gemini per-field as the JSON streams
 *   t~2–4s warning  — warning OCV + vote (runs parallel to VLM)
 *   t~5–7s vlm-done — full extraction complete
 *   t~5–7s report   — final verdict + check rows (terminal frame)
 *
 * Client renders a skeleton at `intake`, fills numeric/canonical fields
 * at `ocr`, progressively swaps to authoritative values at `vlm-field`,
 * locks warning at `warning`, and transitions to the full Results page
 * at `report`.
 *
 * Every frame carries the `requestId` assigned at intake so the client
 * can guard against races if the user re-submits.
 */

const streamFrameBase = z.object({
  requestId: z.string()
});

export const reviewStreamStageSchema = z.enum([
  'intake',
  'ocr-done',
  'vlm-field',
  'vlm-done',
  'warning-done',
  'report-ready',
  'error',
  'done'
]);

export const reviewStreamIntakeFrameSchema = streamFrameBase.extend({
  type: z.literal('intake'),
  filename: z.string(),
  bytes: z.number().int().nonnegative(),
  mimeType: z.string()
});

export const reviewStreamOcrFrameSchema = streamFrameBase.extend({
  type: z.literal('ocr-done'),
  /** Raw OCR text, trimmed. Empty string when OCR failed or gave no text. */
  ocrText: z.string(),
  /**
   * Regex-extracted fields. These are the ones the reviewer can start
   * eyeballing in 1–2s while the VLM is still running. Identifier
   * fields (brand, address) are intentionally omitted here — OCR's
   * regex guesses on them are too noisy to render.
   */
  partialFields: z.object({
    alcoholContent: reviewExtractionFieldSchema.optional(),
    netContents: reviewExtractionFieldSchema.optional(),
    classType: reviewExtractionFieldSchema.optional(),
    countryOfOrigin: reviewExtractionFieldSchema.optional(),
    governmentWarning: reviewExtractionFieldSchema.optional()
  }),
  durationMs: z.number().int().nonnegative()
});

/**
 * A single VLM field completion as Gemini streams its structured JSON.
 * Emitted in arrival order (not necessarily schema order).
 */
export const reviewStreamVlmFieldFrameSchema = streamFrameBase.extend({
  type: z.literal('vlm-field'),
  fieldName: z.string(),
  field: reviewExtractionFieldSchema
});

export const reviewStreamVlmDoneFrameSchema = streamFrameBase.extend({
  type: z.literal('vlm-done'),
  durationMs: z.number().int().nonnegative()
});

export const reviewStreamWarningFrameSchema = streamFrameBase.extend({
  type: z.literal('warning-done'),
  warning: warningEvidenceSchema,
  durationMs: z.number().int().nonnegative()
});

export const reviewStreamReportFrameSchema = streamFrameBase.extend({
  type: z.literal('report-ready'),
  report: verificationReportSchema
});

export const reviewStreamErrorFrameSchema = streamFrameBase.extend({
  type: z.literal('error'),
  message: z.string(),
  retryable: z.boolean(),
  kind: z.enum(['network', 'validation', 'timeout', 'adapter', 'internal'])
});

export const reviewStreamDoneFrameSchema = streamFrameBase.extend({
  type: z.literal('done')
});

export const reviewStreamFrameSchema = z.discriminatedUnion('type', [
  reviewStreamIntakeFrameSchema,
  reviewStreamOcrFrameSchema,
  reviewStreamVlmFieldFrameSchema,
  reviewStreamVlmDoneFrameSchema,
  reviewStreamWarningFrameSchema,
  reviewStreamReportFrameSchema,
  reviewStreamErrorFrameSchema,
  reviewStreamDoneFrameSchema
]);

export type ReviewStreamStage = z.infer<typeof reviewStreamStageSchema>;
export type ReviewStreamIntakeFrame = z.infer<typeof reviewStreamIntakeFrameSchema>;
export type ReviewStreamOcrFrame = z.infer<typeof reviewStreamOcrFrameSchema>;
export type ReviewStreamVlmFieldFrame = z.infer<typeof reviewStreamVlmFieldFrameSchema>;
export type ReviewStreamVlmDoneFrame = z.infer<typeof reviewStreamVlmDoneFrameSchema>;
export type ReviewStreamWarningFrame = z.infer<typeof reviewStreamWarningFrameSchema>;
export type ReviewStreamReportFrame = z.infer<typeof reviewStreamReportFrameSchema>;
export type ReviewStreamErrorFrame = z.infer<typeof reviewStreamErrorFrameSchema>;
export type ReviewStreamDoneFrame = z.infer<typeof reviewStreamDoneFrameSchema>;
export type ReviewStreamFrame = z.infer<typeof reviewStreamFrameSchema>;

export type StreamableField = keyof ReviewStreamOcrFrame['partialFields'];

/**
 * Accumulator shape the client builds by folding frames. Mirrors the
 * standard ReviewExtraction but every field may be undefined until the
 * matching frame arrives. Identifier fields (brandName, fancifulName,
 * applicantAddress) only populate when `vlm-field` frames arrive.
 */
export interface PartialReviewExtraction {
  ocrText?: string;
  alcoholContent?: ReviewExtractionField;
  netContents?: ReviewExtractionField;
  brandName?: ReviewExtractionField;
  fancifulName?: ReviewExtractionField;
  classType?: ReviewExtractionField;
  countryOfOrigin?: ReviewExtractionField;
  applicantAddress?: ReviewExtractionField;
  ageStatement?: ReviewExtractionField;
  sulfiteDeclaration?: ReviewExtractionField;
  appellation?: ReviewExtractionField;
  vintage?: ReviewExtractionField;
  governmentWarning?: ReviewExtractionField;
}

/** Server-Sent Events wire format helper. */
export function formatSseFrame(frame: ReviewStreamFrame): string {
  return `data: ${JSON.stringify(frame)}\n\n`;
}
