import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildLowQualityCautionReport,
  emptyIntake,
  prefillFromReport
} from './appSingleState';
import type { View } from './appTypes';
import { buildTourDemoImage, resolveTourDemoReviewReport } from './help-tour-runtime';
import { DEFAULT_FAILURE_MESSAGE } from './reviewFailureMessage';
import { logReviewClientEvent } from './review-observability';
import { resolveResultReport } from './review-runtime';
import type { SeedScenario } from './scenarios';
import { exportReviewResults } from './single-review-export';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  ProcessingPhase,
  ProcessingStep,
  ResultVariantOverride,
  UIVerificationReport
} from './types';
import {
  type ReviewPipelineEvent,
  useSingleReviewPipeline
} from './useSingleReviewPipeline';
import { useSpeculativePrefetch } from './useSpeculativePrefetch';
import { useOcrPreview, type OcrPreviewFields } from './useOcrPreview';
import { useExtractionPrefetch } from './useExtractionPrefetch';
import {
  hasRefinableRows,
  mergeRefinedReport,
  useRefineReview,
  type RefineStatus
} from './useRefineReview';

export interface SingleReviewFlow {
  image: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  scenarioId: string;
  forceFailure: boolean;
  variantOverride: ResultVariantOverride;
  steps: ProcessingStep[];
  phase: ProcessingPhase;
  failureMessage: string;
  report: UIVerificationReport | null;
  /**
   * OCR-only preview (ABV, net contents, class, country, warning-present)
   * populated ~500ms into the Processing phase by a parallel low-cost
   * server call. `null` until the preview frame lands or when running
   * fixture/tour scenarios that bypass the live pipeline.
   */
  ocrPreview: OcrPreviewFields | null;
  /**
   * Refine-pass status (Option C). Fires after Results render when
   * any identifier field is in 'review' status. UI uses this to show
   * a subtle row-level "refining…" indicator.
   */
  refineStatus: RefineStatus;
  variantOptions: Array<{ value: ResultVariantOverride; label: string }>;
  setBeverage: (value: BeverageSelection) => void;
  setFields: (value: IntakeFields) => void;
  setForceFailure: (value: boolean) => void;
  setVariantOverride: (value: ResultVariantOverride) => void;
  onVerify: () => void;
  onCancel: () => void;
  onBackToIntake: () => void;
  onRetry: () => void;
  onImageChange: (next: LabelImage | null) => void;
  onClear: () => void;
  onSelectScenario: (scenario: SeedScenario) => void;
  onLoadTourScenario: (scenario: SeedScenario) => void;
  onShowTourResults: (
    scenario: SeedScenario,
    variant?: ResultVariantOverride
  ) => void;
  onNewReview: () => void;
  onRunFullComparison: () => void;
  onTryAnotherImage: () => void;
  onContinueWithCaution: () => void;
  onExportResults: () => void;
  reset: () => void;
}

