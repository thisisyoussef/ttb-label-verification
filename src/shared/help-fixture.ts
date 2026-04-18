import {
  helpManifestSchema,
  type HelpManifest,
  type InfoPopover,
  type TourStep
} from './contracts/help';

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
      "Reviewers drop a label image (JPEG, PNG, WEBP, or PDF) into this area. For the tour, we've loaded a sample spirits label.",
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
      'Clicking Verify Label starts the review — the tool reads the image, identifies fields, detects the beverage type, runs compliance checks, and prepares evidence. Click it now to continue.',
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
      'The results page summarizes the overall state, then shows a field-by-field checklist. Every row is explainable.',
    target: 'tour-verdict-banner'
  },
  {
    anchorKey: 'warning-evidence',
    stepIndex: 6,
    totalSteps: 8,
    title: 'What needs review looks like',
    body:
      'That label passed — but the government warning is the most common reason one won\u2019t. The tool checks it five ways: presence, exact text, uppercase heading, continuous paragraph, and legibility. Let\u2019s switch to a label with issues so you can see how problems are surfaced.',
    target: 'tour-warning-row',
    requires: { expandRowId: 'government-warning' },
    showMe: {
      label: 'See failing example',
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
      'We check the government warning in five ways — presence, exact text, uppercase heading, continuous paragraph, and legibility. The text comparison below highlights the exact words, letters, or punctuation that do not match the required wording.'
  },
  {
    anchorKey: 'confidence-indicator',
    title: 'Confidence',
    body:
      "This bar shows how reliably the tool could read this field from the label. Green means 90%+; amber means 70\u201389%; red means below 70%. Lower confidence does not change the verdict \u2014 it\u2019s a signal to double-check the value yourself."
  },
  {
    anchorKey: 'standalone-mode',
    title: 'Image only',
    body:
      'You uploaded an image without application data, so the tool is reading and checking what it can find on the label. Checks that compare against application data are skipped. Use Run Full Comparison to go back and provide that data.'
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

export const LOCAL_HELP_MANIFEST: HelpManifest = helpManifestSchema.parse({
  version: 1,
  locale: 'en',
  tourSteps: TOUR_STEPS,
  infoPopovers: INFO_POPOVERS
});
