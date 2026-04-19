import { useEffect, useState } from 'react';

// Material Symbols ships as a web font whose ligatures show the raw
// codepoint name (e.g. `badge`, `key`) until the font loads. Gating
// first paint on `document.fonts.ready` hides that flash; the max-wait
// cap keeps a stalled font request from blocking the UI forever.
const DEFAULT_MAX_WAIT_MS = 1500;

function initialReady(): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  return document.fonts.status === 'loaded';
}

export function useFontsReady(maxWaitMs: number = DEFAULT_MAX_WAIT_MS): boolean {
  const [ready, setReady] = useState<boolean>(initialReady);

  useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;

    const timeoutHandle = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, maxWaitMs);

    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutHandle);
    };
  }, [ready, maxWaitMs]);

  return ready;
}
