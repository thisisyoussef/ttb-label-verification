import { useMemo, useState } from 'react';
import type {
  BatchDashboardFilter,
  BatchDashboardIssues,
  BatchDashboardRow,
  BatchDashboardSeed,
  BatchDashboardSort,
  BatchItemStatus
} from './batchTypes';

interface BatchDashboardProps {
  seed: BatchDashboardSeed;
  reviewedIds: Set<string>;
  exportState: ExportState;
  onOpenRow: (
    row: BatchDashboardRow,
    filter: BatchDashboardFilter,
    rowsInView: BatchDashboardRow[]
  ) => void;
  onRetryRow: (row: BatchDashboardRow) => void;
  onStartAnotherBatch: () => void;
  onBeginExport: () => void;
  onConfirmExport: () => void;
  onCancelExport: () => void;
  onRetryExport: () => void;
}

export type ExportState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'in-progress' }
  | { kind: 'error'; message: string };

const FILTER_ORDER: BatchDashboardFilter[] = ['all', 'reject', 'review', 'approve'];

const FILTER_LABELS: Record<BatchDashboardFilter, string> = {
  all: 'All',
  reject: 'Rejects only',
  review: 'Reviews only',
  approve: 'Approves only'
};

const FILTER_EMPTY_LABEL: Record<BatchDashboardFilter, string> = {
  all: 'labels',
  reject: 'rejects',
  review: 'reviews',
  approve: 'approves'
};

const SORT_OPTIONS: Array<{ value: BatchDashboardSort; label: string }> = [
  { value: 'worst-first', label: 'Worst first' },
  { value: 'filename', label: 'Filename' },
  { value: 'brand-name', label: 'Brand name' },
  { value: 'completed-order', label: 'Completed order' }
];

const STATUS_RANK: Record<BatchItemStatus, number> = {
  fail: 0,
  review: 1,
  pass: 2,
  error: 3
};

const STATUS_COPY: Record<BatchItemStatus, string> = {
  pass: 'Pass',
  review: 'Review',
  fail: 'Fail',
  error: 'Error'
};

const STATUS_ICON: Record<BatchItemStatus, string> = {
  pass: 'check_circle',
  review: 'warning',
  fail: 'cancel',
  error: 'error'
};

const STATUS_CLASS: Record<BatchItemStatus, string> = {
  pass: 'bg-tertiary-container/40 text-on-tertiary-container',
  review: 'bg-caution-container text-on-caution-container',
  fail: 'bg-error-container/40 text-on-error-container',
  error: 'bg-surface-container-highest text-on-surface-variant'
};

const BEVERAGE_LABELS: Record<BatchDashboardRow['beverageType'], string> = {
  'distilled-spirits': 'Distilled Spirits',
  wine: 'Wine',
  'malt-beverage': 'Malt Beverage',
  unknown: 'Unknown'
};

