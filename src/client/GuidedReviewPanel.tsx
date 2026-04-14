import { useEffect, useRef } from 'react';
import type { TourStep, HelpShowMe } from './helpManifest';

interface GuidedReviewPanelProps {
  steps: TourStep[];
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onShowMe: (action: HelpShowMe) => void;
}

export function GuidedReviewPanel({
  steps,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
  onFinish,
  onShowMe
}: GuidedReviewPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastFocusedRef.current?.focus();
    };
  }, [onClose]);

  if (steps.length === 0) return null;
  const step = steps[Math.min(Math.max(currentIndex, 0), steps.length - 1)]!;
  const isLast = currentIndex >= steps.length - 1;
  const isFirst = currentIndex <= 0;
  const progress = Math.round((step.stepIndex / step.totalSteps) * 100);

  return (
    <aside
      ref={panelRef}
      role="complementary"
      aria-label="Guided review"
      className="fixed top-0 right-0 h-screen w-full md:w-[380px] bg-surface-container-lowest border-l border-outline-variant/20 shadow-[0_0_48px_rgba(45,52,51,0.18)] z-40 flex flex-col"
    >
      <header className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-outline-variant/15">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-headline text-base font-bold text-on-surface focus:outline-none"
        >
          Guided review
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guided review"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            close
          </span>
        </button>
      </header>

      <div className="px-5 pt-4 pb-3 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Step {step.stepIndex} of {step.totalSteps}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 bg-surface-container-high rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <section className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        <h3 className="font-headline text-xl font-extrabold text-on-surface leading-snug">
          {step.title}
        </h3>
        <p className="font-body text-sm text-on-surface-variant leading-relaxed">
          {step.body}
        </p>
        {step.showMe ? (
          <button
            type="button"
            onClick={() => step.showMe && onShowMe(step.showMe)}
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest bg-surface-container-lowest text-on-surface border border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              visibility
            </span>
            {step.showMe.label}
          </button>
        ) : null}
      </section>

      <footer className="px-5 py-4 border-t border-outline-variant/15 bg-surface-container-low flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isFirst}
          className={[
            'inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest transition-colors border',
            isFirst
              ? 'text-outline-variant/70 border-outline-variant/15 cursor-not-allowed'
              : 'text-on-surface border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-high'
          ].join(' ')}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
            chevron_left
          </span>
          Previous
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onFinish}
            className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Finish
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              check
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Next
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              chevron_right
            </span>
          </button>
        )}
      </footer>
    </aside>
  );
}
