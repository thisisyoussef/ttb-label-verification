import type {
  BatchDashboardRow,
  BatchDashboardSummary,
  BatchPreflightResponse,
  VerificationReport
} from '../../shared/contracts/review';
import type { ParsedBatchCsvRow } from './batch-csv';

export type UploadedBatchFile = Express.Multer.File;

export type StoredBatchImage = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  isPdf: boolean;
  buffer: Buffer;
};

export type StoredBatchAssignment = {
  primaryImage: StoredBatchImage;
  secondaryImage: StoredBatchImage | null;
  row: ParsedBatchCsvRow;
};

export type StoredBatchResult = {
  row: BatchDashboardRow;
  assignment: StoredBatchAssignment;
};

export type BatchSession = {
  id: string;
  images: Map<string, StoredBatchImage>;
  rows: ParsedBatchCsvRow[];
  preflight: BatchPreflightResponse;
  assignments: Map<string, StoredBatchAssignment>;
  results: Map<string, StoredBatchResult>;
  reports: Map<string, VerificationReport>;
  phase: 'prepared' | 'running' | 'complete' | 'cancelled-partial';
  totals: {
    started: number;
    done: number;
  };
  summary: BatchDashboardSummary;
  cancelRequested: boolean;
};

export type RunFrameWriter = (frame: unknown) => Promise<void> | void;
