import type { MutableRefObject } from 'react';

import { formatFileSize } from '../shared/batch-file-meta';
import { batchDashboardResponseSchema } from '../shared/contracts/review';
import { DEFAULT_DASHBOARD_SEED_ID } from './batchDashboardScenarios';
import {
  buildBatchLabelImage,
  buildDashboardSeedFromResponse,
  buildStreamItem,
  revokeBatchLabelImages
} from './batch-runtime';
import {
  countRunnableBatchItems,
  emptyBatchSeedState
} from './appBatchState';
import { prepareLiveBatchPreflight } from './appBatchPreflight';
import { streamBatchRun } from './appReviewApi';
import type { View } from './appTypes';
import type { SeedBatch } from './batchScenarios';
import type {
  BatchPhase,
  BatchProgress,
  BatchStreamItem
} from './batchTypes';
import type { BatchLabelImage } from './batchTypes';

export function selectLiveImages(input: {
  files: File[];
  batchSeedImages: BatchLabelImage[];
  batchCsvFile: File | null;
  batchPreflightRequestRef: MutableRefObject<number>;
  setBatchSessionId: (value: string | null) => void;
  setBatchSeed: (updater: (previous: SeedBatch) => SeedBatch) => void;
  setBatchItems: (value: BatchStreamItem[]) => void;
  setBatchProgress: (value: BatchProgress) => void;
  setBatchPhase: (value: BatchPhase) => void;
  setPreviewImage: (value: BatchLabelImage | null) => void;
  resetDashboardSeed: (id: string) => void;
}) {
  const nextImages = input.files.map((file, index) =>
    buildBatchLabelImage(file, `image-${index + 1}-${crypto.randomUUID()}`)
  );

  revokeBatchLabelImages(input.batchSeedImages);
  input.setBatchSessionId(null);
  input.setBatchSeed((previous) => ({
    ...previous,
    images: nextImages,
    fileErrors: [],
    overCap: false,
    matching: emptyBatchSeedState().matching
  }));
  input.setBatchItems([]);
  input.setBatchProgress({ done: 0, total: 0, secondsRemaining: null });
  input.setBatchPhase('intake');
  input.resetDashboardSeed(DEFAULT_DASHBOARD_SEED_ID);
  input.setPreviewImage(null);

  if (!input.batchCsvFile) {
    return;
  }

  void requestBatchPreflight({
    nextImages,
    nextCsvFile: input.batchCsvFile,
    batchPreflightRequestRef: input.batchPreflightRequestRef,
    setBatchSessionId: input.setBatchSessionId,
    setBatchSeed: input.setBatchSeed
  });
}

export function selectLiveCsv(input: {
  file: File;
  batchImages: BatchLabelImage[];
  batchPreflightRequestRef: MutableRefObject<number>;
  setBatchSessionId: (value: string | null) => void;
  setBatchSeed: (updater: (previous: SeedBatch) => SeedBatch) => void;
}) {
  input.setBatchSessionId(null);
  input.setBatchSeed((previous) => ({
    ...previous,
    csv: {
      filename: input.file.name,
      sizeLabel: formatFileSize(input.file.size),
      rowCount: 0,
      headers: [],
      rows: []
    },
    csvError: null,
    fileErrors: previous.fileErrors,
    overCap: false,
    matching: emptyBatchSeedState().matching
  }));

  if (input.batchImages.length === 0) {
    return;
  }

  void requestBatchPreflight({
    nextImages: input.batchImages,
    nextCsvFile: input.file,
    batchPreflightRequestRef: input.batchPreflightRequestRef,
    setBatchSessionId: input.setBatchSessionId,
    setBatchSeed: input.setBatchSeed
  });
}

