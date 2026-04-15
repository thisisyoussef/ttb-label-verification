import { useCallback, useEffect, useState } from 'react';

export type ToolbenchTab = 'scenarios' | 'assets' | 'actions';

const STORAGE_KEY = 'toolbench-state';

interface PersistedState {
  open: boolean;
  tab: ToolbenchTab;
}

function readPersistedState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, tab: 'scenarios' };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      open: typeof parsed.open === 'boolean' ? parsed.open : false,
      tab:
        parsed.tab === 'scenarios' || parsed.tab === 'assets' || parsed.tab === 'actions'
          ? parsed.tab
          : 'scenarios',
    };
  } catch {
    return { open: false, tab: 'scenarios' };
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
