import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildLowQualityCautionReport,
  emptyIntake,
  prefillFromReport
} from './appSingleState';
import type { View } from './appTypes';
import { buildTourDemoImage, resolveTourDemoReviewReport } from './tour/help-tour-runtime';
import { DEFAULT_FAILURE_MESSAGE } from './reviewFailureMessage';
import { logReviewClientEvent } from './review-observability';
import { resolveResultReport } from './review-runtime';
import type { SeedScenario } from './scenarios';
import {
  cloneScenarioFields,
  REVIEW_VARIANT_OPTIONS,
  type SingleReviewFlow
} from './singleReviewFlowSupport';
import { exportReviewResults } from './single-review-export';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  ResultVariantOverride,
} from './types';
import type { ReviewPipelineEvent } from './reviewPipelineEvents';
import { useSingleReviewPipeline } from './useSingleReviewPipeline';
import { useSpeculativePrefetch } from './useSpeculativePrefetch';
import { useOcrPreview } from './useOcrPreview';
import { useExtractionPrefetch } from './useExtractionPrefetch';
import {
  hasRefinableRows,
  mergeRefinedReport,
  useRefineReview
} from './useRefineReview';

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
      refine.start({ image, secondaryImage, beverage, fields: fieldsState });
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
  }, [abandonInFlightReview, extractionPrefetch, ocrPreview, prefetch, refine, resetPipelineState, revokeImage, setReport]);

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
      // Fire the OCR-only preview in parallel with the canonical review
      // so Processing screen gets partial fields in ~500ms. Preview
      // failures are silent — the canonical pipeline still runs.
      if (ocrPreviewEnabled && image && !forceFailure) {
        ocrPreview.start({
          image,
          secondaryImage,
          beverage,
          fields: fieldsState
        });
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
