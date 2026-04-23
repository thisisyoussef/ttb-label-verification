import { useCallback, useEffect, useState } from 'react';

// "samples" is the new primary tab: one-click load of a real COLA Cloud
// label + matching application fields. Replaces the old "scenarios" tab
// which was a curated synthetic set — less useful than running the real
// eval corpus directly from the UI.
export type ToolbenchTab = 'samples' | 'actions';

const STORAGE_KEY = 'toolbench-state';
// Lifetime flag (not per-tab): once a user has ever opened the toolbench,
// stop nudging them with the FAB glow on future sessions. Kept separate
// from STORAGE_KEY because open/tab are per-tab preferences.
const SEEN_STORAGE_KEY = 'toolbench-seen';

interface PersistedState {
  open: boolean;
  tab: ToolbenchTab;
}

export function resolvePersistedToolbenchTab(raw: unknown): ToolbenchTab {
  return raw === 'actions' ? 'actions' : 'samples';
}

function readPersistedState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    // Default to closed; the FAB glow nudges first-time users to open it
    // so they still discover the COLA sample loader.
    if (!raw) return { open: false, tab: 'samples' };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      open: typeof parsed.open === 'boolean' ? parsed.open : false,
      tab: resolvePersistedToolbenchTab(parsed.tab),
    };
  } catch {
    return { open: false, tab: 'samples' };
  }
}

function readHasOpenedOnce(): boolean {
  try {
    return localStorage.getItem(SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useToolbenchState() {
  const [open, setOpen] = useState(() => readPersistedState().open);
  const [tab, setTab] = useState<ToolbenchTab>(() => readPersistedState().tab);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(readHasOpenedOnce);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ open, tab }));
  }, [open, tab]);

  const markSeen = useCallback(() => {
    setHasOpenedOnce((prev) => {
      if (prev) return prev;
      try {
        localStorage.setItem(SEEN_STORAGE_KEY, '1');
      } catch {
        // localStorage can throw in private mode; still flip in-memory so
        // the glow stops for the current session.
      }
      return true;
    });
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) markSeen();
      return next;
    });
  }, [markSeen]);
  const close = useCallback(() => setOpen(false), []);

  return { open, tab, setTab, toggle, close, hasOpenedOnce };
}
