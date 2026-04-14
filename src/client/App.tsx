import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  batchDashboardResponseSchema,
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  reviewErrorSchema,
  verificationReportSchema,
  type ReviewIntakeFields
} from '../shared/contracts/review';
import { formatFileSize } from '../shared/batch-file-meta';
import { BackBreadcrumb } from './BackBreadcrumb';
import { BatchDashboard, type ExportState } from './BatchDashboard';
import { BatchDrillInShell } from './BatchDrillInShell';
import { BatchProcessing } from './BatchProcessing';
import { BatchUpload } from './BatchUpload';
import {
  buildBatchCsvModel,
  buildBatchLabelImage,
  buildBatchMatchingState,
  buildBatchResolutions,
  buildDashboardSeedFromResponse,
  buildStreamItem,
  revokeBatchLabelImages
} from './batch-runtime';
import {
  DEFAULT_DASHBOARD_SEED_ID,
  DASHBOARD_SEEDS,
  findDashboardSeed
} from './batchDashboardScenarios';
import {
  DEFAULT_SEED_BATCH_ID,
  findSeedBatch,
  SEED_BATCHES,
  STREAM_CANCELLED,
  STREAM_RUNNING_MIXED,
  STREAM_SEEDS
} from './batchScenarios';
import type { SeedBatch } from './batchScenarios';
import type {
  BatchDashboardFilter,
  BatchDashboardRow,
  BatchDashboardSeed,
  BatchLabelImage,
  BatchMatchingState,
  BatchPhase,
  BatchProgress,
  BatchStreamItem,
  BatchTerminalSummary
} from './batchTypes';
import { GuidedTourSpotlight } from './GuidedTourSpotlight';
import { HelpLauncher } from './HelpLauncher';
import { getTourSteps, type HelpShowMe } from './helpManifest';
import { loadHelpReplayState, saveHelpReplayState } from './helpReplayState';
import { ImagePreviewOverlay } from './ImagePreviewOverlay';
import { Intake } from './Intake';
import { Processing } from './Processing';
import { Results } from './Results';
import { ScenarioPicker } from './ScenarioPicker';
import { buildReportForScenario } from './resultScenarios';
import { fixturesEnabled, resolveResultReport } from './review-runtime';
import { seedScenarios } from './scenarios';
import type { SeedScenario } from './scenarios';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  ProcessingPhase,
  ProcessingStep,
  ProcessingStepId,
  ResultVariantOverride,
  UIVerificationReport
} from './types';

type View =
  | 'intake'
  | 'processing'
  | 'results'
  | 'batch-intake'
  | 'batch-processing'
  | 'batch-dashboard'
  | 'batch-result';
type Mode = 'single' | 'batch';

const STEP_TEMPLATE: { id: ProcessingStepId; label: string }[] = [
  { id: 'reading-image', label: 'Reading label image' },
  { id: 'extracting-fields', label: 'Extracting structured fields' },
  { id: 'detecting-beverage', label: 'Detecting beverage type' },
  { id: 'running-checks', label: 'Running deterministic checks' },
  { id: 'preparing-evidence', label: 'Preparing evidence' }
];

const STEP_ADVANCE_MS = 900;
const DEFAULT_FAILURE_MESSAGE =
  'The connection dropped while reading the label. Your label and inputs are still here — nothing was saved.';

function buildInitialSteps(): ProcessingStep[] {
  return STEP_TEMPLATE.map((template, index) => ({
    ...template,
    status: index === 0 ? 'active' : 'pending'
  }));
}

function emptyIntake(): IntakeFields {
  const blank = seedScenarios[0];
  if (!blank) throw new Error('seedScenarios must include a blank scenario');
  return { ...blank.fields, varietals: [] };
}

function emptyBatchSeedState(): SeedBatch {
  return {
    id: 'live-batch',
    label: 'Live batch',
    description: 'Live batch review session',
    images: [],
    csv: null,
    csvError: null,
    fileErrors: [],
    overCap: false,
    matching: {
      matched: [],
      ambiguous: [],
      unmatchedImages: [],
      unmatchedRows: []
    }
  };
}

const EXTRACTED_TO_FIELD: Array<{ checkId: string; field: keyof IntakeFields }> = [
  { checkId: 'brand-name', field: 'brandName' },
  { checkId: 'fanciful-name', field: 'fancifulName' },
  { checkId: 'class-type', field: 'classType' },
  { checkId: 'alcohol-content', field: 'alcoholContent' },
  { checkId: 'net-contents', field: 'netContents' },
  { checkId: 'applicant-address', field: 'applicantAddress' }
];

function prefillFromReport(base: IntakeFields, report: UIVerificationReport): IntakeFields {
  const next = { ...base, varietals: base.varietals.map((row) => ({ ...row })) };
  for (const { checkId, field } of EXTRACTED_TO_FIELD) {
    const check = report.checks.find((c) => c.id === checkId);
    const value = check?.extractedValue;
    if (value && value.length > 0) {
      (next[field] as string) = value;
    }
  }
  return next;
}

function normalizeReviewBeverage(
  beverage: BeverageSelection
): ReviewIntakeFields['beverageType'] {
  return beverage === 'unknown' ? 'auto' : beverage;
}

function buildReviewFields(
  beverage: BeverageSelection,
  fields: IntakeFields
): ReviewIntakeFields {
  return {
    beverageType: normalizeReviewBeverage(beverage),
    brandName: fields.brandName,
    fancifulName: fields.fancifulName,
    classType: fields.classType,
    alcoholContent: fields.alcoholContent,
    netContents: fields.netContents,
    applicantAddress: fields.applicantAddress,
    origin: fields.origin,
    country: fields.country,
    formulaId: fields.formulaId,
    appellation: fields.appellation,
    vintage: fields.vintage,
    varietals: fields.varietals.map((row) => ({
      name: row.name,
      percentage: row.percentage
    }))
  };
}

