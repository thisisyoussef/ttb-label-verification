import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  resolveCalloutPosition,
  type GuidedTourRect
} from './guided-tour-position';
import type { HelpShowMe, TourStep } from './helpManifest';
import { findTourTarget } from './tourTargets';

interface GuidedTourSpotlightProps {
  steps: TourStep[];
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  onAdvanceInteraction: () => void;
  onFinish: () => void;
  onShowMe: (action: HelpShowMe) => void;
}

const TARGET_PADDING = 8;

function readTargetRect(element: HTMLElement): GuidedTourRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - TARGET_PADDING,
    left: rect.left - TARGET_PADDING,
    width: rect.width + TARGET_PADDING * 2,
    height: rect.height + TARGET_PADDING * 2
  };
}

export function GuidedTourSpotlight({
  steps,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
  nextDisabled,
  onAdvanceInteraction,
  onFinish,
  onShowMe
}: GuidedTourSpotlightProps) {
  const step = steps[Math.min(Math.max(currentIndex, 0), steps.length - 1)];
  const [rect, setRect] = useState<GuidedTourRect | null>(null);

  useLayoutEffect(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const update = () => {
      const element = findTourTarget(step.target!);
      if (!element) {
        setRect(null);
        return;
      }
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
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
  }, [step?.target, currentIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!step || step.interaction !== 'click-to-advance' || !step.target) return;
    const onClick = (event: MouseEvent) => {
      const element = findTourTarget(step.target!);
      if (!element) return;
      const target = event.target as Node;
      if (element === target || element.contains(target)) {
        onAdvanceInteraction();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [onAdvanceInteraction, step]);

  if (!step) return null;

  const isLast = currentIndex >= steps.length - 1;
  const isFirst = currentIndex <= 0;
  const progress = Math.round((step.stepIndex / step.totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-[45] pointer-events-none">
      <DimLayer rect={rect} />
      {rect ? <HighlightRing rect={rect} /> : null}
      <Callout
        step={step}
        rect={rect}
        progress={progress}
        isFirst={isFirst}
        isLast={isLast}
        nextDisabled={nextDisabled}
        onClose={onClose}
        onPrevious={onPrevious}
        onNext={onNext}
        onFinish={onFinish}
        onShowMe={onShowMe}
      />
    </div>
  );
}

function DimLayer({ rect }: { rect: GuidedTourRect | null }) {
  if (!rect) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-on-surface/55 transition-opacity duration-200 motion-reduce:transition-none"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'rgba(45, 52, 51, 0.55)',
        clipPath: `polygon(
          0% 0%,
          0% 100%,
          ${rect.left}px 100%,
          ${rect.left}px ${rect.top}px,
          ${rect.left + rect.width}px ${rect.top}px,
          ${rect.left + rect.width}px ${rect.top + rect.height}px,
          ${rect.left}px ${rect.top + rect.height}px,
          ${rect.left}px 100%,
          100% 100%,
          100% 0%
        )`
      }}
    />
  );
}

function HighlightRing({ rect }: { rect: GuidedTourRect }) {
  return (
    <div
      aria-hidden="true"
      className="absolute rounded-lg border-2 border-primary shadow-[0_0_0_4px_rgba(84,96,103,0.35)] pointer-events-none transition-all duration-200 motion-reduce:transition-none"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }}
    />
  );
}

interface CalloutProps {
  step: TourStep;
  rect: GuidedTourRect | null;
  progress: number;
  isFirst: boolean;
  isLast: boolean;
  nextDisabled: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onShowMe: (action: HelpShowMe) => void;
}

function Callout({
  step,
  rect,
  progress,
  isFirst,
  isLast,
  nextDisabled,
  onClose,
  onPrevious,
  onNext,
  onFinish,
  onShowMe
}: CalloutProps) {
  const calloutRef = useRef<HTMLDivElement | null>(null);
  const [calloutHeight, setCalloutHeight] = useState(320);
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  useLayoutEffect(() => {
    const node = calloutRef.current;
    if (!node) return;

    const update = () => {
      setCalloutHeight(node.getBoundingClientRect().height);
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [rect, step.body, step.cta, step.showMe?.label, step.stepIndex, step.title]);

  const position = computeCalloutPosition(rect, calloutHeight);

  return (
    <div
      ref={calloutRef}
      role="dialog"
        aria-modal="false"
        aria-labelledby="tour-step-title"
        className="absolute pointer-events-auto w-[min(420px,92vw)] max-h-[calc(100vh-32px)] overflow-y-auto bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-[0_20px_48px_rgba(45,52,51,0.24)] flex flex-col"
        style={{
          ...position,
          maxHeight: viewportHeight - 32
        }}
      >
        <header className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-outline-variant/15">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Step {step.stepIndex} of {step.totalSteps}
            </span>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 w-24 bg-surface-container-high rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guided tour"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              close
            </span>
          </button>
        </header>

        <div className="px-5 py-4 flex flex-col gap-3">
          <h3
            id="tour-step-title"
            className="font-headline text-lg font-extrabold text-on-surface leading-snug"
          >
            {step.title}
          </h3>
          <p className="font-body text-sm text-on-surface-variant leading-relaxed">
            {step.body}
          </p>
          {step.target && !rect ? (
            <p className="text-xs font-label text-on-surface-variant">
              {nextDisabled
                ? 'This control is not visible from the current app state or viewport. Complete the required action on the live surface or use the recovery action below to continue.'
                : 'This control is not visible from the current app state or viewport. Use the recovery action below or continue to the next step.'}
            </p>
          ) : null}
          {step.cta ? (
            <p className="inline-flex items-center gap-2 text-xs font-label font-bold uppercase tracking-widest text-primary">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[16px] animate-pulse motion-reduce:animate-none"
              >
                touch_app
              </span>
              {step.cta}
            </p>
          ) : null}
          {step.showMe ? (
            <button
              type="button"
              onClick={() => step.showMe && onShowMe(step.showMe)}
              className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-label font-bold uppercase tracking-widest bg-surface-container-lowest text-on-surface border border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                visibility
              </span>
              {step.showMe.label}
            </button>
          ) : null}
        </div>

        <footer className="px-5 py-3 border-t border-outline-variant/15 bg-surface-container-low flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={isFirst}
            className={[
              'inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-label font-bold uppercase tracking-widest transition-colors border',
              isFirst
                ? 'text-outline-variant/70 border-outline-variant/15 cursor-not-allowed'
                : 'text-on-surface border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-high'
            ].join(' ')}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
              chevron_left
            </span>
            Previous
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onFinish}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-[11px] font-label font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Finish
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                check
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className={[
                'inline-flex items-center gap-1 px-5 py-2 rounded-lg text-[11px] font-label font-bold uppercase tracking-widest transition-all',
                nextDisabled
                  ? 'bg-surface-container-high text-outline-variant/80 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]'
              ].join(' ')}
            >
              Next
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                chevron_right
              </span>
            </button>
          )}
      </footer>
    </div>
  );
}

function computeCalloutPosition(
  rect: GuidedTourRect | null,
  calloutHeight: number
): CSSProperties {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  return resolveCalloutPosition(rect, {
    calloutHeight,
    viewportWidth,
    viewportHeight
  });
}
