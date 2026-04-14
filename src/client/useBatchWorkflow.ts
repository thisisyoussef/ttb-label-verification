import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatFileSize } from '../shared/batch-file-meta';
import { batchDashboardResponseSchema } from '../shared/contracts/review';
import { DEFAULT_DASHBOARD_SEED_ID } from './batchDashboardScenarios';
import {
  DEFAULT_SEED_BATCH_ID,
  findSeedBatch,
  STREAM_CANCELLED,
  STREAM_RUNNING_MIXED,
  STREAM_SEEDS,
  type SeedBatch
} from './batchScenarios';
import {
  buildBatchLabelImage,
  buildDashboardSeedFromResponse,
  buildStreamItem,
  revokeBatchLabelImages
} from './batch-runtime';
import {
  countRunnableBatchItems,
  cloneSeed,
  emptyBatchSeedState,
  summarizeItems,
  updateMatching
} from './appBatchState';
import { prepareLiveBatchPreflight } from './appBatchPreflight';
import { streamBatchRun } from './appReviewApi';
import type { Mode, View } from './appTypes';
import { useBatchDashboardFlow, type BatchDashboardFlow } from './useBatchDashboardFlow';
import type {
  BatchPhase,
  BatchProgress,
  BatchStreamItem,
  BatchTerminalSummary
} from './batchTypes';
import type { BatchLabelImage } from './batchTypes';

export interface BatchWorkflow extends BatchDashboardFlow {
  batchSeedId: string;
  batchSeed: SeedBatch;
  batchPhase: BatchPhase;
  batchStreamSeedId: string;
  batchItems: BatchStreamItem[];
  batchProgress: BatchProgress;
  previewImage: BatchLabelImage | null;
  summary: BatchTerminalSummary | null;
  onSelectBatchSeed: (id: string) => void;
  onSelectStreamSeed: (id: string) => void;
  onSelectLiveImages: (files: File[]) => void;
  onSelectLiveCsv: (file: File) => void;
  onSelectMode: (next: Mode, currentMode: Mode) => void;
  onStartBatchFromIntake: () => void;
  onCancelBatchRun: () => void;
  onRetryBatchItem: (itemId: string) => void;
  onBatchBackToIntake: () => void;
  onReturnToSingle: () => void;
  onPickAmbiguous: (imageId: string, rowId: string) => void;
  onDropAmbiguous: (imageId: string) => void;
  onPairUnmatchedImage: (imageId: string, rowId: string) => void;
  onDropUnmatchedImage: (imageId: string) => void;
  onPairUnmatchedRow: (rowId: string, imageId: string) => void;
  onDropUnmatchedRow: (rowId: string) => void;
  onPreviewImage: (image: BatchLabelImage) => void;
  onPreviewStreamItem: (item: BatchStreamItem) => void;
  onClosePreview: () => void;
  reset: () => void;
}

