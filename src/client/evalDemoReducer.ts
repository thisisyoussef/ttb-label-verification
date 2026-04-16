import type {
  BatchItemStatus,
  BatchStreamFrame
} from '../shared/contracts/review';
import type { EvalPackImage } from './evalDemoApi';
import type {
  EvalItemRow,
  EvalRunPhase,
  EvalRunState
} from './evalDemoTypes';
import { INITIAL_RUN_STATE } from './evalDemoTypes';

export type EvalRunAction =
  | { type: 'reset' }
  | { type: 'start-prepare'; packId: string }
  | { type: 'start-run'; batchSessionId: string; total: number }
  | {
      type: 'stream-frame';
      frame: BatchStreamFrame;
      imageIdToPackImage: Map<string, EvalPackImage>;
      nowMs: number;
    }
  | { type: 'run-error'; message: string }
  | { type: 'run-complete'; nowMs: number };

function applyItemFrame(state: EvalRunState, action: {
  type: 'stream-frame';
  frame: BatchStreamFrame;
  imageIdToPackImage: Map<string, EvalPackImage>;
  nowMs: number;
}): EvalRunState {
  const frame = action.frame;
  if (frame.type !== 'item') return state;

  const startedAtMs = state.currentImageId === frame.imageId
    ? state.startedAtMs ?? action.nowMs
    : state.endedAtMs ?? state.startedAtMs ?? action.nowMs;
  const previousEndedAt = state.items[0]?.completedAtMs ?? state.startedAtMs ?? action.nowMs;
  const itemStartedAt = previousEndedAt;

  const packImage = action.imageIdToPackImage.get(frame.imageId) ?? null;
  const row: EvalItemRow = {
    imageId: frame.imageId,
    packImage,
    filename: frame.filename,
    identity: frame.identity,
    status: frame.status,
    reportId: frame.reportId,
    errorMessage: frame.errorMessage,
    completedAtMs: action.nowMs,
    startedAtMs: itemStartedAt,
    latencyMs: Math.max(0, action.nowMs - itemStartedAt)
  };

  const nextItems = [row, ...state.items.filter((entry) => entry.imageId !== frame.imageId)];
  const nextCounts = { ...state.counts };
  nextCounts[frame.status as BatchItemStatus] =
    (nextCounts[frame.status as BatchItemStatus] ?? 0) + 1;

  return {
    ...state,
    items: nextItems,
    counts: nextCounts,
    currentImageId: null,
    endedAtMs: action.nowMs,
    // keep startedAtMs as the earliest started-at so elapsed time is stable
    startedAtMs: startedAtMs
  };
}

export function evalRunReducer(state: EvalRunState, action: EvalRunAction): EvalRunState {
  switch (action.type) {
    case 'reset':
      return INITIAL_RUN_STATE;

    case 'start-prepare':
      return {
        ...INITIAL_RUN_STATE,
        phase: 'preparing',
        packId: action.packId
      };

    case 'start-run':
      return {
        ...state,
        phase: 'running',
        batchSessionId: action.batchSessionId,
        total: action.total,
        done: 0,
        items: [],
        counts: { pass: 0, review: 0, fail: 0, error: 0 },
        summary: null,
        error: null,
        startedAtMs: Date.now(),
        endedAtMs: null,
        currentImageId: null
      };

    case 'stream-frame': {
      const { frame } = action;
      if (frame.type === 'progress') {
        return {
          ...state,
          done: frame.done,
          total: frame.total,
          secondsRemaining: frame.secondsRemainingEstimate ?? null
        };
      }

      if (frame.type === 'item') {
        return applyItemFrame(state, action);
      }

      if (frame.type === 'summary') {
        const nextPhase: EvalRunPhase = 'complete';
        return {
          ...state,
          phase: nextPhase,
          done: frame.total,
          total: frame.total,
          secondsRemaining: 0,
          summary: frame,
          endedAtMs: action.nowMs,
          currentImageId: null
        };
      }

      return state;
    }

    case 'run-error':
      return {
        ...state,
        phase: 'error',
        error: action.message,
        endedAtMs: Date.now()
      };

    case 'run-complete':
      return {
        ...state,
        phase: 'complete',
        endedAtMs: action.nowMs
      };

    default:
      return state;
  }
}