async function submitReview(options: {
  image: LabelImage;
  beverage: BeverageSelection;
  fields: IntakeFields;
  signal: AbortSignal;
}) {
  const formData = new FormData();
  formData.append('label', options.image.file);
  formData.append(
    'fields',
    JSON.stringify(buildReviewFields(options.beverage, options.fields))
  );

  const response = await fetch('/api/review', {
    method: 'POST',
    body: formData,
    signal: options.signal
  });

  if (!response.ok) {
    const fallback = DEFAULT_FAILURE_MESSAGE;

    try {
      const payload = reviewErrorSchema.parse(await response.json());
      return { ok: false as const, message: payload.message };
    } catch {
      return { ok: false as const, message: fallback };
    }
  }

  const report = verificationReportSchema.parse(await response.json());
  return { ok: true as const, report };
}

async function parseApiError(response: Response, fallback: string) {
  try {
    const payload = reviewErrorSchema.parse(await response.json());
    return payload.message;
  } catch {
    return fallback;
  }
}

async function submitBatchPreflight(options: {
  images: BatchLabelImage[];
  csvFile: File;
  signal?: AbortSignal;
}) {
  const formData = new FormData();
  formData.append(
    'manifest',
    JSON.stringify({
      batchClientId: crypto.randomUUID(),
      images: options.images
        .filter((image): image is BatchLabelImage & { file: File } => image.file instanceof File)
        .map((image) => ({
          clientId: image.id,
          filename: image.file.name,
          sizeBytes: image.file.size,
          mimeType: image.file.type
        })),
      csv: {
        filename: options.csvFile.name,
        sizeBytes: options.csvFile.size
      }
    })
  );

  options.images.forEach((image) => {
    if (image.file instanceof File) {
      formData.append('labels', image.file);
    }
  });
  formData.append('csv', options.csvFile);

  const response = await fetch('/api/batch/preflight', {
    method: 'POST',
    body: formData,
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'We could not prepare this batch right now. Try again.')
    );
  }

  return batchPreflightResponseSchema.parse(await response.json());
}

async function streamBatchRun(options: {
  batchSessionId: string;
  matching: BatchMatchingState;
  signal?: AbortSignal;
  onFrame: (frame: ReturnType<typeof batchStreamFrameSchema.parse>) => void;
}) {
  const response = await fetch('/api/batch/run', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      batchSessionId: options.batchSessionId,
      resolutions: buildBatchResolutions(options.matching)
    }),
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'We could not start this batch right now. Try again.')
    );
  }

  if (!response.body) {
    throw new Error('We could not read the batch stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      options.onFrame(batchStreamFrameSchema.parse(JSON.parse(line)));
    }

    if (done) {
      if (buffer.trim().length > 0) {
        options.onFrame(batchStreamFrameSchema.parse(JSON.parse(buffer)));
      }
      break;
    }
  }
}

async function fetchBatchDashboard(batchSessionId: string) {
  const response = await fetch(`/api/batch/${batchSessionId}/summary`);

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'We could not load this batch right now.')
    );
  }

  return batchDashboardResponseSchema.parse(await response.json());
}

async function fetchBatchReport(batchSessionId: string, reportId: string) {
  const response = await fetch(`/api/batch/${batchSessionId}/report/${reportId}`);

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, "We couldn't load this label's details.")
    );
  }

  return verificationReportSchema.parse(await response.json());
}

