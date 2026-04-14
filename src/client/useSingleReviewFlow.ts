import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTourDemoImage, resolveTourDemoReviewReport } from './help-tour-runtime';
import { resolveResultReport } from './review-runtime';
import type { SeedScenario } from './scenarios';
import {
  buildInitialSteps,
  buildLowQualityCautionReport,
  emptyIntake,
  prefillFromReport,
  STEP_ADVANCE_MS
} from './appSingleState';
import { DEFAULT_FAILURE_MESSAGE, submitReview } from './appReviewApi';
import type { View } from './appTypes';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  ProcessingPhase,
  ProcessingStep,
  ResultVariantOverride,
  UIVerificationReport
} from './types';

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
  const [steps, setSteps] = useState<ProcessingStep[]>(buildInitialSteps);
  const [phase, setPhase] = useState<ProcessingPhase>('running');
  const [failureMessage, setFailureMessage] = useState<string>(DEFAULT_FAILURE_MESSAGE);
  const [report, setReport] = useState<UIVerificationReport | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const imageRef = useRef<LabelImage | null>(null);

  const useFixtureReport = options.fixtureControlsEnabled && scenarioId !== 'blank';

  const clearPipelineTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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
      clearPipelineTimer();
      abortControllerRef.current?.abort();
      revokeImage(imageRef.current);
    };
  }, [clearPipelineTimer, revokeImage]);

  const completePipeline = useCallback(
    (requestId: number, liveReport: UIVerificationReport | null) => {
      if (requestId !== requestIdRef.current) return;

      clearPipelineTimer();
      abortControllerRef.current = null;
      setSteps((previous) => previous.map((step) => ({ ...step, status: 'done' })));
      setPhase('terminal');
      setReport(
        resolveResultReport({
          fields: fieldsState,
          liveReport,
          scenarioId,
          useFixtureReport,
          variantOverride
        })
      );
      options.setView('results');
    },
    [clearPipelineTimer, fieldsState, options, scenarioId, useFixtureReport, variantOverride]
  );

  const failPipeline = useCallback(
    (requestId: number, message: string) => {
      if (requestId !== requestIdRef.current) return;

      clearPipelineTimer();
      abortControllerRef.current = null;
      setFailureMessage(message);
      setSteps((previous) => {
        const next = previous.map((step) => ({ ...step }));
        const activeIndex = next.findIndex((step) => step.status === 'active');

        if (activeIndex === -1) {
          return previous;
        }

        next[activeIndex] = { ...next[activeIndex]!, status: 'failed' };
        return next;
      });
      setPhase('failed');
    },
    [clearPipelineTimer]
  );

  const startPipeline = useCallback(
    (shouldFail: boolean, requestId: number) => {
      clearPipelineTimer();
      setSteps(buildInitialSteps());
      setPhase('running');
      setFailureMessage(DEFAULT_FAILURE_MESSAGE);

      const tick = () => {
        if (requestId !== requestIdRef.current) return;

        let shouldContinue = false;
        let failed = false;

        setSteps((previous) => {
          const next = previous.map((step) => ({ ...step }));
          const activeIndex = next.findIndex((step) => step.status === 'active');
          if (activeIndex === -1) return previous;

          if (shouldFail && activeIndex === 2) {
            next[activeIndex] = { ...next[activeIndex]!, status: 'failed' };
            failed = true;
            return next;
          }

          if (activeIndex === next.length - 1) {
            shouldContinue = true;
            return previous;
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
    [clearPipelineTimer]
  );

  const startReview = useCallback(
    async (shouldFail: boolean) => {
      if (!image) return;

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      abortControllerRef.current?.abort();
      setReport(null);
      options.setView('processing');
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
          fields: fieldsState,
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
    [beverage, completePipeline, failPipeline, fieldsState, image, options, startPipeline]
  );

  const abandonInFlightReview = useCallback(() => {
    clearPipelineTimer();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestIdRef.current += 1;
  }, [clearPipelineTimer]);

  const reset = useCallback(() => {
    abandonInFlightReview();
    revokeImage(imageRef.current);
    setImage(null);
    setFieldsState(emptyIntake());
    setBeverage('auto');
    setScenarioId('blank');
    setForceFailure(false);
    setVariantOverride('auto');
    setReport(null);
    setSteps(buildInitialSteps());
    setPhase('running');
    setFailureMessage(DEFAULT_FAILURE_MESSAGE);
  }, [abandonInFlightReview, revokeImage]);

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
      setImage(buildTourDemoImage(scenario));
      setReport(null);
      setVariantOverride('auto');
      setForceFailure(false);
      setFailureMessage(DEFAULT_FAILURE_MESSAGE);
      setSteps(buildInitialSteps());
      setPhase('running');
      applyScenario(scenario);
      options.setView('intake');
    },
    [abandonInFlightReview, applyScenario, options, revokeImage]
  );

  const showTourResults = useCallback(
    (scenario: SeedScenario, variant: ResultVariantOverride = 'auto') => {
      abandonInFlightReview();
      revokeImage(imageRef.current);

      const demoImage = buildTourDemoImage(scenario);
      const demoReport = resolveTourDemoReviewReport(demoImage);

      setImage(demoImage);
      setVariantOverride(variant);
      setForceFailure(false);
      setFailureMessage(DEFAULT_FAILURE_MESSAGE);
      setSteps(buildInitialSteps());
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
    [abandonInFlightReview, applyScenario, cloneScenarioFields, options, revokeImage]
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
      void startReview(forceFailure);
    },
    onCancel: () => {
      abandonInFlightReview();
      options.setView('intake');
    },
    onBackToIntake: () => {
      abandonInFlightReview();
      options.setView('intake');
    },
    onRetry: () => {
      void startReview(false);
    },
    onImageChange: (next) => {
      revokeImage(image);
      setImage(next);
    },
    onClear: () => {
      revokeImage(image);
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
    },
    reset
  };
}
