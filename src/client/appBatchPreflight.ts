import { buildBatchCsvModel, buildBatchMatchingState } from './batch-runtime';
import { emptyBatchSeedState } from './appBatchState';
import { submitBatchPreflight } from './appReviewApi';
import type { SeedBatch } from './batchScenarios';
import type { BatchLabelImage } from './batchTypes';

export async function prepareLiveBatchPreflight(options: {
  nextImages: BatchLabelImage[];
  nextCsvFile: File;
  requestId: number;
  getCurrentRequestId: () => number;
  setBatchSessionId: (value: string | null) => void;
  setBatchSeed: (
    updater: (previous: SeedBatch) => SeedBatch
  ) => void;
}) {
  options.setBatchSessionId(null);

  try {
    const preflight = await submitBatchPreflight({
      images: options.nextImages,
      csvFile: options.nextCsvFile
    });
    if (options.getCurrentRequestId() !== options.requestId) {
      return null;
    }

    const acceptedImageIds = new Set<string>([
      ...preflight.matching.matched.map((entry) => entry.imageId),
      ...preflight.matching.ambiguous.map((entry) => entry.imageId),
      ...preflight.matching.unmatchedImageIds
    ]);
    options.nextImages
      .filter(
        (image) =>
          acceptedImageIds.size > 0
            ? !acceptedImageIds.has(image.id)
            : preflight.fileErrors.length > 0
      )
      .forEach((image) => {
        if (image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    options.setBatchSessionId(preflight.batchSessionId);
    options.setBatchSeed((previous) => ({
      ...previous,
      images:
        acceptedImageIds.size > 0
          ? options.nextImages.filter((image) => acceptedImageIds.has(image.id))
          : options.nextImages.filter(() => preflight.fileErrors.length === 0),
      csv: buildBatchCsvModel(options.nextCsvFile, preflight),
      csvError: preflight.csvError?.message ?? null,
      fileErrors: preflight.fileErrors,
      overCap: preflight.fileErrors.some((entry) => entry.reason === 'over-cap'),
      matching: buildBatchMatchingState({
        preflight,
        images: options.nextImages
      })
    }));
    return preflight.batchSessionId;
  } catch (error) {
    if (options.getCurrentRequestId() !== options.requestId) {
      return null;
    }

    options.setBatchSeed((previous) => ({
      ...previous,
      csvError:
        error instanceof Error
          ? error.message
          : 'We could not prepare this batch right now. Try again.',
      fileErrors: [],
      overCap: false,
      matching: emptyBatchSeedState().matching
    }));
    return null;
  }
}
