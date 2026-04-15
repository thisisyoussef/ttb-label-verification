import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { findTourTarget } from './tourTargets';
import type { TourStep } from './helpManifest';
import type { GuidedTourRect } from './guided-tour-position';

const TARGET_PADDING = 8;
const VIEWPORT_PADDING = 16;
const HIGHLIGHT_SETTLE_DELAY_MS = 140;

function readTargetRect(element: HTMLElement): GuidedTourRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - TARGET_PADDING,
    left: rect.left - TARGET_PADDING,
    width: rect.width + TARGET_PADDING * 2,
    height: rect.height + TARGET_PADDING * 2
  };
}

function isTargetVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return (
    rect.top >= VIEWPORT_PADDING &&
    rect.left >= VIEWPORT_PADDING &&
    rect.bottom <= viewportHeight - VIEWPORT_PADDING &&
    rect.right <= viewportWidth - VIEWPORT_PADDING
  );
}

export function useGuidedTourSpotlightTarget(
  stepTarget: TourStep['target'] | undefined,
  currentIndex: number
) {
  const [rect, setRect] = useState<GuidedTourRect | null>(null);
  const [highlightVisible, setHighlightVisible] = useState(false);
  const scrolledTargetRef = useRef<TourStep['target'] | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!stepTarget) {
      scrolledTargetRef.current = null;
      setRect(null);
      return;
    }

    if (scrolledTargetRef.current !== stepTarget) {
      scrolledTargetRef.current = null;
    }

    const update = () => {
      const element = findTourTarget(stepTarget);
      if (!element) {
        setRect(null);
        return;
      }

      if (!isTargetVisible(element) && scrolledTargetRef.current !== stepTarget) {
        scrolledTargetRef.current = stepTarget;
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }

      setRect(readTargetRect(element));
    };

    update();
    const raf = window.requestAnimationFrame(update);
    const interval = window.setInterval(update, 250);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [currentIndex, stepTarget]);

  useEffect(() => {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }

    if (!rect) {
      setHighlightVisible(false);
      return;
    }

    setHighlightVisible(false);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightVisible(true);
      highlightTimerRef.current = null;
    }, HIGHLIGHT_SETTLE_DELAY_MS);

    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [currentIndex, rect]);

  return {
    rect,
    highlightVisible
  };
}
