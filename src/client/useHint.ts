import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ttb-hints-dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // sessionStorage unavailable — hints just won't persist
  }
}

export function useHint(
  id: string,
  dismissOn: boolean
): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(() => !getDismissed().has(id));

  const dismiss = useCallback(() => {
    setVisible(false);
    const dismissed = getDismissed();
    dismissed.add(id);
    persistDismissed(dismissed);
  }, [id]);

  useEffect(() => {
    if (dismissOn && visible) {
      dismiss();
    }
  }, [dismissOn, visible, dismiss]);

  return { visible, dismiss };
}
