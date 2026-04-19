import { useCallback, useEffect, useRef, useState } from 'react';

import { buildInitialSteps, STEP_DELAYS_MS } from './appSingleState';
import { submitReview } from './appReviewApi';
import type { View } from './appTypes';
import {
  DEFAULT_FAILURE_MESSAGE,
  GENERIC_FAILURE_MESSAGE,
  resolveReviewFailureMessage
} from './reviewFailureMessage';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  ProcessingPhase,
  ProcessingStep,
  UIVerificationReport
} from './types';

export type ReviewPipelineEvent =
  | {
      type: 'review.submit.started';
      traceId: string;
      requestId: number;
      scenarioId: string;
      demoScenarioId: string | null;
      labelMimeType: string;
      labelBytes: number;
      hasApplicationData: boolean;
      beverage: BeverageSelection;
    }
  | {
      type: 'review.submit.fixture-failure';
      traceId: string;
      requestId: number;
      scenarioId: string;
    }
  | {
      type: 'review.submit.response-ok';
      traceId: string;
      requestId: number;
      scenarioId: string;
      reportId: string;
      verdict: UIVerificationReport['verdict'];
      standalone: boolean;
      extractionState: UIVerificationReport['extractionQuality']['state'];
    }
  | {
      type: 'review.submit.response-error';
      traceId: string;
      requestId: number;
      scenarioId: string;
      message: string;
    }
  | {
      type: 'review.submit.aborted';
      traceId: string;
      requestId: number;
      scenarioId: string;
    }
  | {
      type: 'review.submit.exception';
      traceId: string;
      requestId: number;
      scenarioId: string;
      errorName: string;
      message: string;
    }
  | {
      type: 'review.pipeline.complete';
      traceId: string | null;
      requestId: number;
      scenarioId: string;
      hasLiveReport: boolean;
      resultReportId: string | null;
      resultVerdict: UIVerificationReport['verdict'] | null;
    }
  | {
      type: 'review.pipeline.failed';
      traceId: string | null;
      requestId: number;
      scenarioId: string;
      phase: ProcessingPhase;
      message: string;
    }
  | {
      type: 'review.pipeline.state';
      traceId: string | null;
      scenarioId: string;
      phase: ProcessingPhase;
      activeStepId: ProcessingStep['id'] | null;
      failedStepId: ProcessingStep['id'] | null;
      stepStatuses: Array<{
        id: ProcessingStep['id'];
        status: ProcessingStep['status'];
      }>;
    };

interface UseSingleReviewPipelineOptions {
  image: LabelImage | null;
  secondaryImage?: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  scenarioId: string;
  setView: (view: View) => void;
  resolveTerminalReport: (
    liveReport: UIVerificationReport | null
  ) => UIVerificationReport;
  /**
   * Image-first prefetch cache key. When present, the submitReview
   * call passes it via the x-extraction-cache-key header so the
   * server skips re-extraction.
   */
  getExtractionCacheKey?: () => string | null;
  onLiveReportReady?: (liveReport: UIVerificationReport) => void;
  onEvent?: (event: ReviewPipelineEvent) => void;
}

function hasApplicationData(fields: IntakeFields): boolean {
  return (
    fields.brandName.trim().length > 0 ||
    fields.fancifulName.trim().length > 0 ||
    fields.classType.trim().length > 0 ||
    fields.alcoholContent.trim().length > 0 ||
    fields.netContents.trim().length > 0 ||
    fields.applicantAddress.trim().length > 0 ||
    fields.country.trim().length > 0 ||
    fields.formulaId.trim().length > 0 ||
    fields.appellation.trim().length > 0 ||
    fields.vintage.trim().length > 0 ||
    fields.varietals.some(
      (row) => row.name.trim().length > 0 || row.percentage.trim().length > 0
    )
  );
}

