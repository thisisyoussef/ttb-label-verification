import type {
  BatchDashboardIssues,
  BatchDashboardRow,
  BatchItemStatus
} from './batchTypes';

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

export function TriageTable({
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
    <div className="rounded-lg border border-outline-variant/20 overflow-hidden">
      <div className="hidden lg:grid grid-cols-[88px_1.6fr_1.4fr_1fr_1fr_120px] gap-4 px-5 py-3 bg-surface-container-low text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
        <span>Image</span>
        <span>Label</span>
        <span>Beverage</span>
        <span>Issues</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-outline-variant/15">
        {rows.map((row) => (
          <li key={row.rowId}>
            <TriageRow
              row={row}
              reviewed={reviewedIds.has(row.rowId)}
              onOpenRow={onOpenRow}
              onRetryRow={onRetryRow}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyFilter({
  label,
  onClear
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant/35 px-6 py-12 text-center flex flex-col items-center gap-3">
      <span aria-hidden="true" className="material-symbols-outlined text-[28px] text-on-surface-variant">
        filter_alt_off
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-headline text-lg font-bold text-on-surface">No {label} in this view</h2>
        <p className="text-sm font-body text-on-surface-variant">
          Clear the filter to see the full batch again.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="px-4 py-2 text-sm font-semibold text-primary hover:underline"
      >
        Show all rows
      </button>
    </div>
  );
}

function TriageRow({
  row,
  reviewed,
  onOpenRow,
  onRetryRow
}: {
  row: BatchDashboardRow;
  reviewed: boolean;
  onOpenRow: (row: BatchDashboardRow) => void;
  onRetryRow: (row: BatchDashboardRow) => void;
}) {
  return (
    <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-[88px_1.6fr_1.4fr_1fr_1fr_120px] gap-4 items-center">
      <RowThumb row={row} />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpenRow(row)}
          className="text-left min-w-0 hover:underline"
        >
          <p className="font-mono text-sm text-on-surface truncate">{row.filename}</p>
          <p className="text-xs text-on-surface-variant truncate">
            {row.brandName} · {row.classType}
          </p>
        </button>
      </div>
      <div className="text-sm text-on-surface">{BEVERAGE_LABELS[row.beverageType]}</div>
      <IssuesCell row={row} />
      <div className="flex items-center gap-2">
        <StatusBadge status={row.status} />
        {reviewed ? (
          <span className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
            Reviewed
          </span>
        ) : null}
      </div>
      <div className="flex lg:justify-end items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenRow(row)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Open
        </button>
        {row.status === 'error' ? (
          <button
            type="button"
            onClick={() => onRetryRow(row)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RowThumb({ row }: { row: BatchDashboardRow }) {
  return (
    <div className="w-16 h-[84px] rounded border border-outline-variant/20 bg-surface-container-highest flex items-center justify-center overflow-hidden">
      {row.isPdf ? (
        <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-surface-variant">
          picture_as_pdf
        </span>
      ) : row.previewUrl ? (
        <img src={row.previewUrl} alt={`Preview of ${row.filename}`} className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-surface-variant">
          image
        </span>
      )}
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
  const text = formatIssues(row.issues);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-on-surface">{text}</span>
      {row.errorMessage ? (
        <span className="text-xs text-on-surface-variant">{row.errorMessage}</span>
      ) : null}
    </div>
  );
}

function formatIssues(issues: BatchDashboardIssues): string {
  const parts = [
    issues.blocker > 0 ? `${issues.blocker} must fix` : null,
    issues.major > 0 ? `${issues.major} important` : null,
    issues.minor > 0 ? `${issues.minor} minor` : null,
    issues.note > 0 ? `${issues.note} note` : null
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' · ') : 'No issues';
}
