import { useEffect, useState } from 'react';
import type { BeverageType } from '../shared/contracts/review';
import type { ExtractionMode } from './appTypes';
import {
  ProgressStrip,
  SkeletonFieldRow,
  StepRow,
  WarningSkeletonRow
} from './ProcessingViews';
import type { BeverageSelection, LabelImage, ProcessingPhase, ProcessingStep } from './types';
import { classifyCause } from './reviewFailureMessage';
import type { OcrPreviewFields } from './useOcrPreview';
import { useReducedMotion } from './useReducedMotion';

const LATE_STAGE_DELAY_MS = 4000;
const LATE_STAGE_LABEL = 'Almost done \u2014 finishing the report\u2026';

const BEVERAGE_LABELS: Record<BeverageSelection, string> = {
  auto: 'Auto-detect',
  'distilled-spirits': 'Distilled Spirits',
  'malt-beverage': 'Malt Beverage',
  wine: 'Wine',
  unknown: 'Unknown'
};

interface ProcessingProps {
  image: LabelImage;
  beverage: BeverageSelection;
  extractionMode: ExtractionMode;
  steps: ProcessingStep[];
  phase: ProcessingPhase;
  failureMessage: string;
  localUnavailable: boolean;
  /**
   * OCR-only preview landed by the parallel /api/review/stream?only=ocr
   * call. Populates ~500ms in and animates the skeleton rows with
   * provisional values while the canonical review is still running.
   * Individual fields may still be undefined when OCR couldn't read
   * them (we keep those rows on skeleton until report lands).
   */
  ocrPreview?: OcrPreviewFields | null;
  onCancel: () => void;
  onRetry: () => void;
  onBackToIntake: () => void;
  onSwitchToCloud: () => void;
}

/**
 * The fields that the Processing screen renders as skeleton rows while
 * the pipeline runs. Ordered to match Results row order so the flip at
 * report-ready is a value-swap, not a reshuffle.
 */
const SKELETON_ROWS: Array<{
  id: 'brandName' | 'classType' | 'alcoholContent' | 'netContents' | 'countryOfOrigin';
  label: string;
  previewKey?: keyof OcrPreviewFields;
}> = [
  { id: 'brandName', label: 'Brand name' },
  { id: 'classType', label: 'Class / Type', previewKey: 'classType' },
  { id: 'alcoholContent', label: 'Alcohol content', previewKey: 'alcoholContent' },
  { id: 'netContents', label: 'Net contents', previewKey: 'netContents' },
  { id: 'countryOfOrigin', label: 'Country of origin', previewKey: 'countryOfOrigin' }
];

