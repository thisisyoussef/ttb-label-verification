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
    secondaryImageId: string | null;
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
      matched.push(
        batchMatchedPairSchema.parse({
          imageId: image.id,
          secondaryImageId: null,
          row: toBatchCsvRow(row),
          source: 'filename'
        })
      );
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
        secondaryImageId: null,
        row: toBatchCsvRow(row),
        source: 'order'
      })
    );
  }

  const matchedByRowId = new Map(matched.map((entry) => [entry.row.id, entry]));
  const rowsBySecondaryFilename = new Map<string, string[]>();

  for (const row of input.rows) {
    if (!matchedByRowId.has(row.id)) {
      continue;
    }

    const normalized = normalizeFilenameForComparison(row.secondaryFilenameHint);
    if (normalized.length === 0) {
      continue;
    }

    const existing = rowsBySecondaryFilename.get(normalized) ?? [];
    existing.push(row.id);
    rowsBySecondaryFilename.set(normalized, existing);
  }

  for (const image of input.images) {
    if (usedImageIds.has(image.id)) {
      continue;
    }

    const normalized = normalizeFilenameForComparison(image.filename);
    const candidateRowIds = rowsBySecondaryFilename.get(normalized) ?? [];
    if (candidateRowIds.length !== 1) {
      continue;
    }

    const matchedEntry = matchedByRowId.get(candidateRowIds[0]!);
    if (!matchedEntry || matchedEntry.secondaryImageId) {
      continue;
    }

    matchedEntry.secondaryImageId = image.id;
    usedImageIds.add(image.id);
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
    secondaryFilenameHint: row.secondaryFilenameHint,
    brandName: row.brandName,
    classType: row.classType
  };
}
