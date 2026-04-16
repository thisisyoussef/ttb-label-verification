import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Mode, View } from './appTypes';
import {
  isTourNextDisabled,
  resolvePendingVerifyAdvanceAction,
  resolveTourExpandedCheckId,
  resolveTourInteractionAction,
  resolveTourStep,
  type TourRuntimeContext
} from './help-tour-runtime';
import type { HelpShowMe, TourStep } from './helpManifest';
import { seedScenarios } from './scenarios';
import type { HelpTourFlow } from './useHelpTourState';
import type { SingleReviewFlow } from './useSingleReviewFlow';

interface TourOrchestrationDeps {
  mode: Mode;
  view: View;
  single: SingleReviewFlow;
  help: HelpTourFlow;
  resetBatch: () => void;
  setMode: (mode: Mode) => void;
  setView: (view: View) => void;
  onSelectMode: (next: Mode, currentMode: Mode) => void;
}

export interface TourOrchestration {
  resolvedTourSteps: TourStep[];
  tourExpandedCheckId: string | null;
  tourNextDisabled: boolean;
  pendingVerifyTourAdvance: boolean;
  setPendingVerifyTourAdvance: (value: boolean) => void;
  onTourNext: () => void;
  onTourAdvanceInteraction: () => void;
  onTourFinish: () => void;
  onTourShowMe: (action: HelpShowMe) => void;
  onTourShowMeAndContinue: (action: HelpShowMe) => void;
}

export function useTourOrchestration(deps: TourOrchestrationDeps): TourOrchestration {
  const { mode, view, single, help, resetBatch, setMode, setView, onSelectMode } = deps;
  const [pendingVerifyTourAdvance, setPendingVerifyTourAdvance] = useState(false);

  const resolveScenario = useCallback(
    (scenarioId?: string) => {
      const fallbackScenarioId =
        single.scenarioId === 'blank' ? 'perfect-spirit-label' : single.scenarioId;
      const targetId = scenarioId ?? fallbackScenarioId;
      return seedScenarios.find((entry) => entry.id === targetId) ?? null;
    },
    [single.scenarioId]
  );

  const onTourShowMe = useCallback(
    (action: HelpShowMe) => {
      setPendingVerifyTourAdvance(false);
      if (action.action === 'load-scenario') {
        const scenario = resolveScenario(action.payload?.scenarioId);
        if (!scenario) return;
        if (mode !== 'single') onSelectMode('single', mode);
        single.onLoadTourScenario(scenario);
        return;
      }
      if (action.action === 'advance-view') {
        const targetView = action.payload?.view;
        const targetMode = action.payload?.mode;
        const variant = action.payload?.variant;
        const scenario = resolveScenario(action.payload?.scenarioId);
        if (targetMode === 'batch' || targetView === 'batch-intake') {
          onSelectMode('batch', mode);
          return;
        }
        if (targetMode === 'single' && mode !== 'single') onSelectMode('single', mode);
        if (targetView === 'results') {
          if (!scenario) return;
          single.onShowTourResults(scenario, variant === 'standalone' ? 'standalone' : 'auto');
          return;
        }
        if (targetView === 'intake') {
          if (scenario) { single.onLoadTourScenario(scenario); return; }
          if (mode !== 'single') onSelectMode('single', mode);
          else setView('intake');
        }
      }
    },
    [mode, onSelectMode, resolveScenario, setView, single]
  );

  const tourContext = useMemo<TourRuntimeContext>(
    () => ({
      mode, view,
      scenarioId: single.scenarioId,
      hasImage: single.image !== null,
      hasReport: single.report !== null,
      processingPhase: single.phase
    }),
    [mode, single.image, single.phase, single.report, single.scenarioId, view]
  );

  const resolvedTourSteps = useMemo(
    () => help.tourSteps.map((step) => resolveTourStep(step, tourContext)),
    [help.tourSteps, tourContext]
  );

  const currentTourStep = useMemo<TourStep | null>(() => {
    if (resolvedTourSteps.length === 0) return null;
    const index = Math.min(help.tourStepIndex, resolvedTourSteps.length - 1);
    return resolvedTourSteps[index] ?? null;
  }, [help.tourStepIndex, resolvedTourSteps]);

  const tourExpandedCheckId = useMemo(
    () => (currentTourStep ? resolveTourExpandedCheckId(currentTourStep, tourContext) : null),
    [currentTourStep, tourContext]
  );

  const tourNextDisabled = useMemo(
    () => (currentTourStep ? isTourNextDisabled(currentTourStep, tourContext) : false),
    [currentTourStep, tourContext]
  );

  const onTourNext = useCallback(() => {
    setPendingVerifyTourAdvance(false);
    if (!currentTourStep) { help.onNextTourStep(); return; }
    if (tourNextDisabled) return;
    help.onNextTourStep();
  }, [currentTourStep, help, tourNextDisabled]);

  const onTourShowMeAndContinue = useCallback(
    (action: HelpShowMe) => { onTourShowMe(action); help.onNextTourStep(); },
    [help, onTourShowMe]
  );

  const onTourAdvanceInteraction = useCallback(() => {
    if (!currentTourStep) { setPendingVerifyTourAdvance(false); help.onNextTourStep(); return; }
    const action = resolveTourInteractionAction(currentTourStep, tourContext);
    if (action.kind === 'await-results') { setPendingVerifyTourAdvance(true); return; }
    setPendingVerifyTourAdvance(false);
    help.onNextTourStep();
  }, [currentTourStep, help, tourContext]);

  useEffect(() => {
    if (!pendingVerifyTourAdvance) return;
    if (!help.tourOpen || !currentTourStep) { setPendingVerifyTourAdvance(false); return; }
    const action = resolvePendingVerifyAdvanceAction(currentTourStep, tourContext);
    if (action.kind === 'wait') return;
    if (action.kind === 'advance') { setPendingVerifyTourAdvance(false); help.onNextTourStep(); return; }
    if (action.kind === 'show-me-and-advance') {
      setPendingVerifyTourAdvance(false); onTourShowMe(action.action); help.onNextTourStep(); return;
    }
    if (action.kind === 'clear') setPendingVerifyTourAdvance(false);
  }, [currentTourStep, help, onTourShowMe, pendingVerifyTourAdvance, tourContext]);

  const onTourFinish = useCallback(() => {
    setPendingVerifyTourAdvance(false);
    single.reset();
    resetBatch();
    setMode('single');
    setView('intake');
    help.onFinishTour();
  }, [help, resetBatch, setMode, setView, single]);

  return {
    resolvedTourSteps, tourExpandedCheckId, tourNextDisabled,
    pendingVerifyTourAdvance, setPendingVerifyTourAdvance,
    onTourNext, onTourAdvanceInteraction, onTourFinish, onTourShowMe, onTourShowMeAndContinue
  };
}
