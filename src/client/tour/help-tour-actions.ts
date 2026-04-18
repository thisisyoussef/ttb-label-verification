import type { HelpShowMe } from '../helpManifest';
import { DEFAULT_TOUR_SCENARIO_ID } from './help-tour-types';

export function buildLoadScenarioAction(
  label: string,
  scenarioId: string
): HelpShowMe {
  return {
    label,
    action: 'load-scenario',
    payload: { scenarioId }
  };
}

export function buildResultsAction(
  label: string,
  scenarioId: string
): HelpShowMe {
  return {
    label,
    action: 'advance-view',
    payload: {
      mode: 'single',
      view: 'results',
      scenarioId
    }
  };
}

export function buildSampleResultsAction(
  label: string,
  scenarioId: string
): HelpShowMe {
  return buildResultsAction(
    label,
    scenarioId === 'blank' ? DEFAULT_TOUR_SCENARIO_ID : scenarioId
  );
}

export function buildReturnToIntakeAction(label = 'Return to intake'): HelpShowMe {
  return {
    label,
    action: 'advance-view',
    payload: {
      mode: 'single',
      view: 'intake'
    }
  };
}

export function buildBatchIntakeAction(label = 'Open Batch mode'): HelpShowMe {
  return {
    label,
    action: 'advance-view',
    payload: {
      mode: 'batch',
      view: 'batch-intake'
    }
  };
}
