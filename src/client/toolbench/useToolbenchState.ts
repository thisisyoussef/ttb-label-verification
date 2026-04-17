import { useCallback, useEffect, useState } from 'react';

// "samples" is the new primary tab: one-click load of a real COLA Cloud
// label + matching application fields. Replaces the old "scenarios" tab
// which was a curated synthetic set — less useful than running the real
// eval corpus directly from the UI.
export type ToolbenchTab = 'samples' | 'assets' | 'actions';

const STORAGE_KEY = 'toolbench-state';

interface PersistedState {
  open: boolean;
  tab: ToolbenchTab;
}

function readPersistedState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    // Default to open so assessors see the COLA sample loader on first
    // visit. Session storage persists the user's preference from there.
    if (!raw) return { open: true, tab: 'samples' };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      open: typeof parsed.open === 'boolean' ? parsed.open : true,
      tab:
        parsed.tab === 'samples' || parsed.tab === 'assets' || parsed.tab === 'actions'
          ? parsed.tab
          : 'samples',
    };
  } catch {
    return { open: true, tab: 'samples' };
  }
}

export function useToolbenchState() {
  const [open, setOpen] = useState(() => readPersistedState().open);
  const [tab, setTab] = useState<ToolbenchTab>(() => readPersistedState().tab);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ open, tab }));
  }, [open, tab]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  return { open, tab, setTab, toggle, close };
}
