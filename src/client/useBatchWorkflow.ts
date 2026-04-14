import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SEED_BATCH_ID,
  findSeedBatch,
  STREAM_CANCELLED,
  STREAM_RUNNING_MIXED,
  STREAM_SEEDS,
  type SeedBatch
} from './batchScenarios';
import {
  revokeBatchLabelImages
} from './batch-runtime';
import {
  cloneSeed,
  emptyBatchSeedState,
  summarizeItems,
  updateMatching
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
      selectLiveImages({
        files,
        batchSeedImages: batchSeed.images,
        batchCsvFile,
        batchPreflightRequestRef,
        setBatchSessionId,
        setBatchSeed,
        setBatchItems,
        setBatchProgress,
        setBatchPhase,
        setPreviewImage,
        resetDashboardSeed: dashboard.onSelectDashboardSeed
      });
    },
    onSelectLiveCsv: (file) => {
      setBatchCsvFile(file);
      selectLiveCsv({
        file,
        batchImages: batchSeed.images,
        batchPreflightRequestRef,
        setBatchSessionId,
        setBatchSeed
      });
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
