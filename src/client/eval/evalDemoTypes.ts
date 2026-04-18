import type {
  BatchItemStatus,
  BatchStreamSummary
} from '../../shared/contracts/review';
import type { EvalPackImage } from './evalDemoApi';

export type EvalRunPhase =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'complete'
  | 'error';

export type EvalProvider = 'cloud' | 'local';

export interface EvalRunConfig {
  packId: string;
  provider: EvalProvider;
  enableJudgment: boolean;
  enableOcrPrepass: boolean;
}

export interface EvalItemRow {
  imageId: string;
  packImage: EvalPackImage | null;
  filename: string;
  identity: string;
  status: BatchItemStatus;
  reportId?: string;
  errorMessage?: string;
  completedAtMs: number;
  startedAtMs: number;
  latencyMs: number;
}

export interface EvalRunState {
  phase: EvalRunPhase;
  packId: string | null;
  batchSessionId: string | null;
  total: number;
  done: number;
  secondsRemaining: number | null;
  currentImageId: string | null;
  items: EvalItemRow[];
  counts: {
    pass: number;
    review: number;
    fail: number;
    error: number;
  };
  summary: BatchStreamSummary | null;
  error: string | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
}

export const INITIAL_RUN_STATE: EvalRunState = {
  phase: 'idle',
  packId: null,
  batchSessionId: null,
  total: 0,
  done: 0,
  secondsRemaining: null,
  currentImageId: null,
  items: [],
  counts: { pass: 0, review: 0, fail: 0, error: 0 },
  summary: null,
  error: null,
  startedAtMs: null,
  endedAtMs: null
};
