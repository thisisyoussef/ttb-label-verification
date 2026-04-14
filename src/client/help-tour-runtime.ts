import type { HelpShowMe, TourStep } from './helpManifest';
import { buildLabelThumbnail } from './labelThumbnail';
import { buildReportForScenario } from './resultScenarios';
import type { SeedScenario } from './scenarios';
import type { LabelImage, ProcessingPhase, UIVerificationReport } from './types';

const DEFAULT_TOUR_SCENARIO_ID = 'perfect-spirit-label';
const WARNING_TOUR_SCENARIO_ID = 'spirit-warning-errors';
const DEMO_IMAGE_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218,
  99, 252, 255, 31, 0, 3, 3, 2, 0, 239, 167, 43, 183, 0, 0, 0, 0, 73, 69, 78, 68,
  174, 66, 96, 130
]);

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

function buildLoadScenarioAction(label: string, scenarioId: string): HelpShowMe {
  return {
    label,
    action: 'load-scenario',
    payload: { scenarioId }
  };
}

function buildResultsAction(label: string, scenarioId: string): HelpShowMe {
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

function buildReturnToIntakeAction(label = 'Return to intake'): HelpShowMe {
  return {
    label,
    action: 'advance-view',
    payload: {
      mode: 'single',
      view: 'intake'
    }
  };
}

function buildBatchIntakeAction(label = 'Open Batch mode'): HelpShowMe {
  return {
    label,
    action: 'advance-view',
    payload: {
      mode: 'batch',
      view: 'batch-intake'
    }
  };
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
          interaction: undefined,
          cta: 'Verification failed. Use Show sample results to continue the tour.',
          showMe: buildResultsAction(
            'Show sample results',
            context.scenarioId === 'blank'
              ? DEFAULT_TOUR_SCENARIO_ID
              : context.scenarioId
          )
        };
      }

      return {
        ...step,
        interaction: undefined,
        cta: 'Verification is running. Wait for results, or click Next to skip ahead.',
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
        showMe: buildResultsAction(
          'Show sample results',
          context.scenarioId === 'blank'
            ? DEFAULT_TOUR_SCENARIO_ID
            : context.scenarioId
        )
      };
    }
  }

  if (step.anchorKey === 'warning-evidence') {
    if (
      context.view !== 'results' ||
      !context.hasReport ||
      context.scenarioId !== WARNING_TOUR_SCENARIO_ID
    ) {
      return {
        ...step,
        cta: 'Load the warning-defect example to inspect the failed sub-checks and diff.',
        showMe: buildResultsAction(
          'Show warning defect',
          WARNING_TOUR_SCENARIO_ID
        )
      };
    }

    return {
      ...step,
      showMe: undefined,
      cta: 'Open the warning row to inspect the failed sub-checks and diff.'
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
  step: TourStep,
  context: TourRuntimeContext
): TourNextAction {
  if (step.target === 'tour-drop-zone') {
    if (context.mode !== 'single' || context.view !== 'intake' || !context.hasImage) {
      return {
        kind: 'show-me',
        action: buildLoadScenarioAction('Prepare sample', DEFAULT_TOUR_SCENARIO_ID),
        advance: true
      };
    }

    return { kind: 'advance' };
  }

  if (step.target === 'tour-verify-button') {
    if (context.view === 'results' && context.hasReport) {
      return { kind: 'advance' };
    }

    return {
      kind: 'show-me',
      action: buildResultsAction(
        'Show sample results',
        context.scenarioId === 'blank'
          ? DEFAULT_TOUR_SCENARIO_ID
          : context.scenarioId
      ),
      advance: true
    };
  }

  if (step.anchorKey === 'verdict-and-checklist') {
    if (context.view !== 'results' || !context.hasReport) {
      return {
        kind: 'show-me',
        action: buildResultsAction(
          'Show sample results',
          context.scenarioId === 'blank'
            ? DEFAULT_TOUR_SCENARIO_ID
            : context.scenarioId
        ),
        advance: true
      };
    }

    return { kind: 'advance' };
  }

  if (step.anchorKey === 'warning-evidence') {
    if (
      context.view !== 'results' ||
      !context.hasReport ||
      context.scenarioId !== WARNING_TOUR_SCENARIO_ID
    ) {
      return {
        kind: 'show-me',
        action: buildResultsAction('Show warning defect', WARNING_TOUR_SCENARIO_ID),
        advance: true
      };
    }

    return { kind: 'advance' };
  }

  if (step.anchorKey === 'batch-matching' && context.mode !== 'batch') {
    return {
      kind: 'show-me',
      action: buildBatchIntakeAction(),
      advance: true
    };
  }

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
      action: buildResultsAction(
        'Show sample results',
        context.scenarioId === 'blank'
          ? DEFAULT_TOUR_SCENARIO_ID
          : context.scenarioId
      )
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

export function buildTourDemoImage(scenario: SeedScenario): LabelImage {
  return {
    file: new File([DEMO_IMAGE_BYTES], `${scenario.id}.png`, {
      type: 'image/png'
    }),
    previewUrl: buildLabelThumbnail({
      brandName: scenario.fields.brandName || scenario.title,
      classType: scenario.fields.classType || scenario.description
    }),
    sizeLabel: '1 KB',
    demoScenarioId: scenario.id
  };
}

export function resolveTourDemoReviewReport(
  image: LabelImage | null
): UIVerificationReport | null {
  if (!image?.demoScenarioId) {
    return null;
  }

  return buildReportForScenario(image.demoScenarioId);
}
