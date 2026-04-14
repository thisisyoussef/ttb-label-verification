import type { Mode, View } from './appTypes';

export type AuthPhase =
  | 'signed-out'
  | 'piv-loading'
  | 'piv-success'
  | 'sso-form'
  | 'sso-loading'
  | 'sso-success'
  | 'signed-in';

export interface AuthIdentity {
  name: string;
  division: string;
}

export const AUTH_IDENTITY: AuthIdentity = {
  name: 'Sarah Chen',
  division: 'ALFD'
};

export const AUTH_TIMINGS = {
  loadingMs: 1200,
  successMs: 700
} as const;

export const SESSION_TIMEOUTS = {
  inactivityMs: 15 * 60 * 1000,
  warningMs: 60 * 1000,
  tickMs: 1000
} as const;

export function advanceAuthPhase(phase: AuthPhase): AuthPhase {
  if (phase === 'piv-loading') return 'piv-success';
  if (phase === 'sso-loading') return 'sso-success';
  if (phase === 'piv-success' || phase === 'sso-success') return 'signed-in';
  return phase;
}

export function getAuthAutoAdvanceDelay(phase: AuthPhase): number | null {
  if (phase === 'piv-loading' || phase === 'sso-loading') {
    return AUTH_TIMINGS.loadingMs;
  }
  if (phase === 'piv-success' || phase === 'sso-success') {
    return AUTH_TIMINGS.successMs;
  }
  return null;
}

export function advanceSessionTimeoutCountdown(remainingMs: number): number {
  return Math.max(0, remainingMs - SESSION_TIMEOUTS.tickMs);
}

export function getSessionTimeoutSeconds(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export interface MockAuthSignOutResetActions {
  setPendingVerifyTourAdvance: (value: boolean) => void;
  resetSingle: () => void;
  resetBatch: () => void;
  resetHelp: () => void;
  setMode: (mode: Mode) => void;
  setView: (view: View) => void;
  setAuthPhase: (phase: AuthPhase) => void;
}

export function applyMockAuthSignOutReset({
  setPendingVerifyTourAdvance,
  resetSingle,
  resetBatch,
  resetHelp,
  setMode,
  setView,
  setAuthPhase
}: MockAuthSignOutResetActions): void {
  setPendingVerifyTourAdvance(false);
  resetSingle();
  resetBatch();
  resetHelp();
  setMode('single');
  setView('intake');
  setAuthPhase('signed-out');
}
