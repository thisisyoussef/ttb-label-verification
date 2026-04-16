import { useCallback, useEffect, useState } from 'react';

import {
  advanceSessionTimeoutCountdown,
  getSessionTimeoutSeconds,
  SESSION_TIMEOUTS,
  type AuthPhase
} from './authState';

export interface SessionTimeoutState {
  sessionTimeoutOpen: boolean;
  sessionTimeoutRemainingSeconds: number;
  hasExpired: boolean;
  resetSessionTimeout: () => void;
  resetToFull: () => void;
}

export function useSessionTimeout(authPhase: AuthPhase): SessionTimeoutState {
  const [sessionRemainingMs, setSessionRemainingMs] = useState<number>(
    SESSION_TIMEOUTS.inactivityMs
  );

  const resetSessionTimeout = useCallback(() => {
    setSessionRemainingMs(SESSION_TIMEOUTS.inactivityMs);
  }, []);

  const resetToFull = useCallback(() => {
    setSessionRemainingMs(SESSION_TIMEOUTS.inactivityMs);
  }, []);

  useEffect(() => {
    if (authPhase !== 'signed-in') {
      setSessionRemainingMs(SESSION_TIMEOUTS.inactivityMs);
      return;
    }

    const handle = window.setInterval(() => {
      setSessionRemainingMs((current) => advanceSessionTimeoutCountdown(current));
    }, SESSION_TIMEOUTS.tickMs);

    return () => window.clearInterval(handle);
  }, [authPhase]);

  useEffect(() => {
    if (authPhase !== 'signed-in') return;
    if (sessionRemainingMs <= SESSION_TIMEOUTS.warningMs) return;

    const onActivity = () => {
      setSessionRemainingMs(SESSION_TIMEOUTS.inactivityMs);
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'scroll',
      'focus'
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [authPhase, sessionRemainingMs]);

  return {
    sessionTimeoutOpen:
      authPhase === 'signed-in' && sessionRemainingMs <= SESSION_TIMEOUTS.warningMs,
    sessionTimeoutRemainingSeconds: getSessionTimeoutSeconds(sessionRemainingMs),
    hasExpired: authPhase === 'signed-in' && sessionRemainingMs <= 0,
    resetSessionTimeout,
    resetToFull
  };
}
