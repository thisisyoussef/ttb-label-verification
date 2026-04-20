import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findSeedBatch,
  STREAM_CANCELLED,
  STREAM_RUNNING_MIXED,
  STREAM_SEEDS,
  STREAM_TERMINAL_MIXED,
  type SeedBatch
} from './batchScenarios';
import { revokeBatchLabelImages } from './batch-runtime';
import {
  type BatchWorkflowSource,
  LIVE_BATCH_SEED_ID,
  cloneSeed,
  emptyBatchSeedState,
  nextBatchWorkflowSource,
  summarizeItems,
  updateMatching,
  usesFixtureBatchSource
} from './appBatchState';
import {
  retryLiveBatchItem,
  selectLiveCsv,
  selectLiveImages,
  startLiveBatchRun
} from './batchWorkflowLive';
import type { Mode, View } from './appTypes';
import { useBatchDashboardFlow, type BatchDashboardFlow } from './useBatchDashboardFlow';
import type {
  BatchPhase,
  BatchProgress,
  BatchStreamItem,
  BatchTerminalSummary
} from './batchTypes';
import type { BatchLabelImage } from './batchTypes';

function emptyBatchProgressState(): BatchProgress {
  return { done: 0, total: 0, secondsRemaining: null };
}

export interface BatchWorkflow extends BatchDashboardFlow {
  batchSeedId: string;
  batchSeed: SeedBatch;
  batchPhase: BatchPhase;
  batchStreamSeedId: string;
  batchItems: BatchStreamItem[];
  retryingItemIds: Set<string>;
  batchProgress: BatchProgress;
  previewImage: BatchLabelImage | null;
  summary: BatchTerminalSummary | null;
  onSelectBatchSeed: (id: string) => void;
  onSelectStreamSeed: (id: string) => void;
  onSelectLiveImages: (files: File[]) => void;
  onRemoveLiveImage: (imageId: string) => void;
  onSelectLiveCsv: (file: File) => void;
  onLoadLiveBatch: (images: File[], csv: File) => void;
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
  const [batchSource, setBatchSource] = useState<BatchWorkflowSource>('live');
  const [batchSeedId, setBatchSeedId] = useState<string>(LIVE_BATCH_SEED_ID);
  const [batchSeed, setBatchSeed] = useState<SeedBatch>(() => emptyBatchSeedState());
  const [batchSessionId, setBatchSessionId] = useState<string | null>(null);
  const [batchCsvFile, setBatchCsvFile] = useState<File | null>(null);
  const [batchPhase, setBatchPhase] = useState<BatchPhase>('intake');
  const [batchStreamSeedId, setBatchStreamSeedId] = useState<string>(
    STREAM_RUNNING_MIXED.id
  );
  const [batchItems, setBatchItems] = useState<BatchStreamItem[]>([]);
  const [retryingItemIds, setRetryingItemIds] = useState<Set<string>>(() => new Set<string>());
  const [batchProgress, setBatchProgress] = useState<BatchProgress>(() => emptyBatchProgressState());
  const [previewImage, setPreviewImage] = useState<BatchLabelImage | null>(null);
  const batchPreflightRequestRef = useRef<number>(0);
  const batchRunAbortRef = useRef<AbortController | null>(null);
  const batchImagesCleanupRef = useRef<BatchLabelImage[]>([]);
  const fixtureBatchCompletionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fixtureModeActive = usesFixtureBatchSource(batchSource);

  const clearFixtureBatchCompletion = useCallback(() => {
    if (fixtureBatchCompletionRef.current !== null) {
      globalThis.clearTimeout(fixtureBatchCompletionRef.current);
      fixtureBatchCompletionRef.current = null;
    }
  }, []);

  const clearRetryingItems = useCallback(() => setRetryingItemIds(new Set<string>()), []);

  const clearBatchRuntimeState = useCallback(() => {
    setBatchItems([]);
    clearRetryingItems();
    setBatchProgress(emptyBatchProgressState());
    setPreviewImage(null);
  }, [clearRetryingItems]);

  useEffect(() => {
    batchImagesCleanupRef.current = batchSeed.images;
  }, [batchSeed.images]);

  useEffect(() => {
    return () => {
      clearFixtureBatchCompletion();
      batchRunAbortRef.current?.abort();
      revokeBatchLabelImages(batchImagesCleanupRef.current);
    };
  }, [clearFixtureBatchCompletion]);

  const resetLiveBatch = useCallback(() => {
    clearFixtureBatchCompletion();
    batchRunAbortRef.current?.abort();
    batchRunAbortRef.current = null;
    revokeBatchLabelImages(batchSeed.images);
    setBatchSource((current) =>
      nextBatchWorkflowSource({ current, event: 'reset' })
    );
    setBatchSeedId(LIVE_BATCH_SEED_ID);
    setBatchSessionId(null);
    setBatchCsvFile(null);
    setBatchSeed(emptyBatchSeedState());
    setBatchPhase('intake');
    setBatchStreamSeedId(STREAM_RUNNING_MIXED.id);
    clearBatchRuntimeState();
  }, [batchSeed.images, clearBatchRuntimeState, clearFixtureBatchCompletion]);