export function Processing({
  image,
  beverage,
  extractionMode,
  steps,
  phase,
  failureMessage,
  localUnavailable,
  ocrPreview,
  onCancel,
  onRetry,
  onBackToIntake,
  onSwitchToCloud
}: ProcessingProps) {
  const lastStep = steps[steps.length - 1];
  const lastStepActive = lastStep?.status === 'active';

  // When the user picked "Auto-detect", swap the badge to the
  // server-inferred beverage as soon as the OCR preview frame lands.
  // 'unknown' is filtered out server-side — the OCR frame only carries
  // a concrete type — so any value here is an upgrade over "Auto-detect".
  const resolvedDetectedBeverage: BeverageType | undefined =
    ocrPreview?.detectedBeverage;
  const displayBeverage: BeverageSelection =
    beverage === 'auto' && resolvedDetectedBeverage
      ? resolvedDetectedBeverage
      : beverage;

  const reducedMotion = useReducedMotion();

  const [lateStageLabel, setLateStageLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!lastStepActive || phase !== 'running') {
      setLateStageLabel(null);
      return;
    }
    const timer = window.setTimeout(
      () => setLateStageLabel(LATE_STAGE_LABEL),
      LATE_STAGE_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [lastStepActive, phase]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'running') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, onCancel]);

  // Show every step up front — "Reading label image 1 of 5" through
  // "Preparing evidence 5 of 5" — so the reviewer sees the full ladder
  // from the moment the page opens, not a surprise reveal as each step
  // activates. Pending rows render muted (see StepRow's opacity-50 for
  // pending status); the active row is highlighted; the done rows keep
  // their check mark. Late-stage relabeling still applies to the final
  // active step.
  const visibleSteps = steps.map((step, index, arr) =>
    index === arr.length - 1 && step.status === 'active' && lateStageLabel
      ? { ...step, label: lateStageLabel }
      : step
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 h-[calc(100dvh-var(--header-h))]">
      <aside className="md:col-span-4 lg:col-span-3 bg-surface-container-low p-4 lg:p-6 xl:p-8 flex flex-col gap-4 xl:gap-6 border-r border-outline-variant/15 overflow-y-auto">
        <h2 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          Label details
        </h2>

        {/* Image treatment mirrors ResultsPinnedColumn: max-height + object-contain
            preserves the label's native aspect ratio (wide keg labels, tall bottle
            labels, square cans all render correctly) instead of cropping to a 3:4
            box. Keeps the image identical between "reviewing" and "results" screens. */}
        {image.file.type === 'application/pdf' ? (
          <div className="min-h-[200px] max-h-[55vh] bg-surface-container-highest rounded-lg flex items-center justify-center">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-5xl text-on-surface-variant"
            >
              picture_as_pdf
            </span>
          </div>
        ) : (
          <img
            alt="Submitted label thumbnail"
            src={image.previewUrl}
            className="w-full max-h-[55vh] object-contain rounded-lg bg-surface-container-highest"
          />
        )}

        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
              Filename
            </dt>
            <dd className="font-mono text-sm font-semibold text-on-surface break-all">
              {image.file.name}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
              Beverage type
            </dt>
            <dd>
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label text-sm font-bold">
                {BEVERAGE_LABELS[displayBeverage]}
                {beverage === 'auto' && resolvedDetectedBeverage ? (
                  <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-secondary-container/70">
                    detected
                  </span>
                ) : null}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
              Processing mode
            </dt>
            <dd className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[16px] text-on-surface-variant"
                aria-hidden="true"
              >
                {extractionMode === 'cloud' ? 'cloud' : 'hard_drive'}
              </span>
              <span className="font-body text-sm font-semibold text-on-surface">
                {extractionMode === 'cloud' ? 'Cloud' : 'Local'}
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-auto pt-6 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel review"
            className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-lg text-xs font-label font-bold uppercase tracking-widest bg-surface-container-lowest text-error border border-error/30 shadow-ambient hover:bg-error hover:text-on-error hover:border-transparent active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
            Cancel review
          </button>
        </div>
      </aside>

      <section className="md:col-span-8 lg:col-span-9 bg-background px-6 md:px-8 xl:px-16 py-6 xl:py-12 flex flex-col gap-6 xl:gap-8 overflow-y-auto">
        <header
          className="flex flex-col gap-4"
          data-tour-target="tour-processing-status"
        >
          <div>
            <h1 className="font-headline text-2xl xl:text-4xl font-extrabold text-on-surface tracking-tight">
              Reviewing this label
            </h1>
            <p className="mt-2 text-on-surface-variant font-body">
              Reading the label, checking every required field, preparing your
              report.
            </p>
          </div>

          {phase === 'running' ? (
            <ProgressStrip
              steps={visibleSteps}
              reducedMotion={reducedMotion}
            />
          ) : null}
        </header>

        {phase === 'running' ? (
          <div className="flex flex-col gap-3 max-w-3xl" aria-live="polite">
            <h2 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Fields detected
            </h2>
            <ol role="list" className="flex flex-col gap-2">
              {SKELETON_ROWS.map((row) => {
                const previewValue = row.previewKey
                  ? ocrPreview?.[row.previewKey]
                  : undefined;
                const value =
                  typeof previewValue === 'string' ? previewValue : undefined;
                return (
                  <li key={row.id}>
                    <SkeletonFieldRow
                      label={row.label}
                      value={value}
                      reducedMotion={reducedMotion}
                    />
                  </li>
                );
              })}
              <li>
                <WarningSkeletonRow
                  detected={ocrPreview?.governmentWarningPresent}
                  reducedMotion={reducedMotion}
                />
              </li>
            </ol>
          </div>
        ) : (
          <ol role="list" aria-live="polite" className="flex flex-col gap-1 max-w-3xl">
            {visibleSteps.map((step, index) => (
              <li key={step.id}>
                <StepRow step={step} index={index + 1} reducedMotion={reducedMotion} />
              </li>
            ))}
          </ol>
        )}

        {localUnavailable ? (
          <div
            role="alert"
            className="max-w-3xl bg-surface-container-low border-l-4 border-caution rounded-lg p-6 md:p-8 flex flex-col gap-4 shadow-ambient"
          >
            <div className="flex items-start gap-3">
              <span
                className="material-symbols-outlined text-2xl text-caution mt-0.5"
                aria-hidden="true"
              >
                cloud_off
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="font-headline text-xl font-extrabold text-on-surface">
                  Local mode is not available
                </h2>
                <p className="text-on-surface-variant font-body leading-relaxed max-w-lg">
                  Local mode is not available on this workstation. Switch to Cloud mode to
                  continue.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onSwitchToCloud}
                className="bg-gradient-to-b from-primary to-primary-dim text-on-primary font-semibold py-2.5 px-6 rounded-lg shadow-ambient hover:brightness-110 transition-all"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    cloud
                  </span>
                  Switch to Cloud
                </span>
              </button>
              <button
                type="button"
                onClick={onBackToIntake}
                className="bg-surface-container-high text-on-surface font-semibold py-2.5 px-6 rounded-lg hover:bg-surface-container-highest transition-all"
              >
                Back to intake
              </button>
            </div>
          </div>
        ) : phase === 'failed' ? (
          <div
            role="alert"
            className="max-w-3xl bg-surface-container-low border-l-4 border-error rounded-lg p-6 md:p-8 flex flex-col gap-4 shadow-ambient"
          >
            <h2 className="font-headline text-2xl font-extrabold text-on-surface">
              We couldn't finish this review.
            </h2>
            <p className="text-sm font-label font-semibold text-error/80 mt-1">
              {classifyCause(failureMessage)}
            </p>
            <p className="text-on-surface-variant font-body leading-relaxed max-w-lg">
              {failureMessage}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onRetry}
                className="bg-gradient-to-b from-primary to-primary-dim text-on-primary font-semibold py-2.5 px-6 rounded-lg shadow-ambient hover:brightness-110 transition-all"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onBackToIntake}
                className="bg-surface-container-high text-on-surface font-semibold py-2.5 px-6 rounded-lg hover:bg-surface-container-highest transition-all"
              >
                Back to intake
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