export function App() {
  const fixtureControlsEnabled = fixturesEnabled({
    isDev: import.meta.env.DEV,
    override: import.meta.env.VITE_ENABLE_DEV_FIXTURES
  });
  const [mode, setMode] = useState<Mode>('single');
  const [view, setView] = useState<View>('intake');
  const [image, setImage] = useState<LabelImage | null>(null);
  const [beverage, setBeverage] = useState<BeverageSelection>('auto');
  const [fields, setFields] = useState<IntakeFields>(emptyIntake);
  const [scenarioId, setScenarioId] = useState<string>('blank');
  const [forceFailure, setForceFailure] = useState<boolean>(false);
  const [variantOverride, setVariantOverride] = useState<ResultVariantOverride>('auto');

  const [batchSeedId, setBatchSeedId] = useState<string>(DEFAULT_SEED_BATCH_ID);
  const [batchSeed, setBatchSeed] = useState<SeedBatch>(() =>
    fixtureControlsEnabled
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

  const initialReplay = useMemo(() => loadHelpReplayState(), []);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [helpNudgeDismissed, setHelpNudgeDismissed] = useState<boolean>(
    initialReplay.firstRunNudgeDismissed || initialReplay.tourCompleted
  );
  const [tourCompleted, setTourCompleted] = useState<boolean>(
    initialReplay.tourCompleted
  );
  const tourSteps = useMemo(() => getTourSteps(), []);

  const persistReplay = useCallback(
    (nudgeDismissed: boolean, completed: boolean) => {
      saveHelpReplayState({
        version: 1,
        firstRunNudgeDismissed: nudgeDismissed,
        tourCompleted: completed
      });
    },
    []
  );

  const [dashboardSeedId, setDashboardSeedId] = useState<string>(DEFAULT_DASHBOARD_SEED_ID);
  const [dashboardSeed, setDashboardSeed] = useState<BatchDashboardSeed>(() =>
    findDashboardSeed(DEFAULT_DASHBOARD_SEED_ID)
  );
  const [reviewedRowIds, setReviewedRowIds] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [drillInRowId, setDrillInRowId] = useState<string | null>(null);
  const [drillInFilter, setDrillInFilter] = useState<BatchDashboardFilter>('all');
  const [drillInRows, setDrillInRows] = useState<BatchDashboardRow[]>([]);
  const [drillInReport, setDrillInReport] = useState<UIVerificationReport | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' });

  const [steps, setSteps] = useState<ProcessingStep[]>(buildInitialSteps);
  const [phase, setPhase] = useState<ProcessingPhase>('running');
  const [failureMessage, setFailureMessage] = useState<string>(DEFAULT_FAILURE_MESSAGE);
  const [report, setReport] = useState<UIVerificationReport | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const batchPreflightRequestRef = useRef<number>(0);
  const batchRunAbortRef = useRef<AbortController | null>(null);
  const imageRef = useRef<LabelImage | null>(null);
  const batchImagesCleanupRef = useRef<BatchLabelImage[]>([]);

  const clearPipelineTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const revokeImage = useCallback((previous: LabelImage | null) => {
    if (previous) URL.revokeObjectURL(previous.previewUrl);
  }, []);

  useEffect(() => {
    imageRef.current = image;
  }, [image]);

  useEffect(() => {
    batchImagesCleanupRef.current = batchSeed.images;
  }, [batchSeed.images]);

  useEffect(() => {
    return () => {
      clearPipelineTimer();
      abortControllerRef.current?.abort();
      batchRunAbortRef.current?.abort();
      revokeImage(imageRef.current);
      revokeBatchLabelImages(batchImagesCleanupRef.current);
    };
  }, [revokeImage]);
  const useFixtureReport = fixtureControlsEnabled && scenarioId !== 'blank';

  const completePipeline = useCallback(
    (requestId: number, liveReport: UIVerificationReport | null) => {
      if (requestId !== requestIdRef.current) return;

      clearPipelineTimer();
      abortControllerRef.current = null;
      setSteps((prev) => prev.map((step) => ({ ...step, status: 'done' })));
      setPhase('terminal');
      setReport(
        resolveResultReport({
          fields,
          liveReport,
          scenarioId,
          useFixtureReport,
          variantOverride
        })
      );
      setView('results');
    },
    [fields, scenarioId, useFixtureReport, variantOverride]
  );

  const failPipeline = useCallback((requestId: number, message: string) => {
    if (requestId !== requestIdRef.current) return;

    clearPipelineTimer();
    abortControllerRef.current = null;
    setFailureMessage(message);
    setSteps((prev) => {
      const next = prev.map((step) => ({ ...step }));
      const activeIndex = next.findIndex((step) => step.status === 'active');

      if (activeIndex === -1) {
        return prev;
      }

      next[activeIndex] = { ...next[activeIndex]!, status: 'failed' };
      return next;
    });
    setPhase('failed');
  }, []);

  const startPipeline = useCallback(
    (shouldFail: boolean, requestId: number) => {
      clearPipelineTimer();
      const initial = buildInitialSteps();
      setSteps(initial);
      setPhase('running');
      setFailureMessage(DEFAULT_FAILURE_MESSAGE);

      const tick = () => {
        if (requestId !== requestIdRef.current) return;

        let shouldContinue = false;
        let failed = false;

        setSteps((prev) => {
          const next = prev.map((step) => ({ ...step }));
          const activeIndex = next.findIndex((step) => step.status === 'active');
          if (activeIndex === -1) return prev;

          if (shouldFail && activeIndex === 2) {
            next[activeIndex] = { ...next[activeIndex]!, status: 'failed' };
            failed = true;
            return next;
          }

          if (activeIndex === next.length - 1) {
            shouldContinue = true;
            return prev;
          }

          next[activeIndex] = { ...next[activeIndex]!, status: 'done' };
          const nextIndex = activeIndex + 1;
          if (nextIndex < next.length) {
            next[nextIndex] = { ...next[nextIndex]!, status: 'active' };
            shouldContinue = true;
          }
          return next;
        });

        if (failed) {
          setPhase('failed');
          return;
        }

        if (shouldContinue) {
          timerRef.current = window.setTimeout(tick, STEP_ADVANCE_MS);
        }
      };

      timerRef.current = window.setTimeout(tick, STEP_ADVANCE_MS);
    },
    []
  );

  const startReview = useCallback(
    async (shouldFail: boolean) => {
      if (!image) return;

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      abortControllerRef.current?.abort();
      setReport(null);
      setView('processing');
      startPipeline(shouldFail, requestId);

      if (shouldFail) {
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await submitReview({
          image,
          beverage,
          fields,
          signal: controller.signal
        });

        if (result.ok) {
          completePipeline(requestId, result.report);
          return;
        }

        failPipeline(requestId, result.message);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error && error.name === 'AbortError'
            ? DEFAULT_FAILURE_MESSAGE
            : 'We could not finish this review. Your label and inputs are still here — nothing was saved.';

        failPipeline(requestId, message);
      }
    },
    [beverage, completePipeline, failPipeline, fields, image, startPipeline]
  );

  const abandonInFlightReview = useCallback(() => {
    clearPipelineTimer();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestIdRef.current += 1;
  }, []);

  const onVerify = () => {
    void startReview(forceFailure);
  };

  const onCancel = () => {
    abandonInFlightReview();
    setView('intake');
  };

  const onBackToIntake = () => {
    abandonInFlightReview();
    setView('intake');
  };

  const onRetry = () => {
    void startReview(false);
  };

  const onImageChange = (next: LabelImage | null) => {
    revokeImage(image);
    setImage(next);
  };

  const onClear = () => {
    revokeImage(image);
    setImage(null);
    setFields(emptyIntake());
    setBeverage('auto');
    setScenarioId('blank');
  };

  const onSelectScenario = (scenario: SeedScenario) => {
    setScenarioId(scenario.id);
    setBeverage(scenario.beverageType);
    setFields({ ...scenario.fields, varietals: scenario.fields.varietals.map((row) => ({ ...row })) });
  };

  const onNewReview = useCallback(() => {
    abandonInFlightReview();
    revokeImage(image);
    setImage(null);
    setFields(emptyIntake());
    setBeverage('auto');
    setScenarioId('blank');
    setVariantOverride('auto');
    setReport(null);
    setView('intake');
  }, [abandonInFlightReview, image, revokeImage]);

  const onRunFullComparison = useCallback(() => {
    if (!report) return;
    setFields((current) => prefillFromReport(current, report));
    setVariantOverride('auto');
    setView('intake');
  }, [report]);

  const onTryAnotherImage = useCallback(() => {
    revokeImage(image);
    setImage(null);
    setVariantOverride('auto');
    setReport(null);
    setView('intake');
  }, [image, revokeImage]);

  const onContinueWithCaution = useCallback(() => {
    setVariantOverride('auto');
    setReport(buildReportForScenario('low-quality-image'));
  }, []);

  const onExportResults = useCallback(() => {
    if (!report) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      imageName: image?.file.name ?? null,
      beverageType: beverage,
      report
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ttb-label-verification-${report.id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [beverage, image, report]);

  const variantOptions = useMemo(
    () =>
      [
        { value: 'auto', label: 'Auto (by scenario)' },
        { value: 'standalone', label: 'Standalone (no app data)' },
        { value: 'no-text-extracted', label: 'No-text-extracted' }
      ] as Array<{ value: ResultVariantOverride; label: string }>,
    []
  );

  const resetLiveBatch = useCallback(() => {
    batchRunAbortRef.current?.abort();
    revokeBatchLabelImages(batchSeed.images);
    setBatchSessionId(null);
    setBatchCsvFile(null);
    setBatchSeed(emptyBatchSeedState());
    setBatchPhase('intake');
    setBatchItems([]);
    setBatchProgress({
      done: 0,
      total: 0,
      secondsRemaining: null
    });
    setDashboardSeed(findDashboardSeed(DEFAULT_DASHBOARD_SEED_ID));
    setDrillInRowId(null);
    setDrillInRows([]);
    setDrillInReport(null);
    setReviewedRowIds(new Set<string>());
    setExportState({ kind: 'idle' });
  }, [batchSeed.images]);

  const prepareLiveBatchPreflight = useCallback(
    async (nextImages: BatchLabelImage[], nextCsvFile: File) => {
      const requestId = batchPreflightRequestRef.current + 1;
      batchPreflightRequestRef.current = requestId;
      setBatchSessionId(null);

      try {
        const preflight = await submitBatchPreflight({
          images: nextImages,
          csvFile: nextCsvFile
        });
        if (batchPreflightRequestRef.current !== requestId) {
          return null;
        }

        const acceptedImageIds = new Set<string>([
          ...preflight.matching.matched.map((entry) => entry.imageId),
          ...preflight.matching.ambiguous.map((entry) => entry.imageId),
          ...preflight.matching.unmatchedImageIds
        ]);
        nextImages
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
        setBatchSessionId(preflight.batchSessionId);
        setBatchSeed((previous) => ({
          ...previous,
          images:
            acceptedImageIds.size > 0
              ? nextImages.filter((image) => acceptedImageIds.has(image.id))
              : nextImages.filter(() => preflight.fileErrors.length === 0),
          csv: buildBatchCsvModel(nextCsvFile, preflight),
          csvError: preflight.csvError?.message ?? null,
          fileErrors: preflight.fileErrors,
          overCap: preflight.fileErrors.some((entry) => entry.reason === 'over-cap'),
          matching: buildBatchMatchingState({
            preflight,
            images: nextImages
          })
        }));
        return preflight.batchSessionId;
      } catch (error) {
        if (batchPreflightRequestRef.current !== requestId) {
          return null;
        }

        setBatchSeed((previous) => ({
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
    },
    []
  );

  const onSelectLiveImages = useCallback(
    (files: File[]) => {
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
      setBatchProgress({
        done: 0,
        total: 0,
        secondsRemaining: null
      });
      setBatchPhase('intake');
      setDashboardSeed(findDashboardSeed(DEFAULT_DASHBOARD_SEED_ID));
      setDrillInRowId(null);
      setDrillInRows([]);
      setDrillInReport(null);
      setReviewedRowIds(new Set<string>());
      setExportState({ kind: 'idle' });

      if (batchCsvFile) {
        void prepareLiveBatchPreflight(nextImages, batchCsvFile);
      }
    },
    [batchCsvFile, batchSeed.images, prepareLiveBatchPreflight]
  );

  const onSelectLiveCsv = useCallback(
    (file: File) => {
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
        void prepareLiveBatchPreflight(batchSeed.images, file);
      }
    },
    [batchSeed.images, prepareLiveBatchPreflight]
  );

  const onSelectMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      setMode(next);
      if (next === 'single') {
        setView('intake');
        return;
      }
      if (!fixtureControlsEnabled && batchSeed.images.length === 0 && batchSeed.csv === null) {
        setBatchSeed(emptyBatchSeedState());
      }
      setView('batch-intake');
      setBatchPhase('intake');
    },
    [batchSeed.csv, batchSeed.images.length, fixtureControlsEnabled, mode]
  );

  const onSelectBatchSeed = useCallback((id: string) => {
    const seed = cloneSeed(findSeedBatch(id));
    setBatchSeedId(id);
    setBatchSeed(seed);
    setBatchPhase('intake');
  }, []);

  const onSelectStreamSeed = useCallback((id: string) => {
    const seed = STREAM_SEEDS.find((s) => s.id === id);
    if (!seed) return;
    setBatchStreamSeedId(id);
    setBatchItems([...seed.items]);
    setBatchProgress({
      done: seed.doneOverride ?? 0,
      total: seed.total,
      secondsRemaining: seed.secondsRemaining ?? null
    });
    if (seed === STREAM_RUNNING_MIXED) {
      setBatchPhase('running');
    } else if (seed === STREAM_CANCELLED) {
      setBatchPhase('cancelled');
    } else {
      setBatchPhase('terminal');
    }
    setView('batch-processing');
  }, []);

  const onStartBatchFromIntake = useCallback(() => {
    if (fixtureControlsEnabled) {
      const runningSeed = STREAM_RUNNING_MIXED;
      setBatchStreamSeedId(runningSeed.id);
      setBatchItems([...runningSeed.items]);
      setBatchProgress({
        done: runningSeed.doneOverride ?? 0,
        total: runningSeed.total,
        secondsRemaining: runningSeed.secondsRemaining ?? null
      });
      setBatchPhase('running');
      setView('batch-processing');
      return;
    }

    void (async () => {
      if (!batchCsvFile) {
        return;
      }

      const ensuredSessionId =
        batchSessionId ??
        (await prepareLiveBatchPreflight(batchSeed.images, batchCsvFile));
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
      setReviewedRowIds(new Set<string>());
      setExportState({ kind: 'idle' });
      setView('batch-processing');

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
        setView('batch-intake');
      }
    })();
  }, [
    batchCsvFile,
    batchSeed.images,
    batchSeed.matching,
    batchSessionId,
    fixtureControlsEnabled,
    prepareLiveBatchPreflight
  ]);

  const onCancelBatchRun = useCallback(() => {
    if (fixtureControlsEnabled) {
      const cancelledSeed = STREAM_CANCELLED;
      setBatchStreamSeedId(cancelledSeed.id);
      setBatchItems([...cancelledSeed.items]);
      setBatchProgress({
        done: cancelledSeed.doneOverride ?? 0,
        total: cancelledSeed.total,
        secondsRemaining: 0
      });
      setBatchPhase('cancelled');
      return;
    }

    setBatchPhase('cancelled');
    if (batchSessionId) {
      void fetch(`/api/batch/${batchSessionId}/cancel`, {
        method: 'POST'
      });
    }
  }, [batchSessionId, fixtureControlsEnabled]);

  const onRetryBatchItem = useCallback((itemId: string) => {
    if (fixtureControlsEnabled) {
      setBatchItems((prev) =>
        prev.map((item) =>
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

      const dashboard = batchDashboardResponseSchema.parse(await response.json());
      const nextSeed = buildDashboardSeedFromResponse({
        batchSessionId,
        response: dashboard,
        images: batchSeed.images
      });
      const retriedRow = nextSeed.rows.find((row) => row.imageId === itemId);
      setDashboardSeed(nextSeed);
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
  }, [batchSeed.images, batchSessionId, fixtureControlsEnabled]);

  const onBatchBackToIntake = useCallback(() => {
    setView('batch-intake');
    setBatchPhase('intake');
  }, []);

  const onBatchOpenDashboard = useCallback(() => {
    if (fixtureControlsEnabled) {
      const matchingDashboardId = batchStreamSeedId.includes('all-pass')
        ? 'dash-terminal-all-pass'
        : batchStreamSeedId.includes('all-fail')
          ? 'dash-terminal-all-fail'
          : batchStreamSeedId.includes('cancelled')
            ? 'dash-cancelled-partial'
            : DEFAULT_DASHBOARD_SEED_ID;
      setDashboardSeedId(matchingDashboardId);
      setDashboardSeed(findDashboardSeed(matchingDashboardId));
      setReviewedRowIds(new Set<string>());
      setExportState({ kind: 'idle' });
      setView('batch-dashboard');
      return;
    }

    if (!batchSessionId) {
      return;
    }

    void (async () => {
      try {
        const response = await fetchBatchDashboard(batchSessionId);
        setDashboardSeed(
          buildDashboardSeedFromResponse({
            batchSessionId,
            response,
            images: batchSeed.images
          })
        );
        setReviewedRowIds(new Set<string>());
        setExportState({ kind: 'idle' });
        setView('batch-dashboard');
      } catch {
        setBatchSeed((previous) => ({
          ...previous,
          csvError: 'We could not load this batch right now.'
        }));
      }
    })();
  }, [batchSeed.images, batchSessionId, batchStreamSeedId, fixtureControlsEnabled]);

  const onSelectDashboardSeed = useCallback((id: string) => {
    setDashboardSeedId(id);
    setDashboardSeed(findDashboardSeed(id));
    setReviewedRowIds(new Set<string>());
    setExportState({ kind: 'idle' });
    setDrillInRowId(null);
    setDrillInReport(null);
    setView('batch-dashboard');
  }, []);

  const onOpenDashboardRow = useCallback(
    (
      row: BatchDashboardRow,
      filter: BatchDashboardFilter,
      rowsInView: BatchDashboardRow[]
    ) => {
      void (async () => {
        let nextReport: UIVerificationReport | null = null;
        try {
          if (!fixtureControlsEnabled && batchSessionId && row.reportId) {
            nextReport = await fetchBatchReport(batchSessionId, row.reportId);
          }
        } catch {
          nextReport = null;
        }

        setDrillInReport(nextReport);
        setDrillInRowId(row.rowId);
        setDrillInFilter(filter);
        setDrillInRows(rowsInView);
        setReviewedRowIds((prev) => {
          const next = new Set(prev);
          next.add(row.rowId);
          return next;
        });
        setView('batch-result');
      })();
    },
    [batchSessionId, fixtureControlsEnabled]
  );

  const moveDrillIn = useCallback(
    async (rows: BatchDashboardRow[], currentRowId: string | null, offset: -1 | 1) => {
      if (currentRowId === null) {
        return;
      }

      const index = rows.findIndex((row) => row.rowId === currentRowId);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) {
        return;
      }

      const nextRow = rows[nextIndex]!;
      let nextReport: UIVerificationReport | null = null;
      try {
        if (!fixtureControlsEnabled && batchSessionId && nextRow.reportId) {
          nextReport = await fetchBatchReport(batchSessionId, nextRow.reportId);
        }
      } catch {
        nextReport = null;
      }

      setReviewedRowIds((previous) => {
        const next = new Set(previous);
        next.add(nextRow.rowId);
        return next;
      });
      setDrillInReport(nextReport);
      setDrillInRowId(nextRow.rowId);
    },
    [batchSessionId, fixtureControlsEnabled]
  );

  const onDrillInPrevious = useCallback(() => {
    void moveDrillIn(drillInRows, drillInRowId, -1);
  }, [drillInRowId, drillInRows, moveDrillIn]);

  const onDrillInNext = useCallback(() => {
    void moveDrillIn(drillInRows, drillInRowId, 1);
  }, [drillInRowId, drillInRows, moveDrillIn]);

  const onRetryDashboardRow = useCallback((row: BatchDashboardRow) => {
    if (fixtureControlsEnabled) {
      setDashboardSeed((prev) => {
        const nextRows = prev.rows.map((candidate) =>
          candidate.rowId === row.rowId && candidate.status === 'error'
            ? {
                ...candidate,
                status: 'review' as const,
                errorMessage: null,
                scenarioId: 'low-quality-image',
                reportId: `retry-${candidate.rowId}`
              }
            : candidate
        );
        const summary = nextRows.reduce(
          (acc, candidate) => {
            if (candidate.status === 'pass') acc.pass += 1;
            else if (candidate.status === 'review') acc.review += 1;
            else if (candidate.status === 'fail') acc.fail += 1;
            else if (candidate.status === 'error') acc.error += 1;
            return acc;
          },
          { pass: 0, review: 0, fail: 0, error: 0 }
        );
        return { ...prev, rows: nextRows, summary };
      });
      return;
    }

    if (!batchSessionId) {
      return;
    }

    void (async () => {
      const response = await fetch(`/api/batch/${batchSessionId}/retry/${row.imageId}`, {
        method: 'POST'
      });
      if (!response.ok) {
        return;
      }
      const dashboard = batchDashboardResponseSchema.parse(await response.json());
      setDashboardSeed(
        buildDashboardSeedFromResponse({
          batchSessionId,
          response: dashboard,
          images: batchSeed.images
        })
      );
    })();
  }, [batchSeed.images, batchSessionId, fixtureControlsEnabled]);

  const onDashboardBack = useCallback(() => {
    setDrillInRowId(null);
    setDrillInReport(null);
    setView('batch-dashboard');
  }, []);

  const onStartAnotherBatch = useCallback(() => {
    setDrillInRowId(null);
    setDrillInReport(null);
    setExportState({ kind: 'idle' });
    setReviewedRowIds(new Set<string>());
    if (!fixtureControlsEnabled) {
      resetLiveBatch();
    } else {
      setBatchPhase('intake');
    }
    setView('batch-intake');
  }, [fixtureControlsEnabled, resetLiveBatch]);

  const onBeginExport = useCallback(() => setExportState({ kind: 'confirming' }), []);
  const onCancelExport = useCallback(() => setExportState({ kind: 'idle' }), []);
  const onRetryExport = useCallback(() => setExportState({ kind: 'confirming' }), []);
  const onConfirmExport = useCallback(() => {
    void (async () => {
      setExportState({ kind: 'in-progress' });
      try {
        if (!fixtureControlsEnabled && batchSessionId) {
          const response = await fetch(`/api/batch/${batchSessionId}/export`);
          if (!response.ok) {
            throw new Error(await parseApiError(response, "Export didn't complete. Try again."));
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `ttb-batch-${batchSessionId}.json`;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
          setExportState({ kind: 'idle' });
          return;
        }

        const payload = {
          generatedAt: new Date().toISOString(),
          phase: dashboardSeed.phase,
          totals: dashboardSeed.totals,
          summary: dashboardSeed.summary,
          rows: dashboardSeed.rows.map((row) => ({
            rowId: row.rowId,
            reportId: row.reportId,
            filename: row.filename,
            brandName: row.brandName,
            classType: row.classType,
            beverageType: row.beverageType,
            status: row.status,
            issues: row.issues,
            confidenceState: row.confidenceState,
            errorMessage: row.errorMessage,
            completedOrder: row.completedOrder
          })),
          noPersistence: true
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ttb-batch-${dashboardSeed.id}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setExportState({ kind: 'idle' });
      } catch (error) {
        setExportState({
          kind: 'error',
          message:
            error instanceof Error ? error.message : "Export didn't complete. Try again."
        });
      }
    })();
  }, [batchSessionId, dashboardSeed, fixtureControlsEnabled]);

  const onReturnToSingle = useCallback(() => {
    setMode('single');
    setView('intake');
    if (!fixtureControlsEnabled) {
      resetLiveBatch();
    } else {
      setBatchPhase('intake');
    }
  }, [fixtureControlsEnabled, resetLiveBatch]);

  const onPickAmbiguous = useCallback((imageId: string, rowId: string) => {
    setBatchSeed((prev) => updateMatching(prev, { type: 'pick-ambiguous', imageId, rowId }));
  }, []);

  const onDropAmbiguous = useCallback((imageId: string) => {
    setBatchSeed((prev) => updateMatching(prev, { type: 'drop-ambiguous', imageId }));
  }, []);

  const onPairUnmatchedImage = useCallback((imageId: string, rowId: string) => {
    setBatchSeed((prev) =>
      updateMatching(prev, { type: 'pair-unmatched-image', imageId, rowId })
    );
  }, []);

  const onDropUnmatchedImage = useCallback((imageId: string) => {
    setBatchSeed((prev) =>
      updateMatching(prev, { type: 'drop-unmatched-image', imageId })
    );
  }, []);

  const onPairUnmatchedRow = useCallback((rowId: string, imageId: string) => {
    setBatchSeed((prev) =>
      updateMatching(prev, { type: 'pair-unmatched-row', rowId, imageId })
    );
  }, []);

  const onDropUnmatchedRow = useCallback((rowId: string) => {
    setBatchSeed((prev) =>
      updateMatching(prev, { type: 'drop-unmatched-row', rowId })
    );
  }, []);

  const summary = useMemo<BatchTerminalSummary | null>(() => {
    if (batchPhase !== 'terminal') return null;
    return summarizeItems(batchItems, batchProgress.total);
  }, [batchItems, batchPhase, batchProgress.total]);

  const onPreviewImage = useCallback((image: BatchLabelImage) => {
    setPreviewImage(image);
  }, []);

  const onPreviewStreamItem = useCallback((item: BatchStreamItem) => {
    setPreviewImage({
      id: item.id,
      file: null,
      filename: item.filename,
      previewUrl: item.previewUrl,
      sizeLabel: '',
      isPdf: item.isPdf
    });
  }, []);

  const onClosePreview = useCallback(() => setPreviewImage(null), []);

  const onLaunchTour = useCallback(() => {
    setTourOpen(true);
    setTourStepIndex(0);
    setHelpNudgeDismissed(true);
    persistReplay(true, tourCompleted);
  }, [persistReplay, tourCompleted]);

  const onCloseTour = useCallback(() => {
    setTourOpen(false);
  }, []);

  const onDismissNudge = useCallback(() => {
    setHelpNudgeDismissed(true);
    persistReplay(true, tourCompleted);
  }, [persistReplay, tourCompleted]);

  const onPreviousTourStep = useCallback(() => {
    setTourStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const onNextTourStep = useCallback(() => {
    setTourStepIndex((prev) => Math.min(tourSteps.length - 1, prev + 1));
  }, [tourSteps.length]);

  const onFinishTour = useCallback(() => {
    setTourCompleted(true);
    persistReplay(true, true);
    setTourOpen(false);
  }, [persistReplay]);

  const onTourShowMe = useCallback(
    (action: HelpShowMe) => {
      if (action.action === 'load-scenario') {
        const targetId = action.payload?.scenarioId;
        if (!targetId) return;
        const scenario = seedScenarios.find((entry) => entry.id === targetId);
        if (!scenario) return;
        setScenarioId(scenario.id);
        setBeverage(scenario.beverageType);
        setFields({
          ...scenario.fields,
          varietals: scenario.fields.varietals.map((row) => ({ ...row }))
        });
        if (mode !== 'single') setMode('single');
        setView('intake');
        return;
      }
      if (action.action === 'advance-view') {
        const targetView = action.payload?.view;
        const targetMode = action.payload?.mode;
        const variant = action.payload?.variant;
        if (targetMode === 'batch') {
          setMode('batch');
          setView('batch-intake');
          setBatchPhase('intake');
          return;
        }
        if (targetView === 'results' && variant === 'standalone') {
          setVariantOverride('standalone');
          return;
        }
      }
    },
    [mode]
  );

  return (
    <div className="min-h-full flex flex-col bg-background">
      <header className="bg-surface-container-low border-b border-outline-variant/15 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto w-full px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="font-headline text-lg font-bold tracking-tight text-on-surface">
                TTB Label Verification Assistant
              </span>
              <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
                AI-assisted compliance checking
              </span>
            </div>
            <nav
              aria-label="Review mode"
              role="tablist"
              className="hidden md:flex items-center gap-2"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'single'}
                onClick={() => onSelectMode('single')}
                className={[
                  'px-4 py-2 text-sm transition-colors',
                  mode === 'single'
                    ? 'font-semibold text-on-surface border-b-2 border-primary'
                    : 'font-medium text-on-surface-variant hover:text-on-surface'
                ].join(' ')}
              >
                Single
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'batch'}
                data-tour-target="tour-batch-tab"
                onClick={() => onSelectMode('batch')}
                className={[
                  'px-4 py-2 text-sm transition-colors',
                  mode === 'batch'
                    ? 'font-semibold text-on-surface border-b-2 border-primary'
                    : 'font-medium text-on-surface-variant hover:text-on-surface'
                ].join(' ')}
              >
                Batch
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {mode === 'single' ? (
              <>
                {fixtureControlsEnabled ? (
                  <>
                    <ScenarioPicker scenarioId={scenarioId} onSelect={onSelectScenario} />
                    <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                      <span className="uppercase tracking-widest font-bold">Result variant</span>
                      <select
                        value={variantOverride}
                        onChange={(event) =>
                          setVariantOverride(event.target.value as ResultVariantOverride)
                        }
                        className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                      >
                        {variantOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={forceFailure}
                        onChange={(event) => setForceFailure(event.target.checked)}
                        className="rounded text-primary focus:ring-primary/40"
                      />
                      <span className="uppercase tracking-widest font-bold">Force failure</span>
                    </label>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {fixtureControlsEnabled ? (
                  <>
                    <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                      <span className="uppercase tracking-widest font-bold">Batch scenario</span>
                      <select
                        value={batchSeedId}
                        onChange={(event) => onSelectBatchSeed(event.target.value)}
                        className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                      >
                        {SEED_BATCHES.map((seed) => (
                          <option key={seed.id} value={seed.id}>
                            {seed.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {view === 'batch-processing' ? (
                      <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                        <span className="uppercase tracking-widest font-bold">Stream variant</span>
                        <select
                          value={batchStreamSeedId}
                          onChange={(event) => onSelectStreamSeed(event.target.value)}
                          className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                        >
                          {STREAM_SEEDS.map((seed) => (
                            <option key={seed.id} value={seed.id}>
                              {seed.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {view === 'batch-dashboard' || view === 'batch-result' ? (
                      <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                        <span className="uppercase tracking-widest font-bold">Dashboard seed</span>
                        <select
                          value={dashboardSeedId}
                          onChange={(event) => onSelectDashboardSeed(event.target.value)}
                          className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                        >
                          {DASHBOARD_SEEDS.map((seed) => (
                            <option key={seed.id} value={seed.id}>
                              {seed.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
            <HelpLauncher
              active={tourOpen}
              showNudge={!helpNudgeDismissed && !tourOpen}
              onLaunch={onLaunchTour}
              onDismissNudge={onDismissNudge}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {view === 'intake' ? (
          <Intake
            image={image}
            beverage={beverage}
            fields={fields}
            onImageChange={onImageChange}
            onBeverageChange={setBeverage}
            onFieldsChange={setFields}
            onVerify={onVerify}
            onClear={onClear}
          />
        ) : view === 'processing' && image ? (
          <Processing
            image={image}
            beverage={beverage}
            steps={steps}
            phase={phase}
            failureMessage={failureMessage}
            onCancel={onCancel}
            onRetry={onRetry}
            onBackToIntake={onBackToIntake}
          />
        ) : view === 'results' && image && report ? (
          <>
            <BackBreadcrumb
              onBack={onNewReview}
              label="Back to Intake"
              ariaLabel="Back to intake"
            />
            <Results
              image={image}
              beverage={beverage}
              report={report}
              onNewReview={onNewReview}
              onRunFullComparison={onRunFullComparison}
              onTryAnotherImage={onTryAnotherImage}
              onContinueWithCaution={onContinueWithCaution}
              onExportResults={onExportResults}
              exportEnabled={true}
            />
          </>
        ) : view === 'batch-intake' ? (
          <BatchUpload
            seed={batchSeed}
            interactive={!fixtureControlsEnabled}
            onReturnToSingle={onReturnToSingle}
            onStartBatch={onStartBatchFromIntake}
            onSelectImages={!fixtureControlsEnabled ? onSelectLiveImages : undefined}
            onSelectCsv={!fixtureControlsEnabled ? onSelectLiveCsv : undefined}
            onPickAmbiguous={onPickAmbiguous}
            onDropAmbiguous={onDropAmbiguous}
            onPairUnmatchedImage={onPairUnmatchedImage}
            onDropUnmatchedImage={onDropUnmatchedImage}
            onPairUnmatchedRow={onPairUnmatchedRow}
            onDropUnmatchedRow={onDropUnmatchedRow}
            onPreviewImage={onPreviewImage}
          />
        ) : view === 'batch-processing' ? (
          <BatchProcessing
            phase={batchPhase}
            progress={batchProgress}
            items={batchItems}
            summary={summary}
            onCancel={onCancelBatchRun}
            onRetryItem={onRetryBatchItem}
            onBackToIntake={onBatchBackToIntake}
            onOpenDashboard={onBatchOpenDashboard}
            onPreviewItem={onPreviewStreamItem}
          />
        ) : view === 'batch-dashboard' ? (
          <BatchDashboard
            seed={dashboardSeed}
            reviewedIds={reviewedRowIds}
            exportState={exportState}
            onOpenRow={onOpenDashboardRow}
            onRetryRow={onRetryDashboardRow}
            onStartAnotherBatch={onStartAnotherBatch}
            onBeginExport={onBeginExport}
            onConfirmExport={onConfirmExport}
            onCancelExport={onCancelExport}
            onRetryExport={onRetryExport}
          />
        ) : view === 'batch-result' && drillInRowId ? (
          (() => {
            const currentRow = drillInRows.find((row) => row.rowId === drillInRowId);
            if (!currentRow) {
              return null;
            }
            const index = drillInRows.findIndex((row) => row.rowId === drillInRowId);
            return (
              <BatchDrillInShell
                row={currentRow}
                report={drillInReport}
                indexInView={index + 1}
                totalInView={drillInRows.length}
                filter={drillInFilter}
                hasPrevious={index > 0}
                hasNext={index < drillInRows.length - 1}
                onBack={onDashboardBack}
                onPrevious={onDrillInPrevious}
                onNext={onDrillInNext}
                onExportResults={onBeginExport}
              />
            );
          })()
        ) : null}
      </main>
      <ImagePreviewOverlay image={previewImage} onClose={onClosePreview} />
      {tourOpen ? (
        <GuidedTourSpotlight
          steps={tourSteps}
          currentIndex={tourStepIndex}
          onClose={onCloseTour}
          onPrevious={onPreviousTourStep}
          onNext={onNextTourStep}
          onFinish={onFinishTour}
          onShowMe={onTourShowMe}
        />
      ) : null}
    </div>
  );
}

function cloneSeed(seed: SeedBatch): SeedBatch {
  return {
    ...seed,
    images: seed.images.map((img) => ({ ...img })),
    csv: seed.csv
      ? { ...seed.csv, rows: seed.csv.rows.map((row) => ({ ...row })) }
      : null,
    fileErrors: seed.fileErrors.map((err) => ({ ...err })),
    matching: {
      matched: seed.matching.matched.map((m) => ({ ...m })),
      ambiguous: seed.matching.ambiguous.map((a) => ({
        ...a,
        candidates: a.candidates.map((c) => ({ ...c }))
      })),
      unmatchedImages: seed.matching.unmatchedImages.map((u) => ({ ...u })),
      unmatchedRows: seed.matching.unmatchedRows.map((u) => ({ ...u }))
    }
  };
}

type MatchingAction =
  | { type: 'pick-ambiguous'; imageId: string; rowId: string }
  | { type: 'drop-ambiguous'; imageId: string }
  | { type: 'pair-unmatched-image'; imageId: string; rowId: string }
  | { type: 'drop-unmatched-image'; imageId: string }
  | { type: 'pair-unmatched-row'; rowId: string; imageId: string }
  | { type: 'drop-unmatched-row'; rowId: string };

function updateMatching(seed: SeedBatch, action: MatchingAction): SeedBatch {
  const matching: BatchMatchingState = {
    matched: seed.matching.matched.map((m) => ({ ...m })),
    ambiguous: seed.matching.ambiguous.map((a) => ({
      ...a,
      candidates: a.candidates.map((c) => ({ ...c }))
    })),
    unmatchedImages: seed.matching.unmatchedImages.map((u) => ({ ...u })),
    unmatchedRows: seed.matching.unmatchedRows.map((u) => ({ ...u }))
  };
  switch (action.type) {
    case 'pick-ambiguous': {
      matching.ambiguous = matching.ambiguous.map((item) =>
        item.image.id === action.imageId
          ? { ...item, chosenRowId: action.rowId, dropped: false }
          : item
      );
      break;
    }
    case 'drop-ambiguous': {
      matching.ambiguous = matching.ambiguous.map((item) =>
        item.image.id === action.imageId
          ? { ...item, dropped: true, chosenRowId: null }
          : item
      );
      break;
    }
    case 'pair-unmatched-image': {
      matching.unmatchedImages = matching.unmatchedImages.map((item) =>
        item.image.id === action.imageId
          ? { ...item, pairedRowId: action.rowId, dropped: false }
          : item
      );
      break;
    }
    case 'drop-unmatched-image': {
      matching.unmatchedImages = matching.unmatchedImages.map((item) =>
        item.image.id === action.imageId
          ? { ...item, dropped: true, pairedRowId: null }
          : item
      );
      break;
    }
    case 'pair-unmatched-row': {
      matching.unmatchedRows = matching.unmatchedRows.map((item) =>
        item.row.id === action.rowId
          ? { ...item, pairedImageId: action.imageId, dropped: false }
          : item
      );
      break;
    }
    case 'drop-unmatched-row': {
      matching.unmatchedRows = matching.unmatchedRows.map((item) =>
        item.row.id === action.rowId
          ? { ...item, dropped: true, pairedImageId: null }
          : item
      );
      break;
    }
  }
  return { ...seed, matching };
}

function summarizeItems(
  items: BatchStreamItem[],
  total: number
): BatchTerminalSummary {
  const summary: BatchTerminalSummary = {
    total,
    pass: 0,
    review: 0,
    fail: 0,
    error: 0
  };
  for (const item of items) {
    switch (item.status) {
      case 'pass':
        summary.pass += 1;
        break;
      case 'review':
        summary.review += 1;
        break;
      case 'fail':
        summary.fail += 1;
        break;
      case 'error':
        summary.error += 1;
        break;
    }
  }
  return summary;
}

function countRunnableBatchItems(matching: BatchMatchingState) {
  return (
    matching.matched.length +
    matching.ambiguous.filter((item) => !item.dropped && item.chosenRowId !== null).length +
    matching.unmatchedImages.filter(
      (item) => !item.dropped && item.pairedRowId !== null
    ).length
  );
}
