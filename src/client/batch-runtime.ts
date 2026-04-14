import type {
  BatchDashboardResponse,
  BatchPreflightResponse,
  BatchResolution,
  BatchStreamItem as BatchStreamFrameItem
} from '../shared/contracts/review';
import { formatFileSize } from '../shared/batch-file-meta';
import type {
  BatchCsv,
  BatchDashboardRow,
  BatchDashboardSeed,
  BatchLabelImage,
  BatchMatchingState,
  BatchStreamItem
} from './batchTypes';

export function buildBatchLabelImage(file: File, id: string): BatchLabelImage {
  return {
    id,
    file,
    filename: file.name,
    previewUrl: file.type === 'application/pdf' ? null : URL.createObjectURL(file),
    sizeLabel: formatFileSize(file.size),
    isPdf: file.type === 'application/pdf'
  };
}

export function revokeBatchLabelImages(images: BatchLabelImage[]) {
  images.forEach((image) => {
    if (image.previewUrl) {
      URL.revokeObjectURL(image.previewUrl);
    }
  });
}

export function buildBatchCsvModel(
  file: File,
  preflight: BatchPreflightResponse
): BatchCsv {
  return {
    filename: file.name,
    sizeLabel: formatFileSize(file.size),
    rowCount: preflight.csvRows.length,
    headers: preflight.csvHeaders,
    rows: preflight.csvRows.map((row) => ({
      id: row.id,
      rowIndex: row.rowIndex,
      filenameHint: row.filenameHint,
      brandName: row.brandName,
      classType: row.classType
    }))
  };
}

export function buildBatchMatchingState(input: {
  preflight: BatchPreflightResponse;
  images: BatchLabelImage[];
}): BatchMatchingState {
  const imagesById = new Map(input.images.map((image) => [image.id, image]));
  const rowsById = new Map(input.preflight.csvRows.map((row) => [row.id, row]));

  return {
    matched: input.preflight.matching.matched
      .map((entry) => {
        const image = imagesById.get(entry.imageId);
        if (!image) {
          return null;
        }

        return {
          image,
          row: {
            id: entry.row.id,
            rowIndex: entry.row.rowIndex,
            filenameHint: entry.row.filenameHint,
            brandName: entry.row.brandName,
            classType: entry.row.classType
          },
          source: entry.source
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    ambiguous: input.preflight.matching.ambiguous
      .map((entry) => {
        const image = imagesById.get(entry.imageId);
        if (!image) {
          return null;
        }

        return {
          image,
          candidates: entry.candidates.map((row) => ({
            id: row.id,
            rowIndex: row.rowIndex,
            filenameHint: row.filenameHint,
            brandName: row.brandName,
            classType: row.classType
          })),
          chosenRowId: null,
          dropped: false
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    unmatchedImages: input.preflight.matching.unmatchedImageIds
      .map((imageId) => imagesById.get(imageId))
      .filter((image): image is BatchLabelImage => image !== undefined)
      .map((image) => ({
        image,
        pairedRowId: null,
        dropped: false
      })),
    unmatchedRows: input.preflight.matching.unmatchedRowIds
      .map((rowId) => rowsById.get(rowId))
      .filter(
        (row): row is NonNullable<(typeof input.preflight.csvRows)[number]> => row !== undefined
      )
      .map((row) => ({
        row: {
          id: row.id,
          rowIndex: row.rowIndex,
          filenameHint: row.filenameHint,
          brandName: row.brandName,
          classType: row.classType
        },
        pairedImageId: null,
        dropped: false
      }))
  };
}

export function buildBatchResolutions(matching: BatchMatchingState): BatchResolution[] {
  return [
    ...matching.ambiguous
      .filter((item) => item.dropped || item.chosenRowId !== null)
      .map((item) => ({
        imageId: item.image.id,
        action: item.dropped
          ? ({ kind: 'dropped' } as const)
          : ({ kind: 'matched', rowId: item.chosenRowId! } as const)
      })),
    ...matching.unmatchedImages
      .filter((item) => item.dropped || item.pairedRowId !== null)
      .map((item) => ({
        imageId: item.image.id,
        action: item.dropped
          ? ({ kind: 'dropped' } as const)
          : ({ kind: 'matched', rowId: item.pairedRowId! } as const)
      }))
  ];
}

export function buildDashboardSeedFromResponse(input: {
  batchSessionId: string;
  response: BatchDashboardResponse;
  images: BatchLabelImage[];
}): BatchDashboardSeed {
  const imagesById = new Map(input.images.map((image) => [image.id, image]));

  return {
    id: input.batchSessionId,
    label: 'Live batch',
    description: 'Batch results from the live session.',
    phase: input.response.phase,
    totals: input.response.totals,
    summary: input.response.summary,
    rows: input.response.rows.map((row) => overlayDashboardRow(row, imagesById))
  };
}

export function buildStreamItem(input: {
  frame: BatchStreamFrameItem;
  images: BatchLabelImage[];
}): BatchStreamItem {
  const image = input.images.find((candidate) => candidate.id === input.frame.imageId);
  return {
    id: input.frame.imageId,
    filename: input.frame.filename,
    identity: input.frame.identity,
    previewUrl: image?.previewUrl ?? null,
    isPdf: image?.isPdf ?? input.frame.filename.toLowerCase().endsWith('.pdf'),
    status: input.frame.status,
    errorMessage: input.frame.errorMessage,
    retryKey: 0
  };
}

function overlayDashboardRow(
  row: BatchDashboardResponse['rows'][number],
  imagesById: Map<string, BatchLabelImage>
): BatchDashboardRow {
  const image = imagesById.get(row.imageId);
  return {
    ...row,
    previewUrl: image?.previewUrl ?? row.previewUrl,
    isPdf: image?.isPdf ?? row.isPdf,
    sizeLabel: image?.sizeLabel ?? row.sizeLabel,
    scenarioId: undefined
  };
}