export function BatchDashboard(props: BatchDashboardProps) {
  const { seed, reviewedIds, exportState } = props;
  const [filter, setFilter] = useState<BatchDashboardFilter>('all');
  const [sort, setSort] = useState<BatchDashboardSort>('worst-first');

  const filterCounts = useMemo(() => countRowsByFilter(seed.rows), [seed.rows]);
  const visibleRows = useMemo(
    () => sortRows(filterRows(seed.rows, filter), sort),
    [seed.rows, filter, sort]
  );

  const intentLine = useMemo(() => {
    if (seed.phase === 'cancelled-partial') {
      return `${seed.totals.done} reviewed of ${seed.totals.started} started · Batch cancelled`;
    }
    if (seed.summary.pass === seed.totals.done && seed.totals.done > 0) {
      return 'Every label in this batch was approved.';
    }
    if (seed.summary.fail === seed.totals.done && seed.totals.done > 0) {
      return 'Every label in this batch was rejected.';
    }
    return `Reviewing outcomes for ${seed.totals.done} labels. Nothing is stored.`;
  }, [seed.phase, seed.summary, seed.totals]);

  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 py-10">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            Batch Results
          </h1>
          <p className="text-on-surface-variant font-body">{intentLine}</p>
        </header>

        <SummaryCards
          pass={seed.summary.pass}
          review={seed.summary.review}
          fail={seed.summary.fail}
        />

        <section
          aria-label="Filter and sort controls"
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-surface-container-low rounded-lg px-4 py-3"
        >
          <div
            role="tablist"
            aria-label="Filter rows"
            className="flex items-center gap-1 flex-wrap"
          >
            {FILTER_ORDER.map((key) => (
              <FilterPill
                key={key}
                label={FILTER_LABELS[key]}
                count={filterCounts[key]}
                active={filter === key}
                onClick={() => setFilter(key)}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as BatchDashboardSort)}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded px-2 py-1 text-sm font-body font-semibold text-on-surface focus:border-primary focus:ring-0 outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section aria-label="Triage table" className="flex flex-col">
          {visibleRows.length === 0 ? (
            <EmptyFilter
              label={FILTER_EMPTY_LABEL[filter]}
              onClear={() => setFilter('all')}
            />
          ) : (
            <TriageTable
              rows={visibleRows}
              reviewedIds={reviewedIds}
              onOpenRow={(row) => props.onOpenRow(row, filter, visibleRows)}
              onRetryRow={props.onRetryRow}
            />
          )}
        </section>

        <ActionBar
          exportState={exportState}
          onStartAnotherBatch={props.onStartAnotherBatch}
          onBeginExport={props.onBeginExport}
          onConfirmExport={props.onConfirmExport}
          onCancelExport={props.onCancelExport}
          onRetryExport={props.onRetryExport}
        />
      </div>
    </div>
  );
}

