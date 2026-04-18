import { useEffect } from 'react';
import type { GuidedTourRect } from './guided-tour-position';
import type { HelpShowMe, TourStep } from '../helpManifest';
import { findTourTarget } from './tourTargets';
import { GuidedTourCallout } from './GuidedTourCallout';
import { useGuidedTourSpotlightTarget } from './useGuidedTourSpotlightTarget';

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
  onShowMeAndContinue: (action: HelpShowMe) => void;
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
  onShowMe,
  onShowMeAndContinue
}: GuidedTourSpotlightProps) {
  const step = steps[Math.min(Math.max(currentIndex, 0), steps.length - 1)];
  const { rect, highlightVisible } = useGuidedTourSpotlightTarget(
    step?.target,
    currentIndex
  );

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

  return (
    <div className="fixed inset-0 z-[45] pointer-events-none">
      <DimLayer rect={rect} />
      {rect ? <HighlightRing rect={rect} visible={highlightVisible} /> : null}
      <GuidedTourCallout
        step={step}
        rect={rect}
        currentIndex={currentIndex}
        stepsLength={steps.length}
        nextDisabled={nextDisabled}
        onClose={onClose}
        onPrevious={onPrevious}
        onNext={onNext}
        onFinish={onFinish}
        onShowMe={onShowMe}
        onShowMeAndContinue={onShowMeAndContinue}
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

function HighlightRing({
  rect,
  visible
}: {
  rect: GuidedTourRect;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={[
        'absolute rounded-lg border-2 border-primary shadow-[0_0_0_4px_rgba(84,96,103,0.35)] pointer-events-none transition-all duration-200 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0'
      ].join(' ')}
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }}
    />
  );
}
