import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findSeedBatch,
  STREAM_CANCELLED,
  STREAM_RUNNING_MIXED,
  STREAM_SEEDS,
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
import type { Mode, View } from '../appTypes';
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
  batchProgress: BatchProgress;
  previewImage: BatchLabelImage | null;
  summary: BatchTerminalSummary | null;
  onSelectBatchSeed: (id: string) => void;
  onSelectStreamSeed: (id: string) => void;
  onSelectLiveImages: (files: File[]) => void;
  onRemoveLiveImage: (imageId: string) => void;
  onSelectLiveCsv: (file: File) => void;
  /**
   * Atomically load both images and the CSV in one call. Needed by the
   * toolbench "Load test batch" path, where calling onSelectLiveImages
   * followed by onSelectLiveCsv would trigger the fixture-mode reset
   * twice — the second reset wipes the images the first call just
   * staged, so the user has to click twice for the preflight to fire
   * with both inputs. This handler performs a single reset, then sets
   * images + csv + preflights in one shot.
   */
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
  const [batchProgress, setBatchProgress] = useState<BatchProgress>(
    () => emptyBatchProgressState()
  );
  const [previewImage, setPreviewImage] = useState<BatchLabelImage | null>(null);
  const batchPreflightRequestRef = useRef<number>(0);
  const batchRunAbortRef = useRef<AbortController | null>(null);
  const batchImagesCleanupRef = useRef<BatchLabelImage[]>([]);
  const fixtureModeActive = usesFixtureBatchSource(batchSource);

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
    setBatchItems([]);
    setBatchProgress(emptyBatchProgressState());
    setPreviewImage(null);
  }, [batchSeed.images]);

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
      if (!options.fixtureControlsEnabled) {
        return;
      }

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
        setBatchSource((current) =>
          nextBatchWorkflowSource({ current, event: 'live-input-selected' })
        );
        setBatchSeedId(LIVE_BATCH_SEED_ID);
        setBatchSessionId(null);
        setBatchCsvFile(null);
        setBatchSeed(emptyBatchSeedState());
        setBatchPhase('intake');
        setBatchItems([]);
        setBatchProgress(emptyBatchProgressState());
        setPreviewImage(null);
        dashboard.reset();
        dashboard.resetDashboardSeed();
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
      // Find the surviving images and rebuild the live batch by replaying
      // them through selectLiveImages starting from empty. We can't mutate
      // the seed directly because preflight + matching state is derived
      // from the image set; a fresh selectLiveImages call recomputes all
      // of that in one pass.
      //
      // Skips when no live images exist yet (nothing to remove) or when
      // the pointed-at image can't be found.
      const currentImages = batchSeed.images;
      if (currentImages.length === 0) return;
      const survivors = currentImages.filter((img) => img.id !== imageId);
      if (survivors.length === currentImages.length) return; // not found

      // Revoke the preview URL for the removed image to release memory.
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
        // All live files removed. Return intake to empty state so the UI
        // shows the drop zone again.
        setBatchSeed(emptyBatchSeedState());
        setBatchSessionId(null);
        setPreviewImage(null);
        return;
      }

      selectLiveImages({
        files: surviving,
        batchSeedImages: [], // start from empty; surviving files replace the set
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
        setBatchSource((current) =>
          nextBatchWorkflowSource({ current, event: 'live-input-selected' })
        );
        setBatchSeedId(LIVE_BATCH_SEED_ID);
        setBatchSessionId(null);
        setBatchSeed(emptyBatchSeedState());
        setBatchPhase('intake');
        setBatchItems([]);
        setBatchProgress(emptyBatchProgressState());
        setPreviewImage(null);
        dashboard.reset();
        dashboard.resetDashboardSeed();
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
      // Single reset (not double) — the per-handler resets in
      // onSelectLiveImages + onSelectLiveCsv each clear the seed
      // independently, which means calling them in sequence wipes
      // whichever one ran first. Here we inline the reset once, then
      // call selectLiveImages with the CSV already in hand so
      // preflight fires with both inputs on the first click.
      if (fixtureModeActive) {
        setBatchSource((current) =>
          nextBatchWorkflowSource({ current, event: 'live-input-selected' })
        );
        setBatchSeedId(LIVE_BATCH_SEED_ID);
        setBatchSessionId(null);
        setBatchSeed(emptyBatchSeedState());
        setBatchPhase('intake');
        setBatchItems([]);
        setBatchProgress(emptyBatchProgressState());
        setPreviewImage(null);
        dashboard.reset();
        dashboard.resetDashboardSeed();
      } else {
        setBatchSeedId(LIVE_BATCH_SEED_ID);
      }

      // Stage the CSV state first so selectLiveImages (which reads
      // batchCsvFile via the closure below) can see it. We also pass
      // `csv` explicitly into the call so the preflight doesn't
      // depend on the React state round-trip.
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
    },
    onCancelBatchRun: () => {
      if (fixtureModeActive) {
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
        setBatchItems
      });
    },
    onBatchBackToIntake: () => {
      options.setView('batch-intake');
      setBatchPhase('intake');
    },
    onReturnToSingle: () => {
      options.setMode('single');
      options.setView('intake');
      if (!fixtureModeActive) {
        resetLiveBatch();
        dashboard.resetDashboardSeed();
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
      resetLiveBatch();
      dashboard.resetDashboardSeed();
    }
  };
}