export async function startLiveBatchRun(input: {
  batchCsvFile: File | null;
  batchSessionId: string | null;
  batchSeed: SeedBatch;
  batchPreflightRequestRef: MutableRefObject<number>;
  batchRunAbortRef: MutableRefObject<AbortController | null>;
  setBatchSessionId: (value: string | null) => void;
  setBatchSeed: (updater: (previous: SeedBatch) => SeedBatch) => void;
  setBatchItems: (value: BatchStreamItem[] | ((previous: BatchStreamItem[]) => BatchStreamItem[])) => void;
  setBatchProgress: (value: BatchProgress) => void;
  setBatchPhase: (value: BatchPhase | ((current: BatchPhase) => BatchPhase)) => void;
  resetDashboard: () => void;
  setView: (view: View) => void;
}) {
  if (!input.batchCsvFile) {
    return;
  }

  const ensuredSessionId =
    input.batchSessionId ??
    (await requestBatchPreflight({
      nextImages: input.batchSeed.images,
      nextCsvFile: input.batchCsvFile,
      batchPreflightRequestRef: input.batchPreflightRequestRef,
      setBatchSessionId: input.setBatchSessionId,
      setBatchSeed: input.setBatchSeed
    }));
  if (!ensuredSessionId) {
    return;
  }

  const controller = new AbortController();
  input.batchRunAbortRef.current?.abort();
  input.batchRunAbortRef.current = controller;

  input.setBatchItems([]);
  input.setBatchProgress({
    done: 0,
    total: countRunnableBatchItems(input.batchSeed.matching),
    secondsRemaining: null
  });
  input.setBatchPhase('running');
  input.resetDashboard();
  input.setView('batch-processing');

  try {
    await streamBatchRun({
      batchSessionId: ensuredSessionId,
      matching: input.batchSeed.matching,
      signal: controller.signal,
      onFrame: (frame) => {
        if (frame.type === 'progress') {
          input.setBatchProgress({
            done: frame.done,
            total: frame.total,
            secondsRemaining: frame.secondsRemainingEstimate ?? null
          });
          return;
        }

        if (frame.type === 'item') {
          const nextItem = buildStreamItem({
            frame,
            images: input.batchSeed.images
          });
          input.setBatchItems((previous) => [
            nextItem,
            ...previous.filter((item) => item.id !== nextItem.id)
          ]);
          return;
        }

        input.setBatchProgress({
          done: frame.total,
          total: frame.total,
          secondsRemaining: 0
        });
        input.setBatchPhase((current) =>
          current === 'cancelled' ? current : 'terminal'
        );
      }
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    input.setBatchSeed((previous) => ({
      ...previous,
      csvError:
        error instanceof Error
          ? error.message
          : 'We could not start this batch right now. Try again.'
    }));
    input.setBatchPhase('intake');
    input.setView('batch-intake');
  }
}

export async function retryLiveBatchItem(input: {
  itemId: string;
  batchSessionId: string | null;
  batchSeedImages: BatchLabelImage[];
  setBatchItems: (
    updater: (previous: BatchStreamItem[]) => BatchStreamItem[]
  ) => void;
}) {
  if (!input.batchSessionId) {
    return;
  }

  const response = await fetch(
    `/api/batch/${input.batchSessionId}/retry/${input.itemId}`,
    {
      method: 'POST'
    }
  );
  if (!response.ok) {
    return;
  }

  const dashboardResponse = batchDashboardResponseSchema.parse(
    await response.json()
  );
  const nextSeed = buildDashboardSeedFromResponse({
    batchSessionId: input.batchSessionId,
    response: dashboardResponse,
    images: input.batchSeedImages
  });
  const retriedRow = nextSeed.rows.find((row) => row.imageId === input.itemId);
  if (!retriedRow) {
    return;
  }

  input.setBatchItems((previous) =>
    previous.map((item) =>
      item.id === input.itemId
        ? {
            ...item,
            status: retriedRow.status,
            errorMessage: retriedRow.errorMessage ?? undefined,
            retryKey: item.retryKey + 1
          }
        : item
    )
  );
}

async function requestBatchPreflight(input: {
  nextImages: BatchLabelImage[];
  nextCsvFile: File;
  batchPreflightRequestRef: MutableRefObject<number>;
  setBatchSessionId: (value: string | null) => void;
  setBatchSeed: (updater: (previous: SeedBatch) => SeedBatch) => void;
}) {
  const requestId = input.batchPreflightRequestRef.current + 1;
  input.batchPreflightRequestRef.current = requestId;

  return await prepareLiveBatchPreflight({
    nextImages: input.nextImages,
    nextCsvFile: input.nextCsvFile,
    requestId,
    getCurrentRequestId: () => input.batchPreflightRequestRef.current,
    setBatchSessionId: input.setBatchSessionId,
    setBatchSeed: input.setBatchSeed
  });
}
