import type { TourTargetKey } from './tourTargets';

export type HelpAnchorKey =
  | 'orientation'
  | 'intake-form'
  | 'processing'
  | 'verdict-and-checklist'
  | 'warning-evidence'
  | 'standalone-mode'
  | 'batch-matching-logic'
  | 'batch-matching'
  | 'no-persistence'
  | 'confidence-indicator';

export type HelpShowMeAction =
  | 'noop'
  | 'load-scenario'
  | 'advance-view'
  | 'open-panel-section';

export interface HelpShowMe {
  label: string;
  action: HelpShowMeAction;
  payload?: Record<string, string>;
}

export interface TourStep {
  anchorKey: HelpAnchorKey;
  title: string;
  body: string;
  stepIndex: number;
  totalSteps: number;
  target?: TourTargetKey;
  interaction?: 'passive' | 'click-to-advance';
  requires?: {
    scenarioId?: string;
    expandRowId?: string;
    variant?: 'auto' | 'standalone';
    view?: 'intake' | 'results' | 'batch-intake';
    mode?: 'single' | 'batch';
  };
  showMe?: HelpShowMe;
  cta?: string;
}

export interface InfoPopover {
  anchorKey: HelpAnchorKey;
  title: string;
  body: string;
}

export interface HelpManifest {
  version: number;
  locale: 'en';
  tourSteps: TourStep[];
  infoPopovers: InfoPopover[];
}

const TOUR_STEPS: TourStep[] = [
  {
    anchorKey: 'orientation',
    stepIndex: 1,
    totalSteps: 8,
    title: 'A 2-minute tour',
    body:
      "This is the TTB label verification workstation. We'll walk through it together using safe sample data. Nothing you do in this tour is stored."
  },
  {
    anchorKey: 'intake-form',
    stepIndex: 2,
    totalSteps: 8,
    title: 'The tour launcher',
    body:
      'This button opens the tour any time — during single-label review, batch, anywhere. You can close the tour and come back.',
    target: 'tour-launcher'
  },
  {
    anchorKey: 'intake-form',
    stepIndex: 3,
    totalSteps: 8,
    title: 'Drop a label image',
    body:
      'Reviewers drop a label image (JPEG, PNG, WEBP, or PDF) into this area. For the tour, we\'ve loaded a sample spirits label.',
    target: 'tour-drop-zone',
    requires: { mode: 'single', view: 'intake' },
    showMe: {
      label: 'Load sample',
      action: 'load-scenario',
      payload: { scenarioId: 'perfect-spirit-label' }
    }
  },
  {
    anchorKey: 'processing',
    stepIndex: 4,
    totalSteps: 8,
    title: 'Verify the label',
    body:
      'Clicking Verify Label runs a deterministic pipeline — read image, extract fields, detect beverage type, run checks, prepare evidence. Try clicking it now, or Next to skip ahead.',
    target: 'tour-verify-button',
    interaction: 'click-to-advance',
    cta: 'Click Verify Label to continue',
    requires: { mode: 'single', view: 'intake' }
  },
  {
    anchorKey: 'verdict-and-checklist',
    stepIndex: 5,
    totalSteps: 8,
    title: 'One verdict, backed by evidence',
    body:
      'The results page shows one verdict — Approve, Review, or Reject — with a field-by-field checklist. Every row is explainable.',
    target: 'tour-verdict-banner'
  },
  {
    anchorKey: 'warning-evidence',
    stepIndex: 6,
    totalSteps: 8,
    title: 'Warning evidence',
    body:
      'The government warning is the most rejection-critical element. The tool runs five sub-checks and shows a character-aligned diff when anything is off. Use Show defect to load a failing label.',
    target: 'tour-warning-row',
    showMe: {
      label: 'Show warning defect',
      action: 'load-scenario',
      payload: { scenarioId: 'spirit-warning-errors' }
    }
  },
  {
    anchorKey: 'batch-matching',
    stepIndex: 7,
    totalSteps: 8,
    title: 'Switch to Batch',
    body:
      'For many labels at once, switch to Batch mode. Click the Batch tab to see how it works.',
    target: 'tour-batch-tab',
    interaction: 'click-to-advance',
    cta: 'Click the Batch tab to continue'
  },
  {
    anchorKey: 'no-persistence',
    stepIndex: 8,
    totalSteps: 8,
    title: 'Nothing is stored',
    body:
      "That's the tour. Everything you did lives only in this browser tab. Close the tab and it's all gone. Click Finish to exit — you can replay the tour from the launcher any time."
  }
];

const INFO_POPOVERS: InfoPopover[] = [
  {
    anchorKey: 'warning-evidence',
    title: 'Warning evidence',
    body:
      'We check the government warning against the required wording in five sub-checks — presence, exact text, uppercase heading, continuous paragraph, legibility. The character-aligned diff below shows where a failed text check differs from the required wording.'
  },
  {
    anchorKey: 'confidence-indicator',
    title: 'Confidence',
    body:
      "This bar shows how confident the extraction is for this field. Green means 90%+; amber means 70–89%; red means below 70%. Lower confidence is never a verdict — it's a signal to verify manually."
  },
  {
    anchorKey: 'standalone-mode',
    title: 'Standalone mode',
    body:
      'You uploaded an image without application data, so the tool is extracting and checking what it can read. Comparison checks that need the application data are skipped. Use Run Full Comparison to return and provide that data.'
  },
  {
    anchorKey: 'batch-matching-logic',
    title: 'How matching works',
    body:
      'We try to match each image to a CSV row using the filename column first. If a row has no filename, we fall back to row order. Ambiguous matches and unmatched items appear below so you can fix them before starting.'
  },
  {
    anchorKey: 'no-persistence',
    title: 'Nothing is stored',
    body:
      "Everything in this tool lives only in your browser tab. No images, no application data, no results, no batch sessions are written to a database, logged to a file, or retained by the model provider. Close the tab and it's all gone."
  }
];

export const LOCAL_HELP_MANIFEST: HelpManifest = {
  version: 1,
  locale: 'en',
  tourSteps: TOUR_STEPS,
  infoPopovers: INFO_POPOVERS
};

export function findInfoPopover(
  anchorKey: HelpAnchorKey
): InfoPopover | undefined {
  return LOCAL_HELP_MANIFEST.infoPopovers.find(
    (entry) => entry.anchorKey === anchorKey
  );
}

export function getTourSteps(): TourStep[] {
  return LOCAL_HELP_MANIFEST.tourSteps;
}
