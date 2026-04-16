import { buildInitialSteps } from './appSingleState';
import { DEFAULT_FAILURE_MESSAGE, resolveReviewFailureMessage } from './reviewFailureMessage';
import type { ProcessingPhase, ProcessingStep, UIVerificationReport } from './types';

export interface PipelineState {
  steps: ProcessingStep[];
  phase: ProcessingPhase;
  failureMessage: string;
  report: UIVerificationReport | null;
}

export type PipelineAction =
  | { type: 'reset' }
  | { type: 'advance-step' }
  | { type: 'fail-active-step'; shouldFail: boolean; stepIndex: number }
  | { type: 'complete'; report: UIVerificationReport }
  | { type: 'fail-pipeline'; message: string }
  | { type: 'set-report'; report: UIVerificationReport | null }
  | { type: 'set-phase'; phase: ProcessingPhase }
  | { type: 'set-failure-message'; message: string };

export function createInitialPipelineState(): PipelineState {
  return {
    steps: buildInitialSteps(),
    phase: 'running',
    failureMessage: DEFAULT_FAILURE_MESSAGE,
    report: null
  };
}

export function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case 'reset':
      return { ...state, steps: buildInitialSteps(), phase: 'running', failureMessage: DEFAULT_FAILURE_MESSAGE };

    case 'advance-step': {
      const activeIndex = state.steps.findIndex((s) => s.status === 'active');
      if (activeIndex === -1 || activeIndex === state.steps.length - 1) return state;
      const next = state.steps.map((step) => ({ ...step }));
      next[activeIndex] = { ...next[activeIndex], status: 'done' };
      if (activeIndex + 1 < next.length) next[activeIndex + 1] = { ...next[activeIndex + 1], status: 'active' };
      return { ...state, steps: next };
    }

    case 'fail-active-step': {
      if (!action.shouldFail) return state;
      const activeIndex = state.steps.findIndex((s) => s.status === 'active');
      if (activeIndex === -1 || activeIndex !== action.stepIndex) return state;
      const next = state.steps.map((step) => ({ ...step }));
      next[activeIndex] = { ...next[activeIndex], status: 'failed' };
      return { ...state, steps: next, phase: 'failed' };
    }

    case 'complete':
      return {
        ...state,
        steps: state.steps.map((step) => ({ ...step, status: 'done' })),
        phase: 'terminal',
        report: action.report
      };

    case 'fail-pipeline': {
      const activeStep = state.steps.find((s) => s.status === 'active') ?? state.steps.find((s) => s.status === 'failed');
      const resolvedMessage = resolveReviewFailureMessage(action.message, activeStep?.id ?? null);
      const next = state.steps.map((step) => ({ ...step }));
      const activeIndex = next.findIndex((s) => s.status === 'active');
      if (activeIndex !== -1) next[activeIndex] = { ...next[activeIndex], status: 'failed' };
      return { ...state, steps: next, phase: 'failed', failureMessage: resolvedMessage };
    }

    case 'set-report':
      return { ...state, report: action.report };
    case 'set-phase':
      return { ...state, phase: action.phase };
    case 'set-failure-message':
      return { ...state, failureMessage: action.message };
  }
}
