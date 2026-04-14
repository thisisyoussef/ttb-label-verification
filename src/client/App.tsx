import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';
import { AuthScreen } from './AuthScreen';
import {
  advanceAuthPhase,
  applyMockAuthSignOutReset,
  type AuthPhase
} from './authState';
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
import { useBatchWorkflow } from './useBatchWorkflow';
import { useHelpTourState } from './useHelpTourState';
import { useSingleReviewFlow } from './useSingleReviewFlow';
import { fixturesEnabled } from './review-runtime';

export function App() {
  const fixtureControlsEnabled = fixturesEnabled({
    isDev: import.meta.env.DEV,
    override: import.meta.env.VITE_ENABLE_DEV_FIXTURES
  });
  const [mode, setMode] = useState<Mode>('single');
  const [view, setView] = useState<View>('intake');
  const [authPhase, setAuthPhase] = useState<AuthPhase>('signed-out');
  const [pendingVerifyTourAdvance, setPendingVerifyTourAdvance] = useState(false);

  const single = useSingleReviewFlow({
    fixtureControlsEnabled,
    setView
  });
  const batch = useBatchWorkflow({
    fixtureControlsEnabled,
    setMode,
    setView
  });
  const help = useHelpTourState();

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
        if (mode !== 'single') {
          batch.onSelectMode('single', mode);
        }
        single.onLoadTourScenario(scenario);
        return;
      }

      if (action.action === 'advance-view') {
        const targetView = action.payload?.view;
        const targetMode = action.payload?.mode;
        const variant = action.payload?.variant;
        const scenario = resolveScenario(action.payload?.scenarioId);

        if (targetMode === 'batch' || targetView === 'batch-intake') {
          batch.onSelectMode('batch', mode);
          return;
        }

        if (targetMode === 'single' && mode !== 'single') {
          batch.onSelectMode('single', mode);
        }

        if (targetView === 'results') {
          if (!scenario) return;
          single.onShowTourResults(
            scenario,
            variant === 'standalone' ? 'standalone' : 'auto'
          );
          return;
        }

        if (targetView === 'intake') {
          if (scenario) {
            single.onLoadTourScenario(scenario);
            return;
          }
          if (mode !== 'single') {
            batch.onSelectMode('single', mode);
          } else {
            setView('intake');
          }
        }
      }
    },
    [batch, mode, resolveScenario, setView, single]
  );

  const tourContext = useMemo<TourRuntimeContext>(
    () => ({
      mode,
      view,
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

    if (!currentTourStep) {
      help.onNextTourStep();
      return;
    }

    if (tourNextDisabled) {
      return;
    }

    help.onNextTourStep();
  }, [currentTourStep, help, tourNextDisabled]);

  const onTourAdvanceInteraction = useCallback(() => {
    if (!currentTourStep) {
      setPendingVerifyTourAdvance(false);
      help.onNextTourStep();
      return;
    }

    const action = resolveTourInteractionAction(currentTourStep, tourContext);
    if (action.kind === 'await-results') {
      setPendingVerifyTourAdvance(true);
      return;
    }

    setPendingVerifyTourAdvance(false);
    help.onNextTourStep();
  }, [currentTourStep, help, tourContext]);

  useEffect(() => {
    if (!pendingVerifyTourAdvance) return;

    if (!help.tourOpen || !currentTourStep) {
      setPendingVerifyTourAdvance(false);
      return;
    }

    const action = resolvePendingVerifyAdvanceAction(currentTourStep, tourContext);

    if (action.kind === 'wait') {
      return;
    }

    if (action.kind === 'advance') {
      setPendingVerifyTourAdvance(false);
      help.onNextTourStep();
      return;
    }

    if (action.kind === 'show-me-and-advance') {
      setPendingVerifyTourAdvance(false);
      onTourShowMe(action.action);
      help.onNextTourStep();
      return;
    }

    if (action.kind === 'clear') {
      setPendingVerifyTourAdvance(false);
    }
  }, [
    currentTourStep,
    help,
    onTourShowMe,
    pendingVerifyTourAdvance,
    tourContext
  ]);

  const onTourFinish = useCallback(() => {
    setPendingVerifyTourAdvance(false);
    single.reset();
    batch.reset();
    setMode('single');
    setView('intake');
    help.onFinishTour();
  }, [batch, help, single]);

  if (authPhase !== 'signed-in') {
    return (
      <AuthScreen
        phase={authPhase}
        onStartPiv={() => setAuthPhase('piv-loading')}
        onStartSsoForm={() => setAuthPhase('sso-form')}
        onBackFromSso={() => setAuthPhase('signed-out')}
        onSubmitSso={() => setAuthPhase('sso-loading')}
        onPhaseComplete={() => setAuthPhase((previous) => advanceAuthPhase(previous))}
      />
    );
  }

  return (
    <AppShell
      help={{
        ...help,
        tourSteps: resolvedTourSteps
      }}
      mode={mode}
      view={view}
      fixtureControlsEnabled={fixtureControlsEnabled}
      single={single}
      batch={batch}
      tourExpandedCheckId={tourExpandedCheckId}
      tourNextDisabled={tourNextDisabled}
      onSelectMode={(next) => batch.onSelectMode(next, mode)}
      onSignOut={() =>
        applyMockAuthSignOutReset({
          setPendingVerifyTourAdvance,
          resetSingle: single.reset,
          resetBatch: batch.reset,
          resetHelp: help.reset,
          setMode,
          setView,
          setAuthPhase
        })
      }
      onTourNext={onTourNext}
      onTourAdvanceInteraction={onTourAdvanceInteraction}
      onTourFinish={onTourFinish}
      onTourShowMe={onTourShowMe}
    />
  );
}
