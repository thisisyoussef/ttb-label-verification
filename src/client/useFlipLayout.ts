import { useCallback, useLayoutEffect, useRef } from 'react';

interface FlipOptions {
  durationMs?: number;
  // Ignore movements smaller than this to avoid jitter on sub-pixel
  // layout shifts (fonts finishing load, scrollbar widths, etc.)
  thresholdPx?: number;
}

// FLIP (First, Last, Invert, Play) animation hook. Caller registers
// elements with the returned `register` callback keyed by a stable id.
// On every render, this hook measures the new positions, compares to
// the previous render's positions, and for each moved element:
//   1. Sets an inverse translate so the element looks unchanged
//   2. Next frame, clears the transform with a transition so it
//      animates into its real new position.
// Respects prefers-reduced-motion by skipping animation and just
// refreshing the measurement cache.
export function useFlipLayout(options: FlipOptions = {}) {
  const { durationMs = 340, thresholdPx = 0.5 } = options;
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  // Per-id ref callback cache. Without this, `register(id)` would return
  // a new function identity every render, causing React to call the old
  // callback with null (detach) and the new one with the node (attach)
  // on every render — thrashing the elements map and breaking FLIP.
  const refCallbacksRef = useRef(new Map<string, (node: HTMLElement | null) => void>());

  const register = useCallback((id: string) => {
    const cache = refCallbacksRef.current;
    let cb = cache.get(id);
    if (!cb) {
      cb = (node: HTMLElement | null) => {
        const map = elementsRef.current;
        if (node) map.set(id, node);
        else map.delete(id);
      };
      cache.set(id, cb);
    }
    return cb;
  }, []);

  useLayoutEffect(() => {
    const elements = elementsRef.current;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const currentRects = new Map<string, DOMRect>();
    elements.forEach((el, id) => {
      currentRects.set(id, el.getBoundingClientRect());
    });

    if (reduced) {
      prevRectsRef.current = currentRects;
      return;
    }

    const prev = prevRectsRef.current;
    currentRects.forEach((currentRect, id) => {
      const prevRect = prev.get(id);
      if (!prevRect) return;
      const dy = prevRect.top - currentRect.top;
      const dx = prevRect.left - currentRect.left;
      if (Math.abs(dy) < thresholdPx && Math.abs(dx) < thresholdPx) return;
      const el = elements.get(id);
      if (!el) return;
      // Invert: place the element back at its old position visually
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.willChange = 'transform';
      // Play: next frame, release the transform under a transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!el.isConnected) return;
          el.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          el.style.transform = '';
          const cleanup = () => {
            el.style.transition = '';
            el.style.willChange = '';
            el.removeEventListener('transitionend', cleanup);
          };
          el.addEventListener('transitionend', cleanup);
        });
      });
    });

    prevRectsRef.current = currentRects;
  });

  return register;
}
