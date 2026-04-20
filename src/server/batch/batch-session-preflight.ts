import { randomUUID } from 'node:crypto';

import {
  BATCH_LABEL_CAP,
  MAX_LABEL_UPLOAD_BYTES,
  batchPreflightRequestSchema,
  batchPreflightResponseSchema
} from '../../shared/contracts/review';
import {
  buildBatchFileError,
  formatFileSize,
  hasSupportedLabelFileType,
  normalizeFilenameForComparison
} from '../../shared/batch-file-meta';
import { buildBatchMatching } from './batch-matching';
import { parseBatchCsv } from './batch-csv';
import { emptySummary } from './batch-session-helpers';
import type {
  BatchSession,
  StoredBatchImage,
  UploadedBatchFile
} from './batch-session-types';

export function createBatchSessionPreflight(input: {
  manifest: unknown;
  imageFiles: UploadedBatchFile[];
  csvFile: UploadedBatchFile;
}): BatchSession {
  const manifest = batchPreflightRequestSchema.parse(input.manifest);
  const acceptedImages = collectAcceptedImages({
    manifestImages: manifest.images,
    imageFiles: input.imageFiles
  });
  const csv = parseBatchCsv({
    filename: input.csvFile.originalname,
    text: input.csvFile.buffer.toString('utf8')
  });
  const sessionId = randomUUID();
  const rows = csv.success ? csv.rows : [];
  const matching = csv.success
    ? buildBatchMatching({
        images: [...acceptedImages.images.values()].map((image) => ({
          id: image.id,
          filename: image.filename
        })),
        rows
      })
    : {
        matched: [],
        ambiguous: [],
        unmatchedImageIds: [...acceptedImages.images.keys()],
        unmatchedRowIds: []
      };

  const preflight = batchPreflightResponseSchema.parse({
    batchSessionId: sessionId,
    csvHeaders: csv.success ? csv.headers : [],
    csvRows: csv.success ? csv.preview.rows : [],
    matching,
    csvError: csv.success ? undefined : csv.error,
    fileErrors: acceptedImages.fileErrors
  });

  return {
    id: sessionId,
    images: acceptedImages.images,
    rows,
    preflight,
    assignments: new Map(),
    results: new Map(),
    reports: new Map(),
    phase: 'prepared',
    totals: {
      started: 0,
      done: 0
    },
    summary: emptySummary(),
    cancelRequested: false
  };
}

function collectAcceptedImages(input: {
  manifestImages: Array<{ clientId: string }>;
  imageFiles: UploadedBatchFile[];
}) {
  const images = new Map<string, StoredBatchImage>();
  const fileErrors: ReturnType<typeof buildBatchFileError>[] = [];
  const seenFilenames = new Set<string>();

  input.manifestImages.forEach((meta, index) => {
    const file = input.imageFiles[index];
    if (!file) {
      return;
    }

    if (index >= BATCH_LABEL_CAP) {
      fileErrors.push(
        buildBatchFileError({
          filename: file.originalname,
          reason: 'over-cap'
        })
      );
      return;
    }

    if (
      !hasSupportedLabelFileType({
        filename: file.originalname,
        mimeType: file.mimetype
      })
    ) {
      fileErrors.push(
        buildBatchFileError({
          filename: file.originalname,
          reason: 'unsupported-type'
        })
      );
      return;
    }

    if (file.size > MAX_LABEL_UPLOAD_BYTES) {
      fileErrors.push(
        buildBatchFileError({
          filename: file.originalname,
          reason: 'oversized'
        })
      );
      return;
    }

    const normalizedName = normalizeFilenameForComparison(file.originalname);
    if (seenFilenames.has(normalizedName)) {
      fileErrors.push(
        buildBatchFileError({
          filename: file.originalname,
          reason: 'duplicate'
        })
      );
      return;
    }
    seenFilenames.add(normalizedName);

    images.set(meta.clientId, {
      id: meta.clientId,
      filename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sizeLabel: formatFileSize(file.size),
      isPdf: file.mimetype === 'application/pdf',
      buffer: file.buffer
    });
  });

  return { images, fileErrors };
}