export function useSingleReviewPipeline(
  options: UseSingleReviewPipelineOptions
) {
  const [steps, setSteps] = useState<ProcessingStep[]>(buildInitialSteps);
  const [phase, setPhase] = useState<ProcessingPhase>('running');
  const [failureMessage, setFailureMessage] = useState<string>(
    DEFAULT_FAILURE_MESSAGE
  );
  const [report, setReport] = useState<UIVerificationReport | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const traceIdRef = useRef<string | null>(null);
  const pipelineStateSignatureRef = useRef<string | null>(null);

  const clearPipelineTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetPipelineState = useCallback(() => {
    setSteps(buildInitialSteps());
    setPhase('running');
    setFailureMessage(DEFAULT_FAILURE_MESSAGE);
  }, []);

  useEffect(() => {
    return () => {
      clearPipelineTimer();
      abortControllerRef.current?.abort();
    };
  }, [clearPipelineTimer]);

  useEffect(() => {
    const stepStatuses = steps.map((step) => ({
      id: step.id,
      status: step.status
    }));
    const activeStep = steps.find((step) => step.status === 'active') ?? null;
    const failedStep = steps.find((step) => step.status === 'failed') ?? null;
    const signature = JSON.stringify({
      scenarioId: options.scenarioId,
      phase,
      stepStatuses
    });

    if (signature === pipelineStateSignatureRef.current) {
      return;
    }

    pipelineStateSignatureRef.current = signature;
    options.onEvent?.({
      type: 'review.pipeline.state',
      traceId: traceIdRef.current,
      scenarioId: options.scenarioId,
      phase,
      activeStepId: activeStep?.id ?? null,
      failedStepId: failedStep?.id ?? null,
      stepStatuses
    });
  }, [options.onEvent, options.scenarioId, phase, steps]);

  // Mirror `steps` into a ref so completePipeline can observe current
  // step status synchronously when it runs (setSteps is async).
  const stepsRef = useRef<ProcessingStep[]>(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const completePipeline = useCallback(
    (requestId: number, liveReport: UIVerificationReport | null) => {
      if (requestId !== requestIdRef.current) {
        return;
      }

      options.onEvent?.({
        type: 'review.pipeline.complete',
        traceId: traceIdRef.current,
        requestId,
        scenarioId: options.scenarioId,
        hasLiveReport: liveReport !== null,
        resultReportId: liveReport?.id ?? null,
        resultVerdict: liveReport?.verdict ?? null
      });

      // Stop any in-flight scheduleAdvance timer from racing us.
      clearPipelineTimer();
      abortControllerRef.current = null;

      // Cache the terminal report so the walk-through animator can
      // commit it at the end without re-resolving.
      const finalReport = options.resolveTerminalReport(liveReport);

      const finalize = () => {
        if (requestId !== requestIdRef.current) return;
        setSteps((previous) =>
          previous.map((step) => ({ ...step, status: 'done' }))
        );
        setPhase('terminal');
        setReport(finalReport);
        options.setView('results');
      };

      // If the scheduleAdvance timer already ticked every step to 'done'
      // before the API responded, finalize without any extra pacing.
      const firstUnfinished = stepsRef.current.findIndex(
        (step) => step.status !== 'done'
      );
      if (firstUnfinished === -1) {
        finalize();
        return;
      }

      // Otherwise, walk through remaining steps with a tight pace so the
      // reviewer always SEES each step tick through active → done before
      // the page flips. Without this, a fast API response (e.g. a
      // prefetch hit landing in 600ms) would teleport from "step 2
      // active" straight to Results.
      const TAIL_ADVANCE_MS = 250;
      const totalSteps = stepsRef.current.length;
      const advance = (index: number) => {
        if (requestId !== requestIdRef.current) return;
        setSteps((previous) => {
          const next = previous.map((step) => ({ ...step }));
          if (index < next.length) {
            next[index] = { ...next[index], status: 'done' };
          }
          if (index + 1 < next.length) {
            next[index + 1] = { ...next[index + 1], status: 'active' };
          }
          return next;
        });
        if (index + 1 < totalSteps) {
          timerRef.current = window.setTimeout(
            () => advance(index + 1),
            TAIL_ADVANCE_MS
          );
        } else {
          timerRef.current = window.setTimeout(finalize, TAIL_ADVANCE_MS);
        }
      };
      advance(firstUnfinished);
    },
    [clearPipelineTimer, options]
  );

  const failPipeline = useCallback(
    (requestId: number, message: string) => {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const activeStep =
        steps.find((step) => step.status === 'active') ??
        steps.find((step) => step.status === 'failed') ??
        null;
      const resolvedMessage = resolveReviewFailureMessage(
        message,
        activeStep?.id ?? null
      );

      options.onEvent?.({
        type: 'review.pipeline.failed',
        traceId: traceIdRef.current,
        requestId,
        scenarioId: options.scenarioId,
        phase,
        message: resolvedMessage
      });

      clearPipelineTimer();
      abortControllerRef.current = null;
      setFailureMessage(resolvedMessage);
      setSteps((previous) => {
        const next = previous.map((step) => ({ ...step }));
        const activeIndex = next.findIndex((step) => step.status === 'active');

        if (activeIndex === -1) {
          return previous;
        }

        next[activeIndex] = { ...next[activeIndex], status: 'failed' };
        return next;
      });
      setPhase('failed');
    },
    [clearPipelineTimer, options, phase, steps]
  );

  const resolveCurrentFailureMessage = useCallback(
    (message: string) => {
      const activeStep =
        steps.find((step) => step.status === 'active') ??
        steps.find((step) => step.status === 'failed') ??
        null;

      return resolveReviewFailureMessage(message, activeStep?.id ?? null);
    },
    [steps]
  );

  const startPipeline = useCallback(
    (shouldFail: boolean, requestId: number) => {
      clearPipelineTimer();
      resetPipelineState();

      const scheduleAdvance = (stepIndex: number) => {
        const delay =
          STEP_DELAYS_MS[stepIndex] ??
          STEP_DELAYS_MS[STEP_DELAYS_MS.length - 1] ??
          900;

        const tick = () => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          let nextStepIndex = -1;
          let failed = false;

          setSteps((previous) => {
            const next = previous.map((step) => ({ ...step }));
            const activeIndex = next.findIndex(
              (step) => step.status === 'active'
            );
            if (activeIndex === -1) {
              return previous;
            }

            if (shouldFail && activeIndex === 2) {
              next[activeIndex] = { ...next[activeIndex], status: 'failed' };
              failed = true;
              return next;
            }

            // Last step — stay active until the API responds.
            if (activeIndex === next.length - 1) {
              return previous;
            }

            next[activeIndex] = { ...next[activeIndex], status: 'done' };
            const following = activeIndex + 1;
            if (following < next.length) {
              next[following] = { ...next[following], status: 'active' };
              nextStepIndex = following;
            }
            return next;
          });

          if (failed) {
            setPhase('failed');
            return;
          }

          if (nextStepIndex >= 0) {
            scheduleAdvance(nextStepIndex);
          }
        };

        timerRef.current = window.setTimeout(tick, delay);
      };

      scheduleAdvance(0);
    },
    [clearPipelineTimer, resetPipelineState]
  );

  /** Shared setup: bump request counter, abort stale, emit started event. */
  const beginReview = useCallback(() => {
    if (!options.image) return null;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const clientRequestId = crypto.randomUUID();
    traceIdRef.current = clientRequestId;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setReport(null);
    options.setView('processing');
    options.onEvent?.({
      type: 'review.submit.started',
      traceId: clientRequestId,
      requestId,
      scenarioId: options.scenarioId,
      demoScenarioId: options.image.demoScenarioId ?? null,
      labelMimeType: options.image.file.type,
      labelBytes: options.image.file.size,
      hasApplicationData: hasApplicationData(options.fields),
      beverage: options.beverage
    });
    return { requestId, clientRequestId };
  }, [options]);

  const PREFETCH_ABBREVIATED_MS = 600;

  const startReviewFromPrefetch = useCallback(
    (cachedReport: UIVerificationReport) => {
      const ctx = beginReview();
      if (!ctx) return;
      clearPipelineTimer();
      resetPipelineState();
      options.onLiveReportReady?.(cachedReport);
      timerRef.current = window.setTimeout(() => {
        if (ctx.requestId !== requestIdRef.current) return;
        completePipeline(ctx.requestId, cachedReport);
      }, PREFETCH_ABBREVIATED_MS);
    },
    [beginReview, clearPipelineTimer, completePipeline, options, resetPipelineState]
  );

  const startReview = useCallback(
    async (shouldFail: boolean) => {
      const ctx = beginReview();
      if (!ctx) return;
      startPipeline(shouldFail, ctx.requestId);

      if (shouldFail) {
        options.onEvent?.({
          type: 'review.submit.fixture-failure',
          traceId: ctx.clientRequestId,
          requestId: ctx.requestId,
          scenarioId: options.scenarioId
        });
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // options.image is guaranteed non-null: beginReview() returns null when image is missing.
        const result = await submitReview({
          image: options.image!,
          secondaryImage: options.secondaryImage,
          beverage: options.beverage,
          fields: options.fields,
          signal: controller.signal,
          clientRequestId: ctx.clientRequestId,
          extractionCacheKey: options.getExtractionCacheKey?.() ?? undefined
        });

        if (result.ok) {
          options.onEvent?.({
            type: 'review.submit.response-ok',
            traceId: ctx.clientRequestId,
            requestId: ctx.requestId,
            scenarioId: options.scenarioId,
            reportId: result.report.id,
            verdict: result.report.verdict,
            standalone: result.report.standalone,
            extractionState: result.report.extractionQuality.state
          });
          options.onLiveReportReady?.(result.report);
          completePipeline(ctx.requestId, result.report);
          return;
        }

        const resolvedMessage = resolveCurrentFailureMessage(result.message);

        options.onEvent?.({
          type: 'review.submit.response-error',
          traceId: ctx.clientRequestId,
          requestId: ctx.requestId,
          scenarioId: options.scenarioId,
          message: resolvedMessage
        });
        failPipeline(ctx.requestId, resolvedMessage);
      } catch (error) {
        if (controller.signal.aborted) {
          options.onEvent?.({
            type: 'review.submit.aborted',
            traceId: ctx.clientRequestId,
            requestId: ctx.requestId,
            scenarioId: options.scenarioId
          });
          return;
        }

        const message =
          error instanceof Error && error.name === 'AbortError'
            ? DEFAULT_FAILURE_MESSAGE
            : GENERIC_FAILURE_MESSAGE;

        const resolvedMessage = resolveCurrentFailureMessage(message);

        options.onEvent?.({
          type: 'review.submit.exception',
          traceId: ctx.clientRequestId,
          requestId: ctx.requestId,
          scenarioId: options.scenarioId,
          errorName: error instanceof Error ? error.name : 'unknown',
          message: resolvedMessage
        });

        failPipeline(ctx.requestId, resolvedMessage);
      }
    },
    [beginReview, completePipeline, failPipeline, options, resolveCurrentFailureMessage, startPipeline]
  );

  const abandonInFlightReview = useCallback(() => {
    clearPipelineTimer();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestIdRef.current += 1;
  }, [clearPipelineTimer]);

  return {
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
  };
}
