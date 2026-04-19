import { useCallback, useEffect, useRef, useState } from 'react';

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
import {
  cloneScenarioFields,
  resolveVerifyIntent,
  REVIEW_VARIANT_OPTIONS,
  type SingleReviewFlow
} from './singleReviewFlowSupport';
import { exportReviewResults } from './single-review-export';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  ResultVariantOverride
} from './types';
import {
  type ReviewPipelineEvent,
  useSingleReviewPipeline
} from './useSingleReviewPipeline';
import { useSpeculativePrefetch } from './useSpeculativePrefetch';
import { useOcrPreview } from './useOcrPreview';
import { useExtractionPrefetch } from './useExtractionPrefetch';
import { mergeRefinedReport } from './useRefineReview';
import { useRefineCoordinator } from './useRefineCoordinator';

export type { SingleReviewFlow } from './singleReviewFlowSupport';

export function useSingleReviewFlow(options: {
  fixtureControlsEnabled: boolean;
  setView: (view: View) => void;
}): SingleReviewFlow {
  const [image, setImage] = useState<LabelImage | null>(null);
  const [secondaryImage, setSecondaryImage] = useState<LabelImage | null>(null);
  const [beverage, setBeverage] = useState<BeverageSelection>('auto');
  const [fieldsState, setFieldsState] = useState<IntakeFields>(emptyIntake);
  const [scenarioId, setScenarioId] = useState<string>('blank');
  const [forceFailure, setForceFailure] = useState<boolean>(false);
  const [variantOverride, setVariantOverride] = useState<ResultVariantOverride>('auto');
  const imageRef = useRef<LabelImage | null>(null);
  const secondaryImageRef = useRef<LabelImage | null>(null);
  const reviewTraceIdRef = useRef<string | null>(null);

  const useFixtureReport = options.fixtureControlsEnabled && scenarioId !== 'blank';

  const { refine, clearRefineState, startRefineForReport } = useRefineCoordinator({
    useFixtureReport,
    beverage,
    fields: fieldsState,
    imageRef,
    secondaryImageRef
  });

  const revokeImage = useCallback((previous: LabelImage | null) => {
    if (previous?.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previous.previewUrl);
    }
  }, []);

  useEffect(() => {
    imageRef.current = image;
  }, [image]);

  useEffect(() => {
    secondaryImageRef.current = secondaryImage;
  }, [secondaryImage]);

  useEffect(() => {
    return () => {
      revokeImage(imageRef.current);
      revokeImage(secondaryImageRef.current);
    };
  }, [revokeImage]);

  const handlePipelineEvent = useCallback((event: ReviewPipelineEvent) => {
    if (event.traceId) {
      reviewTraceIdRef.current = event.traceId;
    }

    const { type, ...payload } = event;
    logReviewClientEvent(type, payload);
  }, []);

  // Hardcoded-on background prefetch. The env var is only an explicit opt-out.
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
    secondaryImage,
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
    onLiveReportReady: startRefineForReport,
    onEvent: handlePipelineEvent
  });

  const prefetch = useSpeculativePrefetch({
    enabled: speculativePrefetchEnabled,
    image,
    secondaryImage,
    beverage,
    fields: fieldsState,
    forceFailure
  });

  // OCR-only preview populates Processing with partial fields before the full review lands.
  const ocrPreviewEnabled = speculativePrefetchEnabled;
  const ocrPreview = useOcrPreview({ enabled: ocrPreviewEnabled });

  // Image selection may start extract-only in the background; Verify reuses the cache key.
  const extractionPrefetch = useExtractionPrefetch({
    enabled: speculativePrefetchEnabled
  });
  // The pipeline reads the latest cache key lazily at submit time.
  const extractionPrefetchRef = useRef<string | null>(null);
  useEffect(() => {
    extractionPrefetchRef.current = extractionPrefetch.cacheKey;
  }, [extractionPrefetch.cacheKey]);

  const runLiveReview = useCallback(() => {
    clearRefineState();
    if (speculativePrefetchEnabled && image && !forceFailure) {
      const hit = prefetch.consumeCacheHit(
        image,
        secondaryImage,
        beverage,
        fieldsState
      );
      if (hit) {
        startReviewFromPrefetch(hit.report);
        return;
      }
    }
    if (ocrPreviewEnabled && image && !forceFailure) {
      ocrPreview.start({
        image,
        secondaryImage,
        beverage,
        fields: fieldsState
      });
    }
    void startReview(forceFailure);
  }, [
    beverage,
    fieldsState,
    forceFailure,
    image,
    ocrPreview,
    ocrPreviewEnabled,
    prefetch,
    secondaryImage,
    speculativePrefetchEnabled,
    clearRefineState,
    startReview,
    startReviewFromPrefetch
  ]);

  const refreshImagePrefetch = useCallback(
    (primary: LabelImage | null, secondary: LabelImage | null) => {
      prefetch.clearPrefetch();
      if (!primary) {
        extractionPrefetch.reset();
        return;
      }

      extractionPrefetch.start(primary, secondary, beverage);
    },
    [beverage, extractionPrefetch, prefetch]
  );

  useEffect(() => {
    startRefineForReport(report);
  }, [report, startRefineForReport]);

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
    clearRefineState();
    reviewTraceIdRef.current = null;
    revokeImage(imageRef.current);
    revokeImage(secondaryImageRef.current);
    setImage(null);
    setSecondaryImage(null);
    setFieldsState(emptyIntake());
    setBeverage('auto');
    setScenarioId('blank');
    setForceFailure(false);
    setVariantOverride('auto');
    setReport(null);
    resetPipelineState();
  }, [abandonInFlightReview, clearRefineState, extractionPrefetch, ocrPreview, prefetch, resetPipelineState, revokeImage, setReport]);

  const applyScenario = useCallback(
    (scenario: SeedScenario) => {
      setScenarioId(scenario.id);
      setBeverage(scenario.beverageType);
      setFieldsState(cloneScenarioFields(scenario));
    },
    []
  );

  const loadTourScenario = useCallback(
    (scenario: SeedScenario) => {
      abandonInFlightReview();
      clearRefineState();
      revokeImage(imageRef.current);
      logReviewClientEvent('tour.demo.intake-loaded', {
        scenarioId: scenario.id
      });
      // Apply fields + view synchronously for snappy tour UX; the
      // real image fetches asynchronously and populates the slot when
      // it resolves. The intake renders fields + a loading state for
      // the image between.
      setImage(null);
      setSecondaryImage(null);
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
      clearRefineState,
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
      clearRefineState();
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
      setSecondaryImage(null);
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
      clearRefineState,
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
    secondaryImage,
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
    variantOptions: REVIEW_VARIANT_OPTIONS,
    setBeverage,
    setFields: setFieldsState,
    setForceFailure,
    setVariantOverride,
    onVerify: () => {
      const verifyIntent = resolveVerifyIntent({ hasImage: Boolean(image) });
      if (verifyIntent === 'disabled') return;
      runLiveReview();
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
      clearRefineState();
      void startReview(false);
    },
    onImageChange: (next) => {
      clearRefineState();
      revokeImage(image);
      if (!next) {
        revokeImage(secondaryImage);
        setSecondaryImage(null);
        refreshImagePrefetch(null, null);
      } else {
        refreshImagePrefetch(next, secondaryImage);
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
    onSecondaryImageChange: (next) => {
      clearRefineState();
      revokeImage(secondaryImage);
      const nextSecondary = image ? next : null;
      refreshImagePrefetch(image, nextSecondary);
      logReviewClientEvent('review.intake.secondary-image-selected', {
        scenarioId,
        filename: nextSecondary?.file.name ?? null,
        labelBytes: nextSecondary?.file.size ?? null,
        labelMimeType: nextSecondary?.file.type ?? null,
        demoScenarioId: nextSecondary?.demoScenarioId ?? null
      });
      setSecondaryImage(nextSecondary);
    },
    onImagesChange: (primary, secondary = null) => {
      clearRefineState();
      const nextSecondary = primary ? secondary : null;
      if (image && image !== primary && image !== nextSecondary) {
        revokeImage(image);
      }
      if (
        secondaryImage &&
        secondaryImage !== primary &&
        secondaryImage !== nextSecondary
      ) {
        revokeImage(secondaryImage);
      }
      refreshImagePrefetch(primary, nextSecondary);
      setImage(primary);
      setSecondaryImage(nextSecondary);
      logReviewClientEvent('review.intake.images-selected', {
        scenarioId,
        primaryFilename: primary?.file.name ?? null,
        secondaryFilename: nextSecondary?.file.name ?? null
      });
    },
    onClear: () => {
      clearRefineState();
      revokeImage(image);
      revokeImage(secondaryImage);
      refreshImagePrefetch(null, null);
      logReviewClientEvent('review.intake.cleared', {
        scenarioId
      });
      setImage(null);
      setSecondaryImage(null);
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
      clearRefineState();
      revokeImage(image);
      revokeImage(secondaryImage);
      setImage(null);
      setSecondaryImage(null);
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
