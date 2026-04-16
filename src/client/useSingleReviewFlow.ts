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
    onEvent: handlePipelineEvent
  });

  const prefetch = useSpeculativePrefetch({
    enabled: speculativePrefetchEnabled,
    image,
    beverage,
    fields: fieldsState,
    forceFailure
  });

  const reset = useCallback(() => {
    abandonInFlightReview();
    prefetch.clearPrefetch();
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
  }, [abandonInFlightReview, prefetch, resetPipelineState, revokeImage, setReport]);

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
      setImage(buildTourDemoImage(scenario));
      setReport(null);
      setVariantOverride('auto');
      setForceFailure(false);
      setFailureMessage(DEFAULT_FAILURE_MESSAGE);
      resetPipelineState();
      applyScenario(scenario);
      options.setView('intake');
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
    (scenario: SeedScenario, variant: ResultVariantOverride = 'auto') => {
      abandonInFlightReview();
      revokeImage(imageRef.current);

      const demoImage = buildTourDemoImage(scenario);
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
      if (!next) prefetch.clearPrefetch();
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
