import type { HelpShowMe } from '../helpManifest';
import type { CheckStatus, ProcessingPhase, Verdict } from '../types';

export const DEFAULT_TOUR_SCENARIO_ID = 'perfect-spirit-label';
export const WARNING_TOUR_SCENARIO_ID = 'spirit-warning-errors';

export type TourMode = 'single' | 'batch';
export type TourView =
  | 'intake'
  | 'processing'
  | 'results'
  | 'batch-intake'
  | 'batch-processing'
  | 'batch-dashboard'
  | 'batch-result';

export interface TourRuntimeContext {
  mode: TourMode;
  view: TourView;
  scenarioId: string;
  hasImage: boolean;
  hasReport: boolean;
  usingDemoResult?: boolean;
  reportVerdict?: Verdict;
  warningStatus?: CheckStatus | null;
  processingPhase?: ProcessingPhase;
}

export type TourNextAction =
  | {
      kind: 'advance';
    }
  | {
      kind: 'show-me';
      action: HelpShowMe;
      advance: boolean;
    };

export type TourInteractionAction =
  | {
      kind: 'advance';
    }
  | {
      kind: 'await-results';
    };

export type PendingVerifyAdvanceAction =
  | {
      kind: 'wait';
    }
  | {
      kind: 'advance';
    }
  | {
      kind: 'show-me-and-advance';
      action: HelpShowMe;
    }
  | {
      kind: 'clear';
    };
