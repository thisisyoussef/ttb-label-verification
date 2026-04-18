import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTourSteps } from '../helpManifest';
import { loadRemoteHelpManifest } from '../help-runtime';
import { loadHelpReplayState, saveHelpReplayState } from '../helpReplayState';

export interface HelpTourFlow {
  tourOpen: boolean;
  tourStepIndex: number;
  helpNudgeDismissed: boolean;
  tourCompleted: boolean;
  tourSteps: ReturnType<typeof getTourSteps>;
  onLaunchTour: () => void;
  onCloseTour: () => void;
  onDismissNudge: () => void;
  onPreviousTourStep: () => void;
  onNextTourStep: () => void;
  onFinishTour: () => void;
  reset: () => void;
}

export function useHelpTourState(): HelpTourFlow {
  const initialReplay = useMemo(() => loadHelpReplayState(), []);
  const [helpManifestRevision, setHelpManifestRevision] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [helpNudgeDismissed, setHelpNudgeDismissed] = useState<boolean>(
    initialReplay.firstRunNudgeDismissed || initialReplay.tourCompleted
  );
  const [tourCompleted, setTourCompleted] = useState<boolean>(
    initialReplay.tourCompleted
  );
  const tourSteps = useMemo(() => getTourSteps(), [helpManifestRevision]);

  useEffect(() => {
    let ignore = false;

    void loadRemoteHelpManifest().then(() => {
      if (!ignore) {
        setHelpManifestRevision((current) => current + 1);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const persistReplay = useCallback(
    (nudgeDismissed: boolean, completed: boolean) => {
      saveHelpReplayState({
        version: 2,
        firstRunNudgeDismissed: nudgeDismissed,
        tourCompleted: completed
      });
    },
    []
  );

  return {
    tourOpen,
    tourStepIndex,
    helpNudgeDismissed,
    tourCompleted,
    tourSteps,
    onLaunchTour: () => {
      // Treat the header button as a toggle. Three cases:
      //   1. Tour is already open → close (bug fix: previously this
      //      re-opened at step 0, wiping mid-tour progress).
      //   2. Tour was completed before → restart from step 0.
      //   3. Tour was never started or was closed mid-tour → open at
      //      whatever step the user last left off on (0 for first-timers).
      if (tourOpen) {
        setTourOpen(false);
        return;
      }
      if (tourCompleted) {
        setTourStepIndex(0);
      }
      setTourOpen(true);
      setHelpNudgeDismissed(true);
      persistReplay(true, tourCompleted);
    },
    onCloseTour: () => setTourOpen(false),
    onDismissNudge: () => {
      setHelpNudgeDismissed(true);
      persistReplay(true, tourCompleted);
    },
    onPreviousTourStep: () => {
      setTourStepIndex((previous) => Math.max(0, previous - 1));
    },
    onNextTourStep: () => {
      setTourStepIndex((previous) => Math.min(tourSteps.length - 1, previous + 1));
    },
    onFinishTour: () => {
      setTourCompleted(true);
      persistReplay(true, true);
      setTourOpen(false);
    },
    reset: () => {
      setTourOpen(false);
      setTourStepIndex(0);
    }
  };
}
