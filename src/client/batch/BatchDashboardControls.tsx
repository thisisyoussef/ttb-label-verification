import type {
  BatchDashboardFilter,
  BatchDashboardRow,
  BatchDashboardSort,
  BatchItemStatus
} from './batchTypes';
import type { ExportState } from './BatchDashboard';

// Filter order intentionally drops 'reject'. The single-label
// VerdictBanner already collapses the engine's `reject` verdict into
// `review` for display ("Needs your review"); the batch dashboard
// follows the same vocabulary so users only see two outcome buckets.
// `BatchDashboardFilter` keeps the 'reject' value for backwards-
// compatibility with stored sessions, but it's no longer rendered as
// a pill — `filterRows` still honours an externally-set 'reject'
// filter if one is somehow active.
export const FILTER_ORDER: BatchDashboardFilter[] = ['all', 'review', 'approve'];

export const FILTER_LABELS: Record<BatchDashboardFilter, string> = {
  all: 'All',
  reject: 'Needs review only',
  review: 'Needs review only',
  approve: 'Approves only'
};

export const FILTER_EMPTY_LABEL: Record<BatchDashboardFilter, string> = {
  all: 'labels',
  reject: 'labels needing review',
  review: 'labels needing review',
  approve: 'approves'
};

export const SORT_OPTIONS: Array<{ value: BatchDashboardSort; label: string }> = [
  { value: 'worst-first', label: 'Worst first' },
  { value: 'filename', label: 'Filename' },
  { value: 'brand-name', label: 'Brand name' },
  { value: 'completed-order', label: 'Order completed' }
];

const STATUS_RANK: Record<BatchItemStatus, number> = {
  fail: 0,
  review: 1,
  pass: 2,
  error: 3
};

export function SummaryCards({
  pass,
  review,
  fail
}: {
  pass: number;
  review: number;
  fail: number;
}) {
  // Engine 'fail' verdicts are collapsed into the Needs Review bucket
  // here to match the single-label VerdictBanner's two-state display.
  // The underlying counts stay separate on the wire — only the
  // rendered card merges them.
  const needsReview = review + fail;
  return (
    <section aria-label="Outcome summary" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SummaryCard
        heading="Approve"
        description="Recommend approval"
        count={pass}
        tone="tertiary"
        icon="check_circle"
      />
      <SummaryCard
        heading="Needs review"
        description="A reviewer should take a closer look"
        count={needsReview}
        tone="caution"
        icon="warning"
      />
    </section>
  );
}

export function FilterPill({
  label,
  count,
  active,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1.5 text-xs font-label font-bold uppercase tracking-widest transition-all',
        active
          ? 'bg-primary text-on-primary shadow-ambient'
          : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
      ].join(' ')}
    >
      {label} · {count}
    </button>
  );
}

export function ActionBar({
  exportState,
  onStartAnotherBatch,
  onBeginExport,
  onConfirmExport,
  onCancelExport,
  onRetryExport
}: {
  exportState: ExportState;
  onStartAnotherBatch: () => void;
  onBeginExport: () => void;
  onConfirmExport: () => void;
  onCancelExport: () => void;
  onRetryExport: () => void;
}) {
  return (
    <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-6 py-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-label text-on-surface">
          Nothing is stored. Export results if you need a copy before leaving.
        </p>
        <p className="text-xs font-body text-on-surface-variant">
          All results are cleared when you leave this session.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onStartAnotherBatch}
          className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Start Another Batch
        </button>
        <ExportControl
          state={exportState}
          onBegin={onBeginExport}
          onConfirm={onConfirmExport}
          onCancel={onCancelExport}
          onRetry={onRetryExport}
        />
      </div>
    </section>
  );
}

export function countRowsByFilter(rows: BatchDashboardRow[]) {
  // 'review' counts BOTH engine-review and engine-fail rows so the
  // pill matches the merged "Needs review" bucket on the SummaryCards.
  // 'reject' stays as a count of just engine-fail rows in case any
  // legacy session reads it, but no UI surface renders that pill.
  const fail = rows.filter((row) => row.status === 'fail').length;
  const review = rows.filter((row) => row.status === 'review').length;
  return {
    all: rows.length,
    reject: fail,
    review: review + fail,
    approve: rows.filter((row) => row.status === 'pass').length
  };
}

export function filterRows(
  rows: BatchDashboardRow[],
  filter: BatchDashboardFilter
): BatchDashboardRow[] {
  if (filter === 'all') return rows;
  // 'review' now includes engine-fail rows so a reviewer drilling
  // into "Needs review" sees every label that isn't a clean approve.
  if (filter === 'reject') return rows.filter((row) => row.status === 'fail');
  if (filter === 'review') {
    return rows.filter((row) => row.status === 'review' || row.status === 'fail');
  }
  return rows.filter((row) => row.status === 'pass');
}

export function sortRows(
  rows: BatchDashboardRow[],
  sort: BatchDashboardSort
): BatchDashboardRow[] {
  const sorted = [...rows];

  if (sort === 'worst-first') {
    sorted.sort((left, right) => STATUS_RANK[left.status] - STATUS_RANK[right.status]);
    return sorted;
  }

  if (sort === 'filename') {
    sorted.sort((left, right) => left.filename.localeCompare(right.filename));
    return sorted;
  }

  if (sort === 'brand-name') {
    sorted.sort((left, right) => left.brandName.localeCompare(right.brandName));
    return sorted;
  }

  sorted.sort((left, right) => left.completedOrder - right.completedOrder);
  return sorted;
}

function SummaryCard({
  heading,
  description,
  count,
  tone,
  icon
}: {
  heading: string;
  description: string;
  count: number;
  tone: 'tertiary' | 'caution' | 'error';
  icon: string;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-error/25 bg-error-container/10'
      : tone === 'caution'
        ? 'border-caution/30 bg-caution-container/10'
        : 'border-tertiary/30 bg-tertiary-container/10';

  return (
    <div className={['rounded-lg border px-5 py-4 shadow-ambient flex flex-col gap-3', toneClass].join(' ')}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
            {heading}
          </p>
          <h2 className="font-headline text-2xl font-extrabold text-on-surface">{count}</h2>
        </div>
        <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-surface-variant">
          {icon}
        </span>
      </div>
      <p className="text-sm font-body text-on-surface-variant">{description}</p>
    </div>
  );
}

function ExportControl({
  state,
  onBegin,
  onConfirm,
  onCancel,
  onRetry
}: {
  state: ExportState;
  onBegin: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (state.kind === 'confirming') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]"
        >
          Confirm Export
        </button>
      </div>
    );
  }

  if (state.kind === 'in-progress') {
    return (
      <button
        type="button"
        disabled
        className="px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest bg-surface-container-high text-on-surface-variant cursor-wait"
      >
        Exporting…
      </button>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex items-center gap-3">
        <p className="text-xs font-body text-error">{state.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-sm font-semibold text-primary hover:underline"
        >
          Retry export
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onBegin}
      className="px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]"
    >
      Export Results
    </button>
  );
}
