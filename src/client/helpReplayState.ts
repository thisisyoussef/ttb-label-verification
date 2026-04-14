const STORAGE_KEY = 'ttb-help:replay-state';
const CURRENT_VERSION = 1;

export interface HelpReplayState {
  version: number;
  firstRunNudgeDismissed: boolean;
  tourCompleted: boolean;
}

const DEFAULT_STATE: HelpReplayState = {
  version: CURRENT_VERSION,
  firstRunNudgeDismissed: false,
  tourCompleted: false
};

function safeParse(raw: string | null): HelpReplayState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HelpReplayState>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (parsed.version !== CURRENT_VERSION) return null;
    return {
      version: CURRENT_VERSION,
      firstRunNudgeDismissed: Boolean(parsed.firstRunNudgeDismissed),
      tourCompleted: Boolean(parsed.tourCompleted)
    };
  } catch {
    return null;
  }
}

export function loadHelpReplayState(): HelpReplayState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveHelpReplayState(state: HelpReplayState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private browsing, quota); replay state is a nicety, not a contract.
  }
}