  const dashboard = useBatchDashboardFlow({
    fixtureControlsEnabled: options.fixtureControlsEnabled,
    fixtureModeActive,
    setView: options.setView,
    batchSessionId,
    batchSeedImages: batchSeed.images,
    batchStreamSeedId,
    resetLiveBatch: () => {
      if (!fixtureModeActive) {
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

  const switchFixtureToLiveInput = () => {
    clearFixtureBatchCompletion();
    setBatchSource((current) =>
      nextBatchWorkflowSource({ current, event: 'live-input-selected' })
    );
    setBatchSeedId(LIVE_BATCH_SEED_ID);
    setBatchSessionId(null);
    setBatchSeed(emptyBatchSeedState());
    setBatchPhase('intake');
    clearBatchRuntimeState();
    dashboard.reset();
    dashboard.resetDashboardSeed();
  };

  return {
    ...dashboard,
    batchSeedId,
    batchSeed,
    batchPhase,
    batchStreamSeedId,
    batchItems,
    retryingItemIds,
    batchProgress,
    previewImage,
    summary,
    onSelectBatchSeed: (id) => {
      if (!options.fixtureControlsEnabled) {
        return;
      }

      clearFixtureBatchCompletion();
      batchRunAbortRef.current?.abort();
      batchRunAbortRef.current = null;
      revokeBatchLabelImages(batchSeed.images);
      setBatchSource((current) =>
        nextBatchWorkflowSource({ current, event: 'fixture-selected' })
      );
      setBatchSeedId(id);
      setBatchSessionId(null);
      setBatchCsvFile(null);
      setBatchSeed(cloneSeed(findSeedBatch(id)));
      setBatchPhase('intake');
      setBatchItems([]);
      setRetryingItemIds(new Set<string>());
      setBatchProgress(emptyBatchProgressState());
      setPreviewImage(null);
      dashboard.reset();
      dashboard.resetDashboardSeed();
    },
    onSelectStreamSeed: (id) => {
      if (!options.fixtureControlsEnabled) {
        return;
      }

      const seed = STREAM_SEEDS.find((entry) => entry.id === id);
      if (!seed) return;

      clearFixtureBatchCompletion();
      batchRunAbortRef.current?.abort();
      batchRunAbortRef.current = null;
      revokeBatchLabelImages(batchSeed.images);
      setBatchSource((current) =>
        nextBatchWorkflowSource({ current, event: 'stream-seed-selected' })
      );
      setBatchSeedId(LIVE_BATCH_SEED_ID);
      setBatchSessionId(null);
      setBatchCsvFile(null);
      setBatchSeed(emptyBatchSeedState());
      setBatchStreamSeedId(id);
      setBatchItems([...seed.items]);
      setRetryingItemIds(new Set<string>());
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
      const liveBatchImages = fixtureModeActive ? [] : batchSeed.images;

      if (fixtureModeActive) {
        switchFixtureToLiveInput();
      } else {
        setBatchSeedId(LIVE_BATCH_SEED_ID);
      }

      selectLiveImages({
        files,
        batchSeedImages: liveBatchImages,
        batchCsvFile,
        batchPreflightRequestRef,
        setBatchSessionId,
        setBatchSeed,
        setBatchItems,
        setBatchProgress,
        setBatchPhase,
        setPreviewImage,
        resetDashboardSeed: dashboard.resetDashboardSeed
      });
    },
    onRemoveLiveImage: (imageId) => {
      const currentImages = batchSeed.images;
      if (currentImages.length === 0) return;
      const survivors = currentImages.filter((img) => img.id !== imageId);
      if (survivors.length === currentImages.length) return; // not found

      const removed = currentImages.find((img) => img.id === imageId);
      if (removed?.previewUrl) {
        try {
          URL.revokeObjectURL(removed.previewUrl);
        } catch {
          /* best-effort */
        }
      }

      const surviving = survivors
        .map((img) => img.file)
        .filter((f): f is File => f !== null);

      if (surviving.length === 0) {
        setBatchSeed(emptyBatchSeedState());
        setBatchSessionId(null);
        clearRetryingItems();
        setPreviewImage(null);
        return;
      }

      selectLiveImages({
        files: surviving,
        batchSeedImages: [],
        batchCsvFile,
        batchPreflightRequestRef,
        setBatchSessionId,
        setBatchSeed,
        setBatchItems,
        setBatchProgress,
        setBatchPhase,
        setPreviewImage,
        resetDashboardSeed: dashboard.resetDashboardSeed
      });
    },
    onSelectLiveCsv: (file) => {
      const liveBatchImages = fixtureModeActive ? [] : batchSeed.images;

      if (fixtureModeActive) {
        switchFixtureToLiveInput();
      } else {
        setBatchSeedId(LIVE_BATCH_SEED_ID);
      }

      setBatchCsvFile(file);
      selectLiveCsv({
        file,
        batchImages: liveBatchImages,
        batchPreflightRequestRef,
        setBatchSessionId,
        setBatchSeed
      });
    },
    onLoadLiveBatch: (files, csv) => {
      if (fixtureModeActive) {
        switchFixtureToLiveInput();
      } else {
        setBatchSeedId(LIVE_BATCH_SEED_ID);
      }

      setBatchCsvFile(csv);
      selectLiveImages({
        files,
        batchSeedImages: [],
        batchCsvFile: csv,
        batchPreflightRequestRef,
        setBatchSessionId,
        setBatchSeed,
        setBatchItems,
        setBatchProgress,
        setBatchPhase,
        setPreviewImage,
        resetDashboardSeed: dashboard.resetDashboardSeed
      });
    },
    onSelectMode: (next, currentMode) => {
      if (next === currentMode) return;
      options.setMode(next);
      if (next === 'single') {
        options.setView('intake');
        setRetryingItemIds(new Set<string>());
        return;
      }
      if (!fixtureModeActive && batchSeed.images.length === 0 && batchSeed.csv === null) {
        setBatchSeedId(LIVE_BATCH_SEED_ID);
        setBatchSeed(emptyBatchSeedState());
      }
      options.setView('batch-intake');
      setBatchPhase('intake');
    },
    onStartBatchFromIntake: () => {
      if (fixtureModeActive) {
        clearFixtureBatchCompletion();
        setBatchStreamSeedId(STREAM_RUNNING_MIXED.id);
        setBatchItems([...STREAM_RUNNING_MIXED.items]);
        clearRetryingItems();
        setBatchProgress({
          done: STREAM_RUNNING_MIXED.doneOverride ?? 0,
          total: STREAM_RUNNING_MIXED.total,
          secondsRemaining: STREAM_RUNNING_MIXED.secondsRemaining ?? null
        });
        setBatchPhase('running');
        options.setView('batch-processing');
        fixtureBatchCompletionRef.current = globalThis.setTimeout(() => {
          setBatchStreamSeedId(STREAM_TERMINAL_MIXED.id);
          setBatchItems([...STREAM_TERMINAL_MIXED.items]);
          clearRetryingItems();
          setBatchProgress({
            done: STREAM_TERMINAL_MIXED.doneOverride ?? STREAM_TERMINAL_MIXED.total,
            total: STREAM_TERMINAL_MIXED.total,
            secondsRemaining: 0
          });
          setBatchPhase('terminal');
          fixtureBatchCompletionRef.current = null;
        }, 8000);
        return;
      }

      void startLiveBatchRun({
        batchCsvFile,
        batchSessionId,
        batchSeed,
        batchPreflightRequestRef,
        batchRunAbortRef,
        setBatchSessionId,
        setBatchSeed,
        setBatchItems,
        setBatchProgress,
        setBatchPhase,
        resetDashboard: dashboard.reset,
        setView: options.setView
      });
      clearRetryingItems();
    },
    onCancelBatchRun: () => {
      if (fixtureModeActive) {
        clearFixtureBatchCompletion();
        setBatchStreamSeedId(STREAM_CANCELLED.id);
        setBatchItems([...STREAM_CANCELLED.items]);
        clearRetryingItems();
        setBatchProgress({
          done: STREAM_CANCELLED.doneOverride ?? 0,
          total: STREAM_CANCELLED.total,
          secondsRemaining: 0
        });
        setBatchPhase('cancelled');
        return;
      }

      setBatchPhase('cancelled');
      clearRetryingItems();
      if (batchSessionId) {
        void fetch(`/api/batch/${batchSessionId}/cancel`, { method: 'POST' });
      }
    },
    onRetryBatchItem: (itemId) => {
      if (fixtureModeActive) {
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

      void retryLiveBatchItem({
        itemId,
        batchSessionId,
        batchSeedImages: batchSeed.images,
        setRetryingItemIds,
        setBatchItems
      });
    },
    onBatchBackToIntake: () => {
      clearFixtureBatchCompletion();
      options.setView('batch-intake');
      setBatchPhase('intake');
      clearRetryingItems();
    },
    onReturnToSingle: () => {
      options.setMode('single');
      options.setView('intake');
      if (!fixtureModeActive) {
        resetLiveBatch();
        dashboard.resetDashboardSeed();
      } else {
        clearFixtureBatchCompletion();
        setBatchPhase('intake');
        clearRetryingItems();
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
      clearRetryingItems();
      resetLiveBatch();
      dashboard.resetDashboardSeed();
    }
  };
}
