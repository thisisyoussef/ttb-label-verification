import { batchAmbiguousSchema, batchMatchedPairSchema, type BatchCsvRow } from '../shared/contracts/review';
import { normalizeFilenameForComparison } from '../shared/batch-file-meta';
import type { ParsedBatchCsvRow } from './batch-csv';

type MatchImage = {
  id: string;
  filename: string;
};

export function buildBatchMatching(input: {
  images: MatchImage[];
  rows: ParsedBatchCsvRow[];
}) {
  const matched: Array<{
    imageId: string;
    row: BatchCsvRow;
    source: 'filename' | 'order';
  }> = [];
  const ambiguous: Array<{
    imageId: string;
    candidates: BatchCsvRow[];
  }> = [];

  const usedImageIds = new Set<string>();
  const usedRowIds = new Set<string>();
  const ambiguousRowIds = new Set<string>();

  const rowsByFilename = new Map<string, ParsedBatchCsvRow[]>();

  for (const row of input.rows) {
    const normalized = normalizeFilenameForComparison(row.filenameHint);
    if (normalized.length === 0) {
      continue;
    }

    const existing = rowsByFilename.get(normalized) ?? [];
    existing.push(row);
    rowsByFilename.set(normalized, existing);
  }

  for (const image of input.images) {
    const normalized = normalizeFilenameForComparison(image.filename);
    const candidates = rowsByFilename.get(normalized) ?? [];
    if (candidates.length === 0) {
      continue;
    }

    if (candidates.length === 1) {
      const row = candidates[0]!;
      usedImageIds.add(image.id);
      usedRowIds.add(row.id);
      matched.push({
        imageId: image.id,
        row: toBatchCsvRow(row),
        source: 'filename'
      });
      continue;
    }

    usedImageIds.add(image.id);
    candidates.forEach((candidate) => ambiguousRowIds.add(candidate.id));
    ambiguous.push(
      batchAmbiguousSchema.parse({
        imageId: image.id,
        candidates: candidates.map(toBatchCsvRow)
      })
    );
  }

  const remainingImages = input.images.filter((image) => !usedImageIds.has(image.id));
  const remainingRows = input.rows.filter(
    (row) => !usedRowIds.has(row.id) && !ambiguousRowIds.has(row.id)
  );
  const fallbackCount = Math.min(remainingImages.length, remainingRows.length);

  for (let index = 0; index < fallbackCount; index += 1) {
    const image = remainingImages[index]!;
    const row = remainingRows[index]!;
    usedImageIds.add(image.id);
    usedRowIds.add(row.id);
    matched.push(
      batchMatchedPairSchema.parse({
        imageId: image.id,
        row: toBatchCsvRow(row),
        source: 'order'
      })
    );
  }

  return {
    matched,
    ambiguous,
    unmatchedImageIds: input.images
      .filter((image) => !usedImageIds.has(image.id))
      .map((image) => image.id),
    unmatchedRowIds: input.rows
      .filter((row) => !usedRowIds.has(row.id) && !ambiguousRowIds.has(row.id))
      .map((row) => row.id)
  };
}

function toBatchCsvRow(row: ParsedBatchCsvRow): BatchCsvRow {
  return {
    id: row.id,
    rowIndex: row.rowIndex,
    filenameHint: row.filenameHint,
    brandName: row.brandName,
    classType: row.classType
  };
}
