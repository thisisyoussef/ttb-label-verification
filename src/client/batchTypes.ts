import {
  BATCH_CSV_EXPECTED_HEADERS,
  BATCH_CSV_REQUIRED_HEADERS,
  BATCH_LABEL_CAP
} from '../shared/contracts/review';

export interface BatchLabelImage {
  id: string;
  file: File | null;
  filename: string;
  previewUrl: string | null;
  sizeLabel: string;
  isPdf: boolean;
}

export interface BatchCsvRow {
  id: string;
  rowIndex: number;
  filenameHint: string;
  secondaryFilenameHint: string;
  brandName: string;
  classType: string;
}

export interface BatchCsv {
  filename: string;
  sizeLabel: string;
  rowCount: number;
  headers: string[];
  rows: BatchCsvRow[];
}

export const CSV_EXPECTED_HEADERS: string[] = [...BATCH_CSV_EXPECTED_HEADERS];

export const CSV_REQUIRED_HEADERS: string[] = [...BATCH_CSV_REQUIRED_HEADERS];

export interface BatchFileError {
  filename: string;
  reason: 'unsupported-type' | 'oversized' | 'duplicate' | 'over-cap';
  message: string;
}

export type BatchItemStatus = 'pass' | 'review' | 'fail' | 'error';

export interface BatchMatchedPair {
  image: BatchLabelImage;
  secondaryImage: BatchLabelImage | null;
  row: BatchCsvRow;
  source: 'filename' | 'order';
}

export interface BatchAmbiguousItem {
  image: BatchLabelImage;
  candidates: BatchCsvRow[];
  chosenRowId: string | null;
  dropped: boolean;
}

export interface BatchUnmatchedImage {
  image: BatchLabelImage;
  pairedRowId: string | null;
  dropped: boolean;
}

export interface BatchUnmatchedRow {
  row: BatchCsvRow;
  pairedImageId: string | null;
  dropped: boolean;
}

export interface BatchMatchingState {
  matched: BatchMatchedPair[];
  ambiguous: BatchAmbiguousItem[];
  unmatchedImages: BatchUnmatchedImage[];
  unmatchedRows: BatchUnmatchedRow[];
}

export interface BatchStreamItem {
  id: string;
  filename: string;
  identity: string;
  previewUrl: string | null;
  isPdf: boolean;
  secondaryImageId?: string | null;
  secondaryFilename?: string | null;
  secondaryPreviewUrl?: string | null;
  secondaryIsPdf?: boolean | null;
  secondarySizeLabel?: string | null;
  status: BatchItemStatus;
  errorMessage?: string;
  retryKey: number;
}

export interface BatchProgress {
  done: number;
  total: number;
  secondsRemaining: number | null;
}

export type BatchPhase = 'intake' | 'running' | 'cancelled' | 'terminal';

export interface BatchTerminalSummary {
  total: number;
  pass: number;
  review: number;
  fail: number;
  error: number;
}

export const BATCH_CAP = BATCH_LABEL_CAP;

export type BatchDashboardFilter = 'all' | 'reject' | 'review' | 'approve';

export type BatchDashboardSort =
  | 'worst-first'
  | 'filename'
  | 'brand-name'
  | 'completed-order';

export interface BatchDashboardIssues {
  blocker: number;
  major: number;
  minor: number;
  note: number;
}

export interface BatchDashboardRow {
  rowId: string;
  reportId: string | null;
  imageId: string;
  secondaryImageId?: string | null;
  filename: string;
  secondaryFilename?: string | null;
  brandName: string;
  classType: string;
  beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage' | 'unknown';
  status: BatchItemStatus;
  previewUrl: string | null;
  secondaryPreviewUrl?: string | null;
  isPdf: boolean;
  secondaryIsPdf?: boolean | null;
  sizeLabel: string;
  secondarySizeLabel?: string | null;
  issues: BatchDashboardIssues;
  confidenceState: 'ok' | 'low-confidence' | 'no-text-extracted';
  errorMessage: string | null;
  completedOrder: number;
  scenarioId?: string;
}

export interface BatchDashboardSummary {
  pass: number;
  review: number;
  fail: number;
  error: number;
}

export interface BatchDashboardSeed {
  id: string;
  label: string;
  description: string;
  phase: 'complete' | 'cancelled-partial';
  totals: { started: number; done: number };
  summary: BatchDashboardSummary;
  rows: BatchDashboardRow[];
}