function SummaryCards({
  pass,
  review,
  fail
}: {
  pass: number;
  review: number;
  fail: number;
}) {
  return (
    <section
      aria-label="Outcome summary"
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <SummaryCard
        heading="Approve"
        description="Recommend approval"
        count={pass}
        tone="tertiary"
        icon="check_circle"
      />
      <SummaryCard
        heading="Review"
        description="Needs a human read"
        count={review}
        tone="caution"
        icon="warning"
      />
      <SummaryCard
        heading="Reject"
        description="Clear violations"
        count={fail}
        tone="error"
        icon="cancel"
      />
    </section>
  );
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
  const accentClass =
    tone === 'tertiary'
      ? 'border-tertiary'
      : tone === 'caution'
        ? 'border-caution'
        : 'border-error';
  const iconClass =
    tone === 'tertiary'
      ? 'bg-tertiary-container/40 text-on-tertiary-container'
      : tone === 'caution'
        ? 'bg-caution-container text-on-caution-container'
        : 'bg-error-container/40 text-on-error-container';
  return (
    <article
      className={[
        'bg-surface-container-lowest border-l-4 rounded-lg px-6 py-5 flex items-start justify-between gap-4',
        accentClass
      ].join(' ')}
    >
      <div className="flex flex-col gap-2 min-w-0">
        <p className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {heading}
        </p>
        <p className="font-headline text-4xl font-extrabold text-on-surface leading-none">
          {count}
        </p>
        <p className="text-sm text-on-surface-variant font-body">{description}</p>
      </div>
      <div
        className={[
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          iconClass
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

function FilterPill({
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
        'px-4 py-1.5 rounded-full text-sm transition-colors',
        active
          ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-ambient border border-outline-variant/20'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
      ].join(' ')}
    >
      {label}
      <span className="ml-2 font-mono text-xs text-on-surface-variant">· {count}</span>
    </button>
  );
}

function TriageTable({
  rows,
  reviewedIds,
  onOpenRow,
  onRetryRow
}: {
  rows: BatchDashboardRow[];
  reviewedIds: Set<string>;
  onOpenRow: (row: BatchDashboardRow) => void;
  onRetryRow: (row: BatchDashboardRow) => void;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/15 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant/15">
            <th className="px-4 py-3 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
              Status
            </th>
            <th className="px-4 py-3 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
              Label
            </th>
            <th className="px-4 py-3 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
              Identity
            </th>
            <th className="px-4 py-3 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
              Issues
            </th>
            <th className="px-4 py-3 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {rows.map((row) => (
            <TriageRow
              key={row.rowId}
              row={row}
              reviewed={reviewedIds.has(row.rowId)}
              onOpen={() => onOpenRow(row)}
              onRetry={() => onRetryRow(row)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TriageRow({
  row,
  reviewed,
  onOpen,
  onRetry
}: {
  row: BatchDashboardRow;
  reviewed: boolean;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const isError = row.status === 'error';
  return (
    <tr className="hover:bg-surface-container-low/60 transition-colors">
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <RowThumb row={row} />
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="font-mono text-sm text-on-surface truncate max-w-[260px]">
              {row.filename}
            </span>
            {reviewed ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[12px]"
                >
                  history
                </span>
                Reviewed this session
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {row.status === 'error' ? (
          <span className="text-sm text-on-surface-variant italic font-body">
            (not available)
          </span>
        ) : (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-on-surface font-semibold truncate max-w-[260px]">
              {row.brandName}
            </span>
            <span className="text-xs text-on-surface-variant font-body truncate max-w-[260px]">
              {row.classType} · {BEVERAGE_LABELS[row.beverageType]}
            </span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <IssuesCell row={row} />
      </td>
      <td className="px-4 py-3 text-right">
        {isError ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-label font-bold uppercase tracking-widest text-primary hover:underline"
          >
            Retry this item
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="text-xs font-label font-bold uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1"
          >
            View details
            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </button>
        )}
      </td>
    </tr>
  );
}

function RowThumb({ row }: { row: BatchDashboardRow }) {
  const base =
    'w-10 h-[52px] rounded border border-outline-variant/20 bg-surface-container-highest flex items-center justify-center flex-shrink-0 overflow-hidden';
  if (row.isPdf) {
    return (
      <div className={base}>
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[18px] text-on-surface-variant"
        >
          picture_as_pdf
        </span>
      </div>
    );
  }
  if (row.previewUrl) {
    return (
      <img
        alt={`Preview of ${row.filename}`}
        src={row.previewUrl}
        className="w-10 h-[52px] rounded border border-outline-variant/20 object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className={base}>
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-[18px] text-on-surface-variant"
      >
        image
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: BatchItemStatus }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-label font-bold uppercase tracking-wider',
        STATUS_CLASS[status]
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-[14px]"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {STATUS_ICON[status]}
      </span>
      <span>{STATUS_COPY[status]}</span>
    </span>
  );
}

function IssuesCell({ row }: { row: BatchDashboardRow }) {
  if (row.status === 'error') {
    return <span className="text-sm text-on-surface-variant">—</span>;
  }
  if (row.confidenceState === 'low-confidence') {
    return (
      <span className="text-xs text-on-surface-variant font-body">
        review · low confidence
      </span>
    );
  }
  return <span className="text-xs text-on-surface font-body">{formatIssues(row.issues)}</span>;
}

function EmptyFilter({
  label,
  onClear
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="bg-surface-container-low border border-dashed border-outline-variant/40 rounded-lg px-6 py-10 flex flex-col items-center gap-2 text-center">
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-3xl text-on-surface-variant/70"
      >
        filter_alt
      </span>
      <p className="text-sm text-on-surface-variant font-body">No {label} in this batch.</p>
      <button
        type="button"
        onClick={onClear}
        className="text-sm font-label font-bold uppercase tracking-widest text-primary hover:underline"
      >
        Clear filter
      </button>
    </div>
  );
}

function ActionBar({
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
    <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-6 py-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between shadow-ambient">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-lg"
        >
          shield
        </span>
        <p className="text-sm font-label">
          Nothing is stored. Inputs and results are discarded when you leave.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <ExportControl
          state={exportState}
          onBegin={onBeginExport}
          onConfirm={onConfirmExport}
          onCancel={onCancelExport}
          onRetry={onRetryExport}
        />
        <button
          type="button"
          onClick={onStartAnotherBatch}
          className="px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest flex items-center gap-2 bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]"
        >
          Start Another Batch
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-base"
          >
            arrow_forward
          </span>
        </button>
      </div>
    </section>
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
  if (state.kind === 'idle') {
    return (
      <button
        type="button"
        onClick={onBegin}
        className="px-5 py-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-semibold text-sm hover:bg-surface-container-low transition-colors inline-flex items-center gap-2"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          download
        </span>
        Export Results
      </button>
    );
  }
  if (state.kind === 'confirming') {
    return (
      <div
        role="group"
        aria-label="Confirm export"
        className="flex items-center gap-3 flex-wrap bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2"
      >
        <span className="text-xs font-label text-on-surface max-w-[280px]">
          One download. JSON format. Nothing is stored on our servers.
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-3 py-1.5 rounded text-xs font-label font-bold uppercase tracking-widest bg-primary text-on-primary hover:brightness-110 transition-all"
        >
          Confirm export
        </button>
      </div>
    );
  }
  if (state.kind === 'in-progress') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2"
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[18px] text-primary animate-pulse"
        >
          hourglass_top
        </span>
        <span className="text-xs font-label text-on-surface">Preparing your export…</span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="flex items-center gap-3 bg-error-container/15 border border-error/30 rounded-lg px-4 py-2"
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-[18px] text-error"
      >
        error
      </span>
      <span className="text-xs font-label text-on-error-container">
        Export didn't complete. Try again.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1 rounded text-xs font-label font-bold uppercase tracking-widest bg-surface-container-lowest border border-outline-variant/30 text-on-surface hover:bg-surface-container-low transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function countRowsByFilter(
  rows: BatchDashboardRow[]
): Record<BatchDashboardFilter, number> {
  const counts: Record<BatchDashboardFilter, number> = {
    all: rows.length,
    reject: 0,
    review: 0,
    approve: 0
  };
  for (const row of rows) {
    if (row.status === 'fail') counts.reject += 1;
    else if (row.status === 'review') counts.review += 1;
    else if (row.status === 'pass') counts.approve += 1;
  }
  return counts;
}

function filterRows(
  rows: BatchDashboardRow[],
  filter: BatchDashboardFilter
): BatchDashboardRow[] {
  if (filter === 'all') return rows;
  if (filter === 'reject') return rows.filter((row) => row.status === 'fail');
  if (filter === 'review') return rows.filter((row) => row.status === 'review');
  return rows.filter((row) => row.status === 'pass');
}

function sortRows(
  rows: BatchDashboardRow[],
  sort: BatchDashboardSort
): BatchDashboardRow[] {
  const copy = [...rows];
  switch (sort) {
    case 'worst-first':
      copy.sort((a, b) => {
        const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (statusDiff !== 0) return statusDiff;
        const severityA =
          a.issues.blocker * 1000 +
          a.issues.major * 100 +
          a.issues.minor * 10 +
          a.issues.note;
        const severityB =
          b.issues.blocker * 1000 +
          b.issues.major * 100 +
          b.issues.minor * 10 +
          b.issues.note;
        if (severityA !== severityB) return severityB - severityA;
        return a.completedOrder - b.completedOrder;
      });
      break;
    case 'filename':
      copy.sort((a, b) => a.filename.localeCompare(b.filename));
      break;
    case 'brand-name':
      copy.sort((a, b) => a.brandName.localeCompare(b.brandName));
      break;
    case 'completed-order':
      copy.sort((a, b) => a.completedOrder - b.completedOrder);
      break;
  }
  return copy;
}

function formatIssues(issues: BatchDashboardIssues): string {
  const parts: string[] = [];
  if (issues.blocker > 0) parts.push(`${issues.blocker} blocker`);
  if (issues.major > 0) parts.push(`${issues.major} major`);
  if (issues.minor > 0) parts.push(`${issues.minor} minor`);
  if (issues.note > 0) parts.push(`${issues.note} note`);
  if (parts.length === 0) return '—';
  return parts.join(' · ');
}