export function useBatchWorkflow(options: {
  fixtureControlsEnabled: boolean;
  setMode: (mode: Mode) => void;
  setView: (view: View) => void;
}): BatchWorkflow {
  const [batchSeedId, setBatchSeedId] = useState<string>(DEFAULT_SEED_BATCH_ID);
  const [batchSeed, setBatchSeed] = useState<SeedBatch>(() =>
    options.fixtureControlsEnabled
      ? cloneSeed(findSeedBatch(DEFAULT_SEED_BATCH_ID))
      : emptyBatchSeedState()
  );
  const [batchSessionId, setBatchSessionId] = useState<string | null>(null);
  const [batchCsvFile, setBatchCsvFile] = useState<File | null>(null);
  const [batchPhase, setBatchPhase] = useState<BatchPhase>('intake');
  const [batchStreamSeedId, setBatchStreamSeedId] = useState<string>(
    STREAM_RUNNING_MIXED.id
  );
  const [batchItems, setBatchItems] = useState<BatchStreamItem[]>(
    () => [...STREAM_RUNNING_MIXED.items]
  );
  const [batchProgress, setBatchProgress] = useState<BatchProgress>(() => ({
    done: STREAM_RUNNING_MIXED.doneOverride ?? 0,
    total: STREAM_RUNNING_MIXED.total,
    secondsRemaining: STREAM_RUNNING_MIXED.secondsRemaining ?? null
  }));
  const [previewImage, setPreviewImage] = useState<BatchLabelImage | null>(null);
  const batchPreflightRequestRef = useRef<number>(0);
  const batchRunAbortRef = useRef<AbortController | null>(null);
  const batchImagesCleanupRef = useRef<BatchLabelImage[]>([]);

  useEffect(() => {
    batchImagesCleanupRef.current = batchSeed.images;
  }, [batchSeed.images]);

  useEffect(() => {
    return () => {
      batchRunAbortRef.current?.abort();
      revokeBatchLabelImages(batchImagesCleanupRef.current);
    };
  }, []);

  const resetLiveBatch = useCallback(() => {
    batchRunAbortRef.current?.abort();
    revokeBatchLabelImages(batchSeed.images);
    setBatchSessionId(null);
    setBatchCsvFile(null);
    setBatchSeed(emptyBatchSeedState());
    setBatchPhase('intake');
    setBatchItems([]);
    setBatchProgress({ done: 0, total: 0, secondsRemaining: null });
    setPreviewImage(null);
  }, [batchSeed.images]);

  const dashboard = useBatchDashboardFlow({
    fixtureControlsEnabled: options.fixtureControlsEnabled,
    setView: options.setView,
    batchSessionId,
    batchSeedImages: batchSeed.images,
    batchStreamSeedId,
    resetLiveBatch: () => {
      if (!options.fixtureControlsEnabled) {
        resetLiveBatch();
      }
      dashboard.reset();
    },
    setBatchSeedError: (message) => {
      setBatchSeed((previous) => ({ ...previous, csvError: message }));
    }
  });

  const summary = useMemo<BatchTerminalSummary | null>(() => {
    if (batchPhase !== 'terminal') return null;
    return summarizeItems(batchItems, batchProgress.total);
  }, [batchItems, batchPhase, batchProgress.total]);

  return {
    ...dashboard,
    batchSeedId,
    batchSeed,
    batchPhase,
    batchStreamSeedId,
    batchItems,
    batchProgress,
    previewImage,
    summary,
    onSelectBatchSeed: (id) => {
      setBatchSeedId(id);
      setBatchSeed(cloneSeed(findSeedBatch(id)));
      setBatchPhase('intake');
    },
    onSelectStreamSeed: (id) => {
      const seed = STREAM_SEEDS.find((entry) => entry.id === id);
      if (!seed) return;
      setBatchStreamSeedId(id);
      setBatchItems([...seed.items]);
      setBatchProgress({
        done: seed.doneOverride ?? 0,
        total: seed.total,
        secondsRemaining: seed.secondsRemaining ?? null
      });
      setBatchPhase(
        seed === STREAM_RUNNING_MIXED
          ? 'running'
          : seed === STREAM_CANCELLED
            ? 'cancelled'
            : 'terminal'
      );
      options.setView('batch-processing');
    },
    onSelectLiveImages: (files) => {
      const nextImages = files.map((file, index) =>
        buildBatchLabelImage(file, `image-${index + 1}-${crypto.randomUUID()}`)
      );

      revokeBatchLabelImages(batchSeed.images);
      setBatchSessionId(null);
      setBatchSeed((previous) => ({
        ...previous,
        images: nextImages,
        fileErrors: [],
        overCap: false,
        matching: emptyBatchSeedState().matching
      }));
      setBatchItems([]);
      setBatchProgress({ done: 0, total: 0, secondsRemaining: null });
      setBatchPhase('intake');
      dashboard.onSelectDashboardSeed(DEFAULT_DASHBOARD_SEED_ID);
      setPreviewImage(null);

      if (batchCsvFile) {
        const requestId = batchPreflightRequestRef.current + 1;
        batchPreflightRequestRef.current = requestId;
        void prepareLiveBatchPreflight({
          nextImages,
          nextCsvFile: batchCsvFile,
          requestId,
          getCurrentRequestId: () => batchPreflightRequestRef.current,
          setBatchSessionId,
          setBatchSeed
        });
      }
    },
    onSelectLiveCsv: (file) => {
      setBatchCsvFile(file);
      setBatchSessionId(null);
      setBatchSeed((previous) => ({
        ...previous,
        csv: {
          filename: file.name,
          sizeLabel: formatFileSize(file.size),
          rowCount: 0,
          headers: [],
          rows: []
        },
        csvError: null,
        fileErrors: previous.fileErrors,
        overCap: false,
        matching: emptyBatchSeedState().matching
      }));

      if (batchSeed.images.length > 0) {
        const requestId = batchPreflightRequestRef.current + 1;
        batchPreflightRequestRef.current = requestId;
        void prepareLiveBatchPreflight({
          nextImages: batchSeed.images,
          nextCsvFile: file,
          requestId,
          getCurrentRequestId: () => batchPreflightRequestRef.current,
          setBatchSessionId,
          setBatchSeed
        });
      }
    },
    onSelectMode: (next, currentMode) => {
      if (next === currentMode) return;
      options.setMode(next);
      if (next === 'single') {
        options.setView('intake');
        return;
      }
      if (!options.fixtureControlsEnabled && batchSeed.images.length === 0 && batchSeed.csv === null) {
        setBatchSeed(emptyBatchSeedState());
      }
      options.setView('batch-intake');
      setBatchPhase('intake');
    },
    onStartBatchFromIntake: () => {
      if (options.fixtureControlsEnabled) {
        setBatchStreamSeedId(STREAM_RUNNING_MIXED.id);
        setBatchItems([...STREAM_RUNNING_MIXED.items]);
        setBatchProgress({
          done: STREAM_RUNNING_MIXED.doneOverride ?? 0,
          total: STREAM_RUNNING_MIXED.total,
          secondsRemaining: STREAM_RUNNING_MIXED.secondsRemaining ?? null
        });
        setBatchPhase('running');
        options.setView('batch-processing');
        return;
      }

      void (async () => {
        if (!batchCsvFile) {
          return;
        }

        const requestId = batchPreflightRequestRef.current + 1;
        batchPreflightRequestRef.current = requestId;
        const ensuredSessionId =
          batchSessionId ??
          (await prepareLiveBatchPreflight({
            nextImages: batchSeed.images,
            nextCsvFile: batchCsvFile,
            requestId,
            getCurrentRequestId: () => batchPreflightRequestRef.current,
            setBatchSessionId,
            setBatchSeed
          }));
        if (!ensuredSessionId) {
          return;
        }

        const controller = new AbortController();
        batchRunAbortRef.current?.abort();
        batchRunAbortRef.current = controller;

        setBatchItems([]);
        setBatchProgress({
          done: 0,
          total: countRunnableBatchItems(batchSeed.matching),
          secondsRemaining: null
        });
        setBatchPhase('running');
        dashboard.reset();
        options.setView('batch-processing');

        try {
          await streamBatchRun({
            batchSessionId: ensuredSessionId,
            matching: batchSeed.matching,
            signal: controller.signal,
            onFrame: (frame) => {
              if (frame.type === 'progress') {
                setBatchProgress({
                  done: frame.done,
                  total: frame.total,
                  secondsRemaining: frame.secondsRemainingEstimate ?? null
                });
                return;
              }

              if (frame.type === 'item') {
                const nextItem = buildStreamItem({
                  frame,
                  images: batchSeed.images
                });
                setBatchItems((previous) => [
                  nextItem,
                  ...previous.filter((item) => item.id !== nextItem.id)
                ]);
                return;
              }

              setBatchProgress({
                done: frame.total,
                total: frame.total,
                secondsRemaining: 0
              });
              setBatchPhase((current) => (current === 'cancelled' ? current : 'terminal'));
            }
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setBatchSeed((previous) => ({
            ...previous,
            csvError:
              error instanceof Error
                ? error.message
                : 'We could not start this batch right now. Try again.'
          }));
          setBatchPhase('intake');
          options.setView('batch-intake');
        }
      })();
    },
    onCancelBatchRun: () => {
      if (options.fixtureControlsEnabled) {
        setBatchStreamSeedId(STREAM_CANCELLED.id);
        setBatchItems([...STREAM_CANCELLED.items]);
        setBatchProgress({
          done: STREAM_CANCELLED.doneOverride ?? 0,
          total: STREAM_CANCELLED.total,
          secondsRemaining: 0
        });
        setBatchPhase('cancelled');
        return;
      }

      setBatchPhase('cancelled');
      if (batchSessionId) {
        void fetch(`/api/batch/${batchSessionId}/cancel`, { method: 'POST' });
      }
    },
    onRetryBatchItem: (itemId) => {
      if (options.fixtureControlsEnabled) {
        setBatchItems((previous) =>
          previous.map((item) =>
            item.id === itemId && item.status === 'error'
              ? { ...item, status: 'review', retryKey: item.retryKey + 1 }
              : item
          )
        );
        return;
      }

      if (!batchSessionId) {
        return;
      }

      void (async () => {
        const response = await fetch(`/api/batch/${batchSessionId}/retry/${itemId}`, {
          method: 'POST'
        });
        if (!response.ok) {
          return;
        }

        const dashboardResponse = batchDashboardResponseSchema.parse(await response.json());
        const nextSeed = buildDashboardSeedFromResponse({
          batchSessionId,
          response: dashboardResponse,
          images: batchSeed.images
        });
        const retriedRow = nextSeed.rows.find((row) => row.imageId === itemId);
        if (retriedRow) {
          setBatchItems((previous) =>
            previous.map((item) =>
              item.id === itemId
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
      })();
    },
    onBatchBackToIntake: () => {
      options.setView('batch-intake');
      setBatchPhase('intake');
    },
    onReturnToSingle: () => {
      options.setMode('single');
      options.setView('intake');
      if (!options.fixtureControlsEnabled) {
        resetLiveBatch();
      } else {
        setBatchPhase('intake');
      }
    },
    onPickAmbiguous: (imageId, rowId) => {
      setBatchSeed((previous) => updateMatching(previous, { type: 'pick-ambiguous', imageId, rowId }));
    },
    onDropAmbiguous: (imageId) => {
      setBatchSeed((previous) => updateMatching(previous, { type: 'drop-ambiguous', imageId }));
    },
    onPairUnmatchedImage: (imageId, rowId) => {
      setBatchSeed((previous) =>
        updateMatching(previous, { type: 'pair-unmatched-image', imageId, rowId })
      );
    },
    onDropUnmatchedImage: (imageId) => {
      setBatchSeed((previous) =>
        updateMatching(previous, { type: 'drop-unmatched-image', imageId })
      );
    },
    onPairUnmatchedRow: (rowId, imageId) => {
      setBatchSeed((previous) =>
        updateMatching(previous, { type: 'pair-unmatched-row', rowId, imageId })
      );
    },
    onDropUnmatchedRow: (rowId) => {
      setBatchSeed((previous) =>
        updateMatching(previous, { type: 'drop-unmatched-row', rowId })
      );
    },
    onPreviewImage: (image) => setPreviewImage(image),
    onPreviewStreamItem: (item) => {
      setPreviewImage({
        id: item.id,
        file: null,
        filename: item.filename,
        previewUrl: item.previewUrl,
        sizeLabel: '',
        isPdf: item.isPdf
      });
    },
    onClosePreview: () => setPreviewImage(null),
    reset: () => {
      dashboard.reset();
      setPreviewImage(null);
      if (!options.fixtureControlsEnabled) {
        resetLiveBatch();
      } else {
        setBatchPhase('intake');
      }
    }
  };
}
