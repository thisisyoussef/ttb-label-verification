import { useEffect } from 'react';
import type { GuidedTourRect } from './guided-tour-position';
import type { HelpShowMe, TourStep } from './helpManifest';
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

  const segments = resolveDimLayerSegments(rect);

  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
      {segments.map((segment, index) => (
        <div
          key={index}
          className="absolute transition-all duration-200 motion-reduce:transition-none"
          style={{
            ...segment,
            background: 'rgba(45, 52, 51, 0.55)'
          }}
        />
      ))}
    </div>
  );
}

function resolveDimLayerSegments(rect: GuidedTourRect) {
  const top = Math.max(rect.top, 0);
  const left = Math.max(rect.left, 0);
  const width = Math.max(rect.width, 0);
  const height = Math.max(rect.height, 0);
  const rightEdge = Math.max(left + width, 0);
  const bottomEdge = Math.max(top + height, 0);

  return [
    { top: 0, left: 0, right: 0, height: top },
    { top, left: 0, width: left, height },
    { top, left: rightEdge, right: 0, height },
    { top: bottomEdge, left: 0, right: 0, bottom: 0 }
  ];
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
