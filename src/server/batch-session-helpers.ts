import { Readable } from 'node:stream';

import type {
  BatchDashboardRow,
  BatchDashboardSummary,
  BatchItemStatus,
  ReviewError,
  VerificationReport
} from '../shared/contracts/review';
import {
  isReviewExtractionFailure
} from './review-extraction';
import type { ParsedBatchCsvRow } from './batch-csv';
import type { MemoryUploadedLabel, ParsedReviewFields } from './review-intake';
import type { StoredBatchAssignment, StoredBatchImage } from './batch-session-types';

export function toMemoryUploadedLabel(image: StoredBatchImage): MemoryUploadedLabel {
  return {
    fieldname: 'label',
    originalname: image.filename,
    encoding: '7bit',
    mimetype: image.mimeType,
    size: image.sizeBytes,
    stream: Readable.from(image.buffer),
    destination: '',
    filename: '',
    path: '',
    buffer: image.buffer
  };
}

export function buildParsedReviewFields(row: ParsedBatchCsvRow): ParsedReviewFields {
  const fields = {
    beverageTypeHint: row.beverageType,
    origin: row.origin,
    brandName: row.brandName || undefined,
    fancifulName: row.fancifulName || undefined,
    classType: row.classType || undefined,
    alcoholContent: row.alcoholContent || undefined,
    netContents: row.netContents || undefined,
    applicantAddress: row.applicantAddress || undefined,
    country: row.country || undefined,
    formulaId: row.formulaId || undefined,
    appellation: row.appellation || undefined,
    vintage: row.vintage || undefined,
    varietals: []
  };

  return {
    fields,
    hasApplicationData: Boolean(
      fields.brandName ||
        fields.fancifulName ||
        fields.classType ||
        fields.alcoholContent ||
        fields.netContents ||
        fields.applicantAddress ||
        fields.country ||
        fields.formulaId ||
        fields.appellation ||
        fields.vintage
    )
  };
}

export function buildDashboardRow(input: {
  assignment: StoredBatchAssignment;
  report: VerificationReport;
  completedOrder: number;
}): BatchDashboardRow {
  return {
    rowId: input.assignment.row.id,
    reportId: input.report.id,
    imageId: input.assignment.image.id,
    filename: input.assignment.image.filename,
    brandName: input.assignment.row.brandName,
    classType: input.assignment.row.classType,
    beverageType: input.report.beverageType,
    status: verdictToBatchStatus(input.report.verdict),
    previewUrl: null,
    isPdf: input.assignment.image.isPdf,
    sizeLabel: input.assignment.image.sizeLabel,
    issues: summarizeIssues(input.report),
    confidenceState: input.report.extractionQuality.state,
    errorMessage: null,
    completedOrder: input.completedOrder
  };
}

export function buildErroredRow(input: {
  assignment: StoredBatchAssignment;
  completedOrder: number;
  error: ReviewError;
}): BatchDashboardRow {
  return {
    rowId: input.assignment.row.id,
    reportId: null,
    imageId: input.assignment.image.id,
    filename: input.assignment.image.filename,
    brandName: input.assignment.row.brandName,
    classType: input.assignment.row.classType,
    beverageType: normalizeBatchBeverageType(input.assignment.row.beverageType),
    status: 'error',
    previewUrl: null,
    isPdf: input.assignment.image.isPdf,
    sizeLabel: input.assignment.image.sizeLabel,
    issues: {
      blocker: 0,
      major: 0,
      minor: 0,
      note: 0
    },
    confidenceState: 'low-confidence',
    errorMessage: input.error.message,
    completedOrder: input.completedOrder
  };
}

export function emptySummary(): BatchDashboardSummary {
  return {
    pass: 0,
    review: 0,
    fail: 0,
    error: 0
  };
}

export function incrementSummary(
  summary: BatchDashboardSummary,
  status: BatchItemStatus
) {
  summary[status] += 1;
}

export function summarizeRows(rows: BatchDashboardRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary[row.status] += 1;
      return summary;
    },
    emptySummary()
  );
}

export function normalizeProcessingError(error: unknown): ReviewError {
  if (isReviewExtractionFailure(error)) {
    return error.error;
  }

  return {
    kind: 'unknown',
    message: 'We could not finish this item right now.',
    retryable: true
  };
}

function normalizeBatchBeverageType(value: string) {
  if (
    value === 'distilled-spirits' ||
    value === 'wine' ||
    value === 'malt-beverage'
  ) {
    return value;
  }

  return 'unknown' as const;
}

function summarizeIssues(report: VerificationReport) {
  const issues = {
    blocker: 0,
    major: 0,
    minor: 0,
    note: 0
  };

  for (const check of [...report.checks, ...report.crossFieldChecks]) {
    if (check.status === 'pass' || check.status === 'info') {
      continue;
    }

    issues[check.severity] += 1;
  }

  return issues;
}

function verdictToBatchStatus(verdict: VerificationReport['verdict']): BatchItemStatus {
  if (verdict === 'approve') {
    return 'pass';
  }
  if (verdict === 'reject') {
    return 'fail';
  }
  return 'review';
}
