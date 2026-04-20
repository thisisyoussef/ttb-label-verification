import { useCallback } from 'react';

import { formatFileSize } from '../shared/batch-file-meta';
import type { Mode, View } from './appTypes';
import { seedScenarios } from './scenarios';
import type { SingleReviewFlow } from './singleReviewFlowSupport';
import { resolveToolbenchAssetRoute } from './toolbenchRouteState';
import type { LabelImage } from './types';
import { buildToolbenchSampleLoadState } from './toolbench/toolbenchSingleSample';
import type { SampleFields } from './toolbench/toolbenchSampleSupport';
import type { BatchWorkflow } from './useBatchWorkflow';

function toLabelImage(file: File, demoScenarioId?: string): LabelImage {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    sizeLabel: formatFileSize(file.size),
    demoScenarioId
  };
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, '');
}

export function useAppToolbench(options: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  setView: (view: View) => void;
  single: SingleReviewFlow;
  batch: BatchWorkflow;
}) {
  const handleToolbenchLoadImage = useCallback(
    (file: File) => {
      const route = resolveToolbenchAssetRoute({
        mode: options.mode,
        kind: 'image'
      });

      const scenario =
        seedScenarios.find((candidate) => candidate.id === stripExtension(file.name)) ??
        null;

      if (route === 'batch-image') {
        options.batch.onSelectLiveImages([file]);
        return;
      }

      options.single.onImagesChange(toLabelImage(file, scenario?.id), null);
      if (scenario) {
        options.single.onSelectScenario(scenario);
      }
      if (options.mode !== 'single') {
        options.batch.onSelectMode('single', options.mode);
      }
    },
    [options.batch, options.mode, options.single]
  );

  const handleToolbenchLoadCsv = useCallback(
    (file: File) => {
      const route = resolveToolbenchAssetRoute({
        mode: options.mode,
        kind: 'csv'
      });

      if (route !== 'batch-csv') {
        return;
      }

      options.batch.onSelectLiveCsv(file);
      if (options.mode !== 'batch') {
        options.batch.onSelectMode('batch', options.mode);
      }
    },
    [options.batch, options.mode]
  );

  const handleToolbenchReset = useCallback(() => {
    options.single.reset();
    options.batch.reset();
    options.setMode('single');
    options.setView('intake');
  }, [options.batch, options.setMode, options.setView, options.single]);

  const handleToolbenchSwitchMode = useCallback(
    (next: Mode) => {
      options.setMode(next);
      options.setView(next === 'batch' ? 'batch-intake' : 'intake');
    },
    [options.setMode, options.setView]
  );

  const handleToolbenchLoadBatch = useCallback(
    (_images: File[], _csv: File) => {
      options.batch.onSelectBatchSeed('seed-clean-six');
      if (options.mode !== 'batch') {
        options.batch.onSelectMode('batch', options.mode);
      }
      options.setView('batch-intake');
    },
    [options.batch, options.mode, options.setView]
  );

  const handleToolbenchLoadSample = useCallback(
    (files: File[], fields: SampleFields, imageId: string) => {
      const [primaryFile, secondaryFile] = files.slice(0, 2);
      if (!primaryFile) {
        return;
      }

      const scenario =
        seedScenarios.find(
          (candidate) =>
            candidate.id === imageId ||
            stripExtension(candidate.imageAsset?.filename ?? '') === imageId
        ) ?? null;
      const primaryImage = toLabelImage(primaryFile, scenario?.id);
      const secondaryImage = secondaryFile
        ? toLabelImage(secondaryFile, scenario?.id)
        : null;
      options.single.onLoadToolbenchSample(
        primaryImage,
        secondaryImage,
        buildToolbenchSampleLoadState(fields)
      );
      if (scenario) {
        options.single.onSelectScenario(scenario);
      }

      if (options.mode !== 'single') {
        options.batch.onSelectMode('single', options.mode);
      }
      options.setView('intake');
    },
    [options.batch, options.mode, options.setView, options.single]
  );

  return {
    handleToolbenchLoadBatch,
    handleToolbenchLoadCsv,
    handleToolbenchLoadImage,
    handleToolbenchLoadSample,
    handleToolbenchReset,
    handleToolbenchSwitchMode
  };
}