export function useSingleReviewFlow(options: {
  fixtureControlsEnabled: boolean;
  setView: (view: View) => void;
}): SingleReviewFlow {
  const [image, setImage] = useState<LabelImage | null>(null);
  const [beverage, setBeverage] = useState<BeverageSelection>('auto');
  const [fieldsState, setFieldsState] = useState<IntakeFields>(emptyIntake);
  const [scenarioId, setScenarioId] = useState<string>('blank');
  const [forceFailure, setForceFailure] = useState<boolean>(false);
  const [variantOverride, setVariantOverride] = useState<ResultVariantOverride>('auto');
  const imageRef = useRef<LabelImage | null>(null);
  const reviewTraceIdRef = useRef<string | null>(null);

  const useFixtureReport = options.fixtureControlsEnabled && scenarioId !== 'blank';

  const revokeImage = useCallback((previous: LabelImage | null) => {
    if (previous?.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previous.previewUrl);
    }
  }, []);

  const cloneScenarioFields = useCallback(
    (scenario: SeedScenario): IntakeFields => ({
      ...scenario.fields,
      varietals: scenario.fields.varietals.map((row) => ({ ...row }))
    }),
    []
  );

  useEffect(() => {
    imageRef.current = image;
  }, [image]);

  useEffect(() => {
    return () => {
      revokeImage(imageRef.current);
    };
  }, [revokeImage]);

  const handlePipelineEvent = useCallback((event: ReviewPipelineEvent) => {
    if (event.traceId) {
      reviewTraceIdRef.current = event.traceId;
    }

    const { type, ...payload } = event;
    logReviewClientEvent(type, payload);
  }, []);

  // Speculative prefetch is hardcoded on: image upload triggers a background
  // /api/review call immediately, so clicking "Verify" returns a cached result
  // in ~0ms instead of waiting 6-8s. The env var override is kept only as an
  // explicit opt-out ("false" disables it for debugging/testing).
  const speculativePrefetchEnabled =
    import.meta.env.VITE_ENABLE_SPECULATIVE_PREFETCH !== 'false';

  const {
    steps,
    phase,
    failureMessage,
    report,
    setReport,
    setPhase,
    setFailureMessage,
    startReview,
    startReviewFromPrefetch,
    abandonInFlightReview,
    resetPipelineState
  } = useSingleReviewPipeline({
    image,
    beverage,
    fields: fieldsState,
    scenarioId,
    setView: options.setView,
    resolveTerminalReport: (liveReport) =>
      resolveResultReport({
        fields: fieldsState,
        liveReport,
        scenarioId,
        useFixtureReport,
        variantOverride
      }),
    // Ref reads the latest cacheKey at submit time without recomputing
    // the pipeline deps on every prefetch state change.
    getExtractionCacheKey: () => extractionPrefetchRef.current,
    onEvent: handlePipelineEvent
  });

  const prefetch = useSpeculativePrefetch({
    enabled: speculativePrefetchEnabled,
    image,
    beverage,
    fields: fieldsState,
    forceFailure
  });

  // OCR-only preview runs alongside the canonical review so Processing
  // screen can show partial field values (ABV, net contents, class,
  // country, warning-present) in ~500ms instead of waiting the full
  // 5-7s for the VLM. Disabled for fixture/tour scenarios since those
  // bypass the live server.
  const ocrPreviewEnabled = speculativePrefetchEnabled;
  const ocrPreview = useOcrPreview({ enabled: ocrPreviewEnabled });

  // Image-first prefetch: on image select, fire the server-side
  // extract-only call so VLM extraction completes during form-filling
  // time. The cache key is passed on Verify so /api/review skips
  // re-extraction and runs only judgment + report.
  const extractionPrefetch = useExtractionPrefetch({
    enabled: speculativePrefetchEnabled
  });
  // Ref pattern: useSingleReviewPipeline is initialized BEFORE
  // extractionPrefetch state lands, so the pipeline receives a getter
  // that reads the current cacheKey at submit time.
  const extractionPrefetchRef = useRef<string | null>(null);
  useEffect(() => {
    extractionPrefetchRef.current = extractionPrefetch.cacheKey;
  }, [extractionPrefetch.cacheKey]);

  // Row-level refine (Option C). Fires after Results render when any
  // identifier row is in 'review' status on a LIVE review (not a tour
  // demo, not a fixture). Runs the pipeline again with
  // VERIFICATION_MODE=on and merges refined identifier checks back
  // into the displayed report.
  //
  // Guards against the tour "See failing example" path: the demo
  // report reaches phase=terminal via showTourResults(), and the demo
  // image is a synthetic blob that the server can't extract. The
  // image.demoScenarioId marker is set on any tour-built image —
  // we skip the refine call for those so the tour flow stays offline.
  const refine = useRefineReview();
  useEffect(() => {
    if (
      phase === 'terminal' &&
      report &&
      !useFixtureReport &&
      image &&
      !image.demoScenarioId &&
      hasRefinableRows(report)
    ) {
      refine.start({ image, beverage, fields: fieldsState });
    }
    // Fire once per (report, image) pair. refine identity is stable via useRefineReview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, report?.id]);
  // When refine completes, merge identifier rows back into the report.
  useEffect(() => {
    if (refine.refinedReport && report) {
      const merged = mergeRefinedReport(report, refine.refinedReport);
      if (merged !== report) setReport(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refine.refinedReport]);

  const reset = useCallback(() => {
    abandonInFlightReview();
    prefetch.clearPrefetch();
    ocrPreview.reset();
    extractionPrefetch.reset();
    refine.reset();
    reviewTraceIdRef.current = null;
    revokeImage(imageRef.current);
    setImage(null);
    setFieldsState(emptyIntake());
    setBeverage('auto');
    setScenarioId('blank');
    setForceFailure(false);
    setVariantOverride('auto');
    setReport(null);
    resetPipelineState();
  }, [abandonInFlightReview, extractionPrefetch, ocrPreview, prefetch, refine, resetPipelineState, revokeImage, setReport]);

  const variantOptions = useMemo(
    () =>
      [
        { value: 'auto', label: 'Auto (by scenario)' },
        { value: 'standalone', label: 'Standalone (no app data)' },
        { value: 'no-text-extracted', label: 'No-text-extracted' }
      ] as Array<{ value: ResultVariantOverride; label: string }>,
    []
  );

  const applyScenario = useCallback(
    (scenario: SeedScenario) => {
      setScenarioId(scenario.id);
      setBeverage(scenario.beverageType);
      setFieldsState(cloneScenarioFields(scenario));
    },
    [cloneScenarioFields]
  );

  const loadTourScenario = useCallback(
    (scenario: SeedScenario) => {
      abandonInFlightReview();
      revokeImage(imageRef.current);
      logReviewClientEvent('tour.demo.intake-loaded', {
        scenarioId: scenario.id
      });
      // Apply fields + view synchronously for snappy tour UX; the
      // real image fetches asynchronously and populates the slot when
      // it resolves. The intake renders fields + a loading state for
      // the image between.
      setImage(null);
      setReport(null);
      setVariantOverride('auto');
      setForceFailure(false);
      setFailureMessage(DEFAULT_FAILURE_MESSAGE);
      resetPipelineState();
      applyScenario(scenario);
      options.setView('intake');
      void buildTourDemoImage(scenario).then((image) => {
        if (imageRef.current === null) setImage(image);
      });
    },
    [
      abandonInFlightReview,
      applyScenario,
      options,
      resetPipelineState,
      revokeImage,
      setFailureMessage,
      setReport
    ]
  );

  const showTourResults = useCallback(
    async (scenario: SeedScenario, variant: ResultVariantOverride = 'auto') => {
      abandonInFlightReview();
      revokeImage(imageRef.current);

      // Await the real image fetch when the scenario points at a
      // cola-cloud / supplemental-generated asset. Falls back to the
      // synthetic stub if the asset can't be reached (see
      // buildTourDemoImage). Canned demo report still comes from
      // resolveTourDemoReviewReport — the tour is deterministic even
      // when the image is real.
      const demoImage = await buildTourDemoImage(scenario);
      const demoReport = resolveTourDemoReviewReport(demoImage);

      logReviewClientEvent('tour.demo.results-loaded', {
        scenarioId: scenario.id,
        variant
      });

      setImage(demoImage);
      setVariantOverride(variant);
      setForceFailure(false);
      setFailureMessage(DEFAULT_FAILURE_MESSAGE);
      resetPipelineState();
      applyScenario(scenario);
      setPhase('terminal');
      setReport(
        resolveResultReport({
          fields: cloneScenarioFields(scenario),
          liveReport: demoReport,
          scenarioId: scenario.id,
          useFixtureReport: false,
          variantOverride: variant
        })
      );
      options.setView('results');
    },
    [
      abandonInFlightReview,
      applyScenario,
      cloneScenarioFields,
      options,
      resetPipelineState,
      revokeImage,
      setFailureMessage,
      setPhase,
      setReport
    ]
  );

  return {
    image,
    beverage,
    fields: fieldsState,
    scenarioId,
    forceFailure,
    variantOverride,
    steps,
    phase,
    failureMessage,
    report,
    ocrPreview: ocrPreview.preview,
    refineStatus: refine.status,
    variantOptions,
    setBeverage,
    setFields: setFieldsState,
    setForceFailure,
    setVariantOverride,
    onVerify: () => {
      if (speculativePrefetchEnabled && image && !forceFailure) {
        const hit = prefetch.consumeCacheHit(image, beverage, fieldsState);
        if (hit) {
          startReviewFromPrefetch(hit.report);
          return;
        }
      }
      // Fire the OCR-only preview in parallel with the canonical review
      // so Processing screen gets partial fields in ~500ms. Preview
      // failures are silent — the canonical pipeline still runs.
      if (ocrPreviewEnabled && image && !forceFailure) {
        ocrPreview.start({ image, beverage, fields: fieldsState });
      }
      void startReview(forceFailure);
    },
    onCancel: () => {
      abandonInFlightReview();
      logReviewClientEvent('review.submit.cancelled', {
        traceId: reviewTraceIdRef.current,
        scenarioId
      });
      options.setView('intake');
    },
    onBackToIntake: () => {
      abandonInFlightReview();
      logReviewClientEvent('review.submit.back-to-intake', {
        traceId: reviewTraceIdRef.current,
        scenarioId
      });
      options.setView('intake');
    },
    onRetry: () => {
      void startReview(false);
    },
    onImageChange: (next) => {
      revokeImage(image);
      if (!next) {
        prefetch.clearPrefetch();
        extractionPrefetch.reset();
      } else {
        // Image-first prefetch: fire the server extract-only as soon
        // as the user picks a file. The ~5s VLM call runs during the
        // form-filling window; Verify then hits the cache and returns
        // sub-second.
        extractionPrefetch.start(next, beverage);
      }
      logReviewClientEvent('review.intake.image-selected', {
        scenarioId,
        filename: next?.file.name ?? null,
        labelBytes: next?.file.size ?? null,
        labelMimeType: next?.file.type ?? null,
        demoScenarioId: next?.demoScenarioId ?? null
      });
      setImage(next);
    },
    onClear: () => {
      revokeImage(image);
      prefetch.clearPrefetch();
      extractionPrefetch.reset();
      logReviewClientEvent('review.intake.cleared', {
        scenarioId
      });
      setImage(null);
      setFieldsState(emptyIntake());
      setBeverage('auto');
      setScenarioId('blank');
    },
    onSelectScenario: (scenario) => {
      applyScenario(scenario);
    },
    onLoadTourScenario: loadTourScenario,
    onShowTourResults: showTourResults,
    onNewReview: () => {
      reset();
      options.setView('intake');
    },
    onRunFullComparison: () => {
      if (!report) return;
      setFieldsState((current) => prefillFromReport(current, report));
      setVariantOverride('auto');
      options.setView('intake');
    },
    onTryAnotherImage: () => {
      revokeImage(image);
      setImage(null);
      setVariantOverride('auto');
      setReport(null);
      options.setView('intake');
    },
    onContinueWithCaution: () => {
      setVariantOverride('auto');
      setReport(buildLowQualityCautionReport());
    },
    onExportResults: () => {
      if (!report) return;
      exportReviewResults({
        image,
        beverage,
        report
      });
    },
    reset
  };
}
