import { describe, expect, it } from 'vitest';

import { LOCAL_HELP_MANIFEST } from '../../shared/help-fixture';
import { seedScenarios } from '../scenarios';
import {
  buildTourDemoImage,
  isTourNextDisabled,
  resolveTourExpandedCheckId,
  resolvePendingVerifyAdvanceAction,
  resolveTourInteractionAction,
  resolveTourDemoReviewReport,
  resolveTourStep,
} from './help-tour-runtime';

function step(anchorKey: (typeof LOCAL_HELP_MANIFEST.tourSteps)[number]['anchorKey']) {
  const entry = LOCAL_HELP_MANIFEST.tourSteps.find(
    (tourStep) => tourStep.anchorKey === anchorKey,
  );

  if (!entry) {
    throw new Error(`Missing tour step for ${anchorKey}.`);
  }

  return entry;
}

function stepByTarget(
  target: NonNullable<(typeof LOCAL_HELP_MANIFEST.tourSteps)[number]['target']>
) {
  const entry = LOCAL_HELP_MANIFEST.tourSteps.find(
    (tourStep) => tourStep.target === target
  );

  if (!entry) {
    throw new Error(`Missing tour step for ${target}.`);
  }

  return entry;
}

describe('help tour runtime', () => {
  it('adds a recovery action when the verify step has no image loaded', () => {
    const resolved = resolveTourStep(step('processing'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'blank',
      hasImage: false,
      hasReport: false,
    });

    expect(resolved.interaction).toBeUndefined();
    expect(resolved.cta).toMatch(/disabled/i);
    expect(resolved.showMe).toEqual({
      label: 'Prepare sample',
      action: 'load-scenario',
      payload: {
        scenarioId: 'perfect-spirit-label',
      },
    });
  });

  it('adds a recovery action when the drop-zone step is reached outside intake', () => {
    const resolved = resolveTourStep(stepByTarget('tour-drop-zone'), {
      mode: 'batch',
      view: 'batch-intake',
      scenarioId: 'blank',
      hasImage: false,
      hasReport: false
    });

    expect(resolved.cta).toMatch(/single-label intake/i);
    expect(resolved.showMe).toEqual({
      label: 'Prepare sample',
      action: 'load-scenario',
      payload: {
        scenarioId: 'perfect-spirit-label'
      }
    });
  });

  it('keeps click-to-advance on the verify step when intake is ready', () => {
    const resolved = resolveTourStep(step('processing'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false,
    });

    expect(resolved.interaction).toBe('click-to-advance');
    expect(resolved.showMe).toBeUndefined();
    expect(resolved.cta).toBe('Click Verify Label to continue');
  });

  it('removes the stale Load sample recovery when the drop-zone is already ready', () => {
    const resolved = resolveTourStep(stepByTarget('tour-drop-zone'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false
    });

    expect(resolved.showMe).toBeUndefined();
    expect(resolved.cta).toMatch(/already loaded/i);
  });

  it('returns the verify step to intake when the user is elsewhere in the app', () => {
    const resolved = resolveTourStep(step('processing'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true,
      processingPhase: 'terminal'
    });

    expect(resolved.interaction).toBeUndefined();
    expect(resolved.cta).toMatch(/return to the single-label intake/i);
    expect(resolved.showMe).toEqual({
      label: 'Return to intake',
      action: 'advance-view',
      payload: {
        mode: 'single',
        view: 'intake'
      }
    });
  });

  it('turns the verify step into a waiting state while live processing is running', () => {
    const resolved = resolveTourStep(step('processing'), {
      mode: 'single',
      view: 'processing',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false,
      processingPhase: 'running'
    });

    expect(resolved.interaction).toBeUndefined();
    expect(resolved.cta).toMatch(/verification is running/i);
    expect(resolved.showMe).toBeUndefined();
  });

  it('offers sample results when live verification fails during the tour', () => {
    const resolved = resolveTourStep(step('processing'), {
      mode: 'single',
      view: 'processing',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false,
      processingPhase: 'failed'
    });

    expect(resolved.interaction).toBeUndefined();
    expect(resolved.cta).toMatch(/verification failed/i);
    expect(resolved.showMe).toEqual({
      label: 'Show sample results',
      action: 'advance-view',
      payload: {
        mode: 'single',
        view: 'results',
        scenarioId: 'perfect-spirit-label'
      }
    });
  });

  it('offers sample results when the verdict step is reached without a report', () => {
    const resolved = resolveTourStep(step('verdict-and-checklist'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'blank',
      hasImage: false,
      hasReport: false,
    });

    expect(resolved.interaction).toBeUndefined();
    expect(resolved.cta).toMatch(/results appear/i);
    expect(resolved.showMe).toEqual({
      label: 'Show sample results',
      action: 'advance-view',
      payload: {
        mode: 'single',
        view: 'results',
        scenarioId: 'perfect-spirit-label',
      },
    });
  });

  it('turns the batch switch step into a passive step when batch mode is already open', () => {
    const resolved = resolveTourStep(step('batch-matching'), {
      mode: 'batch',
      view: 'batch-intake',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true,
    });

    expect(resolved.interaction).toBeUndefined();
    expect(resolved.cta).toMatch(/already in batch/i);
  });

  it('always pivots the warning step to the failing warning scenario until that exact scenario is loaded', () => {
    const liveResolved = resolveTourStep(step('warning-evidence'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true
    });

    const otherWarningResolved = resolveTourStep(step('warning-evidence'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'custom-warning-case',
      hasImage: true,
      hasReport: true,
      warningStatus: 'review'
    });

    expect(liveResolved.cta).toMatch(/failing label/i);
    expect(liveResolved.showMe).toEqual({
      label: 'See failing example',
      action: 'advance-view',
      payload: {
        mode: 'single',
        view: 'results',
        scenarioId: 'spirit-warning-errors'
      }
    });
    expect(otherWarningResolved.cta).toMatch(/failing label/i);
    expect(otherWarningResolved.showMe).toEqual({
      label: 'See failing example',
      action: 'advance-view',
      payload: {
        mode: 'single',
        view: 'results',
        scenarioId: 'spirit-warning-errors'
      }
    });
  });

  it('clears the show-me action when the warning-defect results are already loaded', () => {
    const resolved = resolveTourStep(step('warning-evidence'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'spirit-warning-errors',
      hasImage: true,
      hasReport: true
    });

    expect(resolved.showMe).toBeUndefined();
    expect(resolved.cta).toMatch(/failing label is loaded/i);
  });

  it('disables Next on the verify step until the reviewer actually reaches results', () => {
    const nextDisabled = isTourNextDisabled(step('processing'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'blank',
      hasImage: false,
      hasReport: false
    });

    expect(nextDisabled).toBe(true);
  });

  it('keeps Next disabled on the verify step while processing is still running', () => {
    const nextDisabled = isTourNextDisabled(step('processing'), {
      mode: 'single',
      view: 'processing',
      scenarioId: 'spirit-warning-errors',
      hasImage: true,
      hasReport: false,
      processingPhase: 'running'
    });

    expect(nextDisabled).toBe(true);
  });

  it('re-enables Next on the verify step once results exist', () => {
    const nextDisabled = isTourNextDisabled(step('processing'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'spirit-warning-errors',
      hasImage: true,
      hasReport: true
    });

    expect(nextDisabled).toBe(false);
  });

  it('disables Next on the verdict step until results exist', () => {
    const nextDisabled = isTourNextDisabled(step('verdict-and-checklist'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'blank',
      hasImage: false,
      hasReport: false
    });

    expect(nextDisabled).toBe(true);
  });

  it('disables Next on the warning step until the failing warning scenario is loaded', () => {
    const nextDisabled = isTourNextDisabled(step('warning-evidence'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true
    });

    expect(nextDisabled).toBe(true);
  });

  it('disables Next on the batch step until batch mode is actually open', () => {
    const nextDisabled = isTourNextDisabled(step('batch-matching'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true
    });

    expect(nextDisabled).toBe(true);
  });

  it('waits for results instead of advancing immediately when the real Verify button is clicked', () => {
    const action = resolveTourInteractionAction(step('processing'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false,
      processingPhase: 'running'
    });

    expect(action).toEqual({ kind: 'await-results' });
  });

  it('keeps waiting after the Verify click while the shell is still moving into processing', () => {
    const action = resolvePendingVerifyAdvanceAction(step('processing'), {
      mode: 'single',
      view: 'intake',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false,
      processingPhase: 'running'
    });

    expect(action).toEqual({ kind: 'wait' });
  });

  it('auto-recovers pending verify advance into sample results after a failed run', () => {
    const action = resolvePendingVerifyAdvanceAction(step('processing'), {
      mode: 'single',
      view: 'processing',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false,
      processingPhase: 'failed'
    });

    expect(action).toEqual({
      kind: 'show-me-and-advance',
      action: {
        label: 'Show sample results',
        action: 'advance-view',
        payload: {
          mode: 'single',
          view: 'results',
          scenarioId: 'perfect-spirit-label'
        }
      }
    });
  });

  it('advances pending verify interaction once live results exist', () => {
    const action = resolvePendingVerifyAdvanceAction(step('processing'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true,
      processingPhase: 'terminal'
    });

    expect(action).toEqual({ kind: 'advance' });
  });

  it('keeps the pending advance alive when the verify step has been rewritten to the processing-status target', () => {
    // resolveTourStep swaps step 4's target to `tour-processing-status`
    // while the pipeline runs so the spotlight has something to anchor
    // to. Without this case, resolvePendingVerifyAdvanceAction would
    // see the rewritten target and clear the pending flag, breaking
    // the auto-advance to the verdict step when results land.
    const rewrittenStep = {
      ...step('processing'),
      target: 'tour-processing-status' as const,
      interaction: undefined
    };
    const waitAction = resolvePendingVerifyAdvanceAction(rewrittenStep, {
      mode: 'single',
      view: 'processing',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: false,
      processingPhase: 'running'
    });

    expect(waitAction).toEqual({ kind: 'wait' });

    const advanceAction = resolvePendingVerifyAdvanceAction(rewrittenStep, {
      mode: 'single',
      view: 'results',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true,
      processingPhase: 'terminal'
    });

    expect(advanceAction).toEqual({ kind: 'advance' });
  });

  it('requests expansion of the government warning row on the warning-evidence step', () => {
    const expandedCheckId = resolveTourExpandedCheckId(step('warning-evidence'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'spirit-warning-errors',
      hasImage: true,
      hasReport: true,
      processingPhase: 'terminal'
    });

    expect(expandedCheckId).toBe('government-warning');
  });

  it('does not request warning-row expansion outside the failing warning scenario', () => {
    const expandedCheckId = resolveTourExpandedCheckId(step('warning-evidence'), {
      mode: 'single',
      view: 'results',
      scenarioId: 'perfect-spirit-label',
      hasImage: true,
      hasReport: true,
      processingPhase: 'terminal'
    });

    expect(expandedCheckId).toBeNull();
  });

  it('creates demo images and demo reports for tour-loaded scenarios', async () => {
    const scenario = seedScenarios.find(
      (entry) => entry.id === 'perfect-spirit-label',
    );

    if (!scenario) {
      throw new Error('Expected perfect-spirit-label scenario.');
    }

    // buildTourDemoImage is async now (fetches real cola-cloud assets
    // via /api/eval/label-image). In this unit test environment fetch
    // is unavailable / returns non-ok, so the builder falls back to
    // the synthetic 1×1 PNG + generated thumbnail — same shape as
    // before, which is what this assertion chain validates.
    const image = await buildTourDemoImage(scenario);
    const report = resolveTourDemoReviewReport(image);

    expect(image.demoScenarioId).toBe('perfect-spirit-label');
    // Fallback returns image/png; real-asset path returns image/webp.
    // Accept either so the assertion survives when a test-time fetch
    // polyfill lands the real asset.
    expect(['image/png', 'image/webp']).toContain(image.file.type);
    expect(report?.id).toBe('perfect-spirit-label');
  });
});
