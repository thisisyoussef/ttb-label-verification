import { z } from 'zod';

import {
  beverageTypeSchema,
  extractionQualityStateSchema,
  verificationReportSchema
} from './review-base';

export const SUPPORTED_LABEL_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
] as const;
export const MAX_LABEL_UPLOAD_BYTES = 10 * 1024 * 1024;
export const BATCH_LABEL_CAP = 50;
export const BATCH_CSV_EXPECTED_HEADERS = [
  'filename',
  'beverage_type',
  'brand_name',
  'fanciful_name',
  'class_type',
  'alcohol_content',
  'net_contents',
  'applicant_address',
  'origin',
  'country',
  'formula_id',
  'appellation',
  'vintage'
] as const;
export const BATCH_CSV_REQUIRED_HEADERS = [
  'filename',
  'brand_name',
  'class_type',
  'alcohol_content',
  'net_contents'
] as const;

export const batchRunPhaseSchema = z.enum(['complete', 'cancelled-partial']);
export const batchFileErrorReasonSchema = z.enum([
  'unsupported-type',
  'oversized',
  'duplicate',
  'over-cap'
]);
export const batchLabelFileSchema = z.object({
  clientId: z.string(),
  filename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string()
});
export const batchPreflightRequestSchema = z.object({
  batchClientId: z.string(),
  images: z.array(batchLabelFileSchema).max(BATCH_LABEL_CAP + 25),
  csv: z.object({
    filename: z.string(),
    sizeBytes: z.number().int().nonnegative()
  })
});

export const batchCsvRowSchema = z.object({
  id: z.string(),
  rowIndex: z.number().int().positive(),
  filenameHint: z.string(),
  brandName: z.string(),
  classType: z.string()
});

export const batchMatchedPairSchema = z.object({
  imageId: z.string(),
  row: batchCsvRowSchema,
  source: z.enum(['filename', 'order'])
});

export const batchAmbiguousSchema = z.object({
  imageId: z.string(),
  candidates: z.array(batchCsvRowSchema).min(2)
});

export const batchFileErrorSchema = z.object({
  filename: z.string(),
  reason: batchFileErrorReasonSchema,
  message: z.string()
});

export const batchPreflightResponseSchema = z.object({
  batchSessionId: z.string(),
  csvHeaders: z.array(z.string()),
  csvRows: z.array(batchCsvRowSchema),
  matching: z.object({
    matched: z.array(batchMatchedPairSchema),
    ambiguous: z.array(batchAmbiguousSchema),
    unmatchedImageIds: z.array(z.string()),
    unmatchedRowIds: z.array(z.string())
  }),
  csvError: z
    .object({
      message: z.string()
    })
    .optional(),
  fileErrors: z.array(batchFileErrorSchema).default([])
});

export const batchResolutionSchema = z.object({
  imageId: z.string(),
  action: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('matched'),
      rowId: z.string()
    }),
    z.object({
      kind: z.literal('dropped')
    })
  ])
});

export const batchStartRequestSchema = z.object({
  batchSessionId: z.string(),
  resolutions: z.array(batchResolutionSchema)
});

export const batchItemStatusSchema = z.enum(['pass', 'review', 'fail', 'error']);

export const batchStreamProgressSchema = z.object({
  type: z.literal('progress'),
  done: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  secondsRemainingEstimate: z.number().int().nonnegative().optional()
});

export const batchStreamItemSchema = z.object({
  type: z.literal('item'),
  itemId: z.string(),
  imageId: z.string(),
  filename: z.string(),
  identity: z.string(),
  status: batchItemStatusSchema,
  reportId: z.string().optional(),
  errorMessage: z.string().optional()
});

export const batchStreamSummarySchema = z.object({
  type: z.literal('summary'),
  total: z.number().int().nonnegative(),
  pass: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  error: z.number().int().nonnegative(),
  dashboardHandle: z.object({
    sessionId: z.string()
  })
});

export const batchStreamFrameSchema = z.discriminatedUnion('type', [
  batchStreamProgressSchema,
  batchStreamItemSchema,
  batchStreamSummarySchema
]);

export const batchDashboardIssuesSchema = z.object({
  blocker: z.number().int().nonnegative(),
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  note: z.number().int().nonnegative()
});

export const batchDashboardRowSchema = z.object({
  rowId: z.string(),
  reportId: z.string().nullable(),
  imageId: z.string(),
  filename: z.string(),
  brandName: z.string(),
  classType: z.string(),
  beverageType: beverageTypeSchema,
  status: batchItemStatusSchema,
  previewUrl: z.string().nullable(),
  isPdf: z.boolean(),
  sizeLabel: z.string(),
  issues: batchDashboardIssuesSchema,
  confidenceState: extractionQualityStateSchema,
  errorMessage: z.string().nullable(),
  completedOrder: z.number().int().positive()
});

export const batchDashboardSummarySchema = z.object({
  pass: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  error: z.number().int().nonnegative()
});

export const batchDashboardResponseSchema = z.object({
  batchSessionId: z.string(),
  phase: batchRunPhaseSchema,
  totals: z.object({
    started: z.number().int().nonnegative(),
    done: z.number().int().nonnegative()
  }),
  summary: batchDashboardSummarySchema,
  rows: z.array(batchDashboardRowSchema)
});

export const batchExportPayloadSchema = z.object({
  generatedAt: z.string().datetime(),
  phase: batchRunPhaseSchema,
  totals: z.object({
    started: z.number().int().nonnegative(),
    done: z.number().int().nonnegative()
  }),
  summary: batchDashboardSummarySchema,
  rows: z.array(batchDashboardRowSchema),
  reports: z.record(z.string(), verificationReportSchema),
  noPersistence: z.literal(true)
});

export type BatchRunPhase = z.infer<typeof batchRunPhaseSchema>;
export type BatchFileErrorReason = z.infer<typeof batchFileErrorReasonSchema>;
export type BatchLabelFile = z.infer<typeof batchLabelFileSchema>;
export type BatchPreflightRequest = z.infer<typeof batchPreflightRequestSchema>;
export type BatchCsvRow = z.infer<typeof batchCsvRowSchema>;
export type BatchMatchedPair = z.infer<typeof batchMatchedPairSchema>;
export type BatchAmbiguous = z.infer<typeof batchAmbiguousSchema>;
export type BatchFileError = z.infer<typeof batchFileErrorSchema>;
export type BatchPreflightResponse = z.infer<typeof batchPreflightResponseSchema>;
export type BatchResolution = z.infer<typeof batchResolutionSchema>;
export type BatchStartRequest = z.infer<typeof batchStartRequestSchema>;
export type BatchItemStatus = z.infer<typeof batchItemStatusSchema>;
export type BatchStreamProgress = z.infer<typeof batchStreamProgressSchema>;
export type BatchStreamItem = z.infer<typeof batchStreamItemSchema>;
export type BatchStreamSummary = z.infer<typeof batchStreamSummarySchema>;
export type BatchStreamFrame = z.infer<typeof batchStreamFrameSchema>;
export type BatchDashboardIssues = z.infer<typeof batchDashboardIssuesSchema>;
export type BatchDashboardRow = z.infer<typeof batchDashboardRowSchema>;
export type BatchDashboardSummary = z.infer<typeof batchDashboardSummarySchema>;
export type BatchDashboardResponse = z.infer<typeof batchDashboardResponseSchema>;
export type BatchExportPayload = z.infer<typeof batchExportPayloadSchema>;
