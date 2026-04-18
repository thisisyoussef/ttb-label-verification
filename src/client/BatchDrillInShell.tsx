import { useMemo } from 'react';
import { Results } from './Results';
import {
  buildReportForScenario
} from './resultScenarios';
import { buildLabelThumbnail } from './labelThumbnail';
import type {
  BatchDashboardFilter,
  BatchDashboardRow
} from './batchTypes';
import type {
  BeverageSelection,
  LabelImage,
  UIVerificationReport
} from './types';

interface BatchDrillInShellProps {
  row: BatchDashboardRow;
  report?: UIVerificationReport | null;
  indexInView: number;
  totalInView: number;
  filter: BatchDashboardFilter;
  hasPrevious: boolean;
  hasNext: boolean;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onExportResults: () => void;
}

const FILTER_POSITION_LABEL: Record<BatchDashboardFilter, string> = {
  all: 'labels',
  reject: 'rejects',
  review: 'reviews',
  approve: 'approves'
};

export function BatchDrillInShell(props: BatchDrillInShellProps) {
  const {
    row,
    report: liveReport,
    indexInView,
    totalInView,
    filter,
    hasPrevious,
    hasNext
  } = props;

  const image = useMemo<LabelImage>(() => buildDrillInImage(row), [row]);
  const secondaryImage = useMemo<LabelImage | null>(
    () => buildDrillInSecondaryImage(row),
    [row]
  );
  const beverage = row.beverageType as BeverageSelection;

  if (!row.reportId) {
    return (
      <DrillInFrame
        indexInView={indexInView}
        totalInView={totalInView}
        filter={filter}
        onBack={props.onBack}
      >
        <UnavailablePanel onBack={props.onBack} />
      </DrillInFrame>
    );
  }

  const report =
    liveReport ?? (row.scenarioId ? buildReportForScenario(row.scenarioId) : null);
  if (!report) {
    return (
      <DrillInFrame
        indexInView={indexInView}
        totalInView={totalInView}
        filter={filter}
        onBack={props.onBack}
      >
        <UnavailablePanel onBack={props.onBack} />
      </DrillInFrame>
    );
  }

  return (
    <DrillInFrame
      indexInView={indexInView}
      totalInView={totalInView}
      filter={filter}
      onBack={props.onBack}
    >
      <Results
        image={image}
        secondaryImage={secondaryImage}
        beverage={beverage}
        report={report}
        onNewReview={props.onBack}
        onRunFullComparison={props.onBack}
        onTryAnotherImage={props.onBack}
        onContinueWithCaution={props.onBack}
        onExportResults={props.onExportResults}
        exportEnabled={true}
      />
      <DrillInWalker
        indexInView={indexInView}
        totalInView={totalInView}
        filter={filter}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={props.onPrevious}
        onNext={props.onNext}
      />
    </DrillInFrame>
  );
}

