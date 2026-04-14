import type { TourStep } from './helpManifest';
import {
  buildLoadScenarioAction,
  buildResultsAction,
  buildReturnToIntakeAction
} from './help-tour-actions';
export { buildTourDemoImage, resolveTourDemoReviewReport } from './help-tour-demo';
export type {
  PendingVerifyAdvanceAction,
  TourInteractionAction,
  TourNextAction,
  TourRuntimeContext
} from './help-tour-types';
import {
  DEFAULT_TOUR_SCENARIO_ID,
  WARNING_TOUR_SCENARIO_ID,
  type PendingVerifyAdvanceAction,
  type TourInteractionAction,
  type TourNextAction,
  type TourRuntimeContext
} from './help-tour-types';

function isUsingDemoResult(context: TourRuntimeContext): boolean {
  if (typeof context.usingDemoResult === 'boolean') {
    return context.usingDemoResult;
  }

  return context.scenarioId !== 'blank';
}

function resolveFallbackScenarioId(context: TourRuntimeContext): string {
  if (isUsingDemoResult(context) && context.scenarioId !== 'blank') {
    return context.scenarioId;
  }

  return DEFAULT_TOUR_SCENARIO_ID;
}

function buildFallbackResultsAction(
  label: string,
  context: TourRuntimeContext
) {
  return buildResultsAction(label, resolveFallbackScenarioId(context));
}

function resolveVerdictReadyCta(context: TourRuntimeContext): string {
  const subject = isUsingDemoResult(context)
    ? 'This sample label'
    : 'Your uploaded label';

  if (context.reportVerdict === 'approve') {
    return subject + ' cleared the current deterministic checks. Click Next to compare it with an issue case.';
  }

  if (context.reportVerdict === 'review' || context.reportVerdict === 'reject') {
    return subject + ' already surfaced issues. Click Next to inspect the evidence behind them.';
  }

  return subject + ' is ready to review. Click Next to continue.';
}

export function isTourNextDisabled(
  step: TourStep,
  context: TourRuntimeContext
): boolean {
  if (step.target === 'tour-drop-zone') {
    return context.mode !== 'single' || context.view !== 'intake' || !context.hasImage;
  }

  if (step.target === 'tour-verify-button') {
    return context.view !== 'results' || !context.hasReport;
  }

  if (step.anchorKey === 'verdict-and-checklist') {
    return context.view !== 'results' || !context.hasReport;
  }

  if (step.anchorKey === 'warning-evidence') {
    return context.view !== 'results' || !context.hasReport || context.scenarioId !== WARNING_TOUR_SCENARIO_ID;
  }

  if (step.anchorKey === 'batch-matching') {
    return context.mode !== 'batch';
  }

  return false;
}

export function resolveTourExpandedCheckId(
  step: TourStep,
  context: TourRuntimeContext
): string | null {
  if (
    step.anchorKey === 'warning-evidence' &&
    context.view === 'results' &&
    context.hasReport &&
    context.scenarioId === WARNING_TOUR_SCENARIO_ID
  ) {
    return step.requires?.expandRowId ?? null;
  }

  return null;
}

export function resolveTourStep(
  step: TourStep,
  context: TourRuntimeContext
): TourStep {
  if (step.target === 'tour-drop-zone') {
    if (context.mode !== 'single' || context.view !== 'intake') {
      return {
        ...step,
        cta: 'Return to the single-label intake to load a label image.',
        showMe: buildLoadScenarioAction('Prepare sample', DEFAULT_TOUR_SCENARIO_ID)
      };
    }

    if (!context.hasImage) {
      return {
        ...step,
        cta: 'Load a label image here, or use Prepare sample to continue.',
        showMe: buildLoadScenarioAction('Prepare sample', DEFAULT_TOUR_SCENARIO_ID)
      };
    }

    return {
      ...step,
      showMe: undefined,
      cta: 'A label image is already loaded. Click Next when you are ready to verify.'
    };
  }

  if (step.target === 'tour-verify-button') {
    if (context.mode === 'single' && context.view === 'processing') {
      if (context.processingPhase === 'failed') {
        return {
          ...step,
          target: 'tour-processing-status' as TourStep['target'],
          interaction: undefined,
          cta: 'Verification failed. Use Show sample results to continue the tour.',
          showMe: buildFallbackResultsAction('Show sample results', context)
        };
      }

      return {
        ...step,
        target: 'tour-processing-status' as TourStep['target'],
        interaction: undefined,
        cta: 'Verification is running. Wait for results to continue.',
        showMe: undefined
      };
    }

    if (context.mode !== 'single' || context.view !== 'intake') {
      return {
        ...step,
        interaction: undefined,
        cta: 'Return to the single-label intake, then click Verify Label.',
        showMe: buildReturnToIntakeAction()
      };
    }

    if (!context.hasImage) {
      return {
        ...step,
        interaction: undefined,
        cta: 'Verify Label is disabled until a label image is loaded.',
        showMe: buildLoadScenarioAction('Prepare sample', DEFAULT_TOUR_SCENARIO_ID)
      };
    }
  }

  if (step.anchorKey === 'verdict-and-checklist') {
    if (context.view !== 'results' || !context.hasReport) {
      return {
        ...step,
        interaction: undefined,
        cta: 'Results appear after a verification run finishes.',
        showMe: buildFallbackResultsAction('Show sample results', context)
      };
    }

    return {
      ...step,
      showMe: undefined,
      cta: resolveVerdictReadyCta(context)
    };
  }

  if (step.anchorKey === 'warning-evidence') {
    if (context.view === 'results' && context.hasReport && context.scenarioId === WARNING_TOUR_SCENARIO_ID) {
      return {
        ...step,
        showMe: undefined,
        cta: 'Review the failed checks and highlighted text in the expanded warning evidence.'
      };
    }

    return {
      ...step,
      cta: 'Load the failing label to review the failed checks and highlighted text.',
      showMe: buildResultsAction('Load failing label', WARNING_TOUR_SCENARIO_ID)
    };
  }

  if (step.anchorKey === 'batch-matching' && context.mode === 'batch') {
    return {
      ...step,
      showMe: undefined,
      interaction: undefined,
      cta: 'You are already in Batch mode. Click Next to continue.'
    };
  }

  return step;
}

export function resolveTourNextAction(
  _step: TourStep,
  _context: TourRuntimeContext
): TourNextAction {
  return { kind: 'advance' };
}

export function resolveTourInteractionAction(
  step: TourStep,
  context: TourRuntimeContext
): TourInteractionAction {
  if (
    step.target === 'tour-verify-button' &&
    context.mode === 'single' &&
    context.view === 'intake' &&
    context.hasImage &&
    !context.hasReport
  ) {
    return { kind: 'await-results' };
  }

  return { kind: 'advance' };
}

export function resolvePendingVerifyAdvanceAction(
  step: TourStep,
  context: TourRuntimeContext
): PendingVerifyAdvanceAction {
  if (step.target !== 'tour-verify-button') {
    return { kind: 'clear' };
  }

  if (context.view === 'results' && context.hasReport) {
    return { kind: 'advance' };
  }

  if (context.view === 'processing' && context.processingPhase === 'failed') {
    return {
      kind: 'show-me-and-advance',
      action: buildFallbackResultsAction('Show sample results', context)
    };
  }

  if (
    context.mode === 'single' &&
    (context.view === 'intake' || context.view === 'processing') &&
    context.hasImage &&
    !context.hasReport
  ) {
    return { kind: 'wait' };
  }

  return { kind: 'clear' };
}