function DrillInWalker({
  indexInView,
  totalInView,
  filter,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext
}: {
  indexInView: number;
  totalInView: number;
  filter: BatchDashboardFilter;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const positionLabel = `${indexInView} of ${totalInView} ${FILTER_POSITION_LABEL[filter]}`;
  return (
    <section
      aria-label="Move to adjacent label"
      className="sticky bottom-0 z-30 border-t border-outline-variant/15 bg-surface-container-low/95 backdrop-blur supports-[backdrop-filter]:bg-surface-container-low/80 shadow-[0_-8px_24px_rgba(45,52,51,0.08)]"
    >
      <div className="w-full px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        <WalkerButton
          direction="previous"
          disabled={!hasPrevious}
          onClick={onPrevious}
        />
        <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-lowest border border-outline-variant/20 rounded-full px-4 py-1.5">
          {positionLabel}
        </span>
        <WalkerButton direction="next" disabled={!hasNext} onClick={onNext} />
      </div>
    </section>
  );
}

function WalkerButton({
  direction,
  disabled,
  onClick
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const label = direction === 'previous' ? 'Previous label' : 'Next label';
  const icon = direction === 'previous' ? 'chevron_left' : 'chevron_right';
  const base =
    'inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-label font-bold uppercase tracking-widest transition-all focus-visible:outline-2 focus-visible:outline-offset-2 shadow-ambient';
  const stateClass = disabled
    ? 'bg-surface-container-high text-outline-variant/70 cursor-not-allowed shadow-none'
    : 'bg-surface-container-lowest text-on-surface border border-outline-variant/30 hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent active:scale-[0.98]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[base, stateClass].join(' ')}
    >
      {direction === 'previous' ? (
        <>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            {icon}
          </span>
          {label}
        </>
      ) : (
        <>
          {label}
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            {icon}
          </span>
        </>
      )}
    </button>
  );
}

function DrillInFrame({
  indexInView,
  totalInView,
  filter,
  onBack,
  children
}: {
  indexInView: number;
  totalInView: number;
  filter: BatchDashboardFilter;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const positionLabel = `${indexInView} of ${totalInView} ${FILTER_POSITION_LABEL[filter]}`;
  return (
    <div className="flex flex-col">
      <nav
        aria-label="Drill-in navigation"
        className="bg-surface-container-low border-b border-outline-variant/15"
      >
        <div className="w-full px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to batch results"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest bg-surface-container-lowest text-on-surface border border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Back to Batch Results
          </button>
          <span className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-lowest border border-outline-variant/20 rounded-full px-3 py-1">
            {positionLabel}
          </span>
        </div>
      </nav>
      {children}
    </div>
  );
}

function UnavailablePanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 py-8 xl:py-16">
      <div className="bg-surface-container-lowest border-l-4 border-outline-variant/40 rounded-lg p-8 flex flex-col gap-4 shadow-ambient">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-3xl text-on-surface-variant"
          >
            info
          </span>
          <h2 className="font-headline text-xl font-bold text-on-surface">
            We couldn't load this label's details.
          </h2>
        </div>
        <p className="font-body text-on-surface-variant">
          Something went wrong while reviewing this label. Go back to the batch results to retry it.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg bg-surface-container-high text-on-surface font-semibold text-sm hover:bg-surface-container-highest transition-colors"
          >
            Back to Batch Results
          </button>
        </div>
      </div>
    </div>
  );
}

function buildDrillInImage(row: BatchDashboardRow): LabelImage {
  return buildDrillInImageVariant({
    filename: row.filename,
    previewUrl: row.previewUrl,
    isPdf: row.isPdf,
    sizeLabel: row.sizeLabel,
    brandName: row.brandName,
    classType: row.classType
  });
}

function buildDrillInSecondaryImage(row: BatchDashboardRow): LabelImage | null {
  if (!row.secondaryImageId || !row.secondaryFilename) {
    return null;
  }

  return buildDrillInImageVariant({
    filename: row.secondaryFilename,
    previewUrl: row.secondaryPreviewUrl ?? null,
    isPdf: row.secondaryIsPdf ?? false,
    sizeLabel: row.secondarySizeLabel ?? row.sizeLabel,
    brandName: row.brandName,
    classType: row.classType
  });
}

function buildDrillInImageVariant(input: {
  filename: string;
  previewUrl: string | null;
  isPdf: boolean;
  sizeLabel: string;
  brandName: string;
  classType: string;
}): LabelImage {
  const mimeType = input.isPdf
    ? 'application/pdf'
    : input.filename.toLowerCase().endsWith('.png')
      ? 'image/png'
      : input.filename.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
  const file = new File([new Uint8Array()], input.filename, { type: mimeType });
  const previewUrl =
    input.previewUrl ??
    (input.isPdf
      ? ''
      : buildLabelThumbnail({
          brandName: input.brandName,
          classType: input.classType
        }));
  return {
    file,
    previewUrl,
    sizeLabel: input.sizeLabel
  };
}
