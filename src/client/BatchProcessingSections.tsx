import type {
  BatchItemStatus,
  BatchPhase,
  BatchStreamItem,
  BatchTerminalSummary
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

export function Header({
  phase,
  total,
  summary
}: {
  phase: BatchPhase;
  total: number;
  summary: BatchTerminalSummary | null;
}) {
  const heading =
    phase === 'terminal'
      ? summary && summary.total > 0
        ? 'Batch Processing · complete'
        : 'Batch Processing'
      : 'Batch Processing';
  const intent =
    phase === 'running'
      ? `Reviewing ${total} labels. Nothing is stored.`
      : phase === 'cancelled'
        ? 'Batch cancelled. Nothing is stored.'
        : summary
          ? summaryIntent(summary)
          : `Reviewing ${total} labels. Nothing is stored.`;
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
        {heading}
      </h1>
      <p className="text-on-surface-variant font-body">{intent}</p>
    </header>
  );
}

export function ProgressBlock({
  done,
  total,
  remaining,
  secondsRemaining,
  percent,
  onCancel
}: {
  done: number;
  total: number;
  remaining: number;
  secondsRemaining: number | null;
  percent: number;
  onCancel: () => void;
}) {
  return (
    <section
      aria-label="Batch progress"
      className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-6 flex flex-col gap-4 shadow-ambient"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-4">
          <span className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
            Processed {done} of {total}
          </span>
          <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            {remaining} remaining
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span
            className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant"
            aria-live="polite"
          >
            {secondsRemaining === null || secondsRemaining <= 0
              ? 'estimating…'
              : `about ${humanizeSeconds(secondsRemaining)} left`}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-error hover:underline inline-flex items-center gap-1"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              close
            </span>
            Cancel batch
          </button>
        </div>
      </div>
      <div
        className="relative h-2.5 bg-surface-container-high rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Batch processing progress"
      >
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}

export function StreamBlock({
  items,
  onRetryItem,
  onPreviewItem,
  streamEmptyLabel
}: {
  items: BatchStreamItem[];
  onRetryItem: (itemId: string) => void;
  onPreviewItem: (item: BatchStreamItem) => void;
  streamEmptyLabel: string;
}) {
  return (
    <section aria-label="Completed items" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-headline text-lg font-bold text-on-surface">
          Completed items
        </h2>
        <span className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
          newest first
        </span>
      </header>

      {items.length === 0 ? (
        <div className="bg-surface-container-low border border-dashed border-outline-variant/40 rounded-lg px-6 py-10 text-center">
          <p className="text-sm text-on-surface-variant">{streamEmptyLabel}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <StreamRow
                item={item}
                onRetry={() => onRetryItem(item.id)}
                onPreview={() => onPreviewItem(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TerminalSummary({
  summary,
  onBackToIntake,
  onOpenDashboard
}: {
  summary: BatchTerminalSummary;
  onBackToIntake: () => void;
  onOpenDashboard: () => void;
}) {
  const tone: 'tertiary' | 'error' | 'neutral' =
    summary.pass === summary.total && summary.total > 0
      ? 'tertiary'
      : summary.fail === summary.total && summary.total > 0
        ? 'error'
        : 'neutral';
  const toneClass =
    tone === 'tertiary'
      ? 'border-tertiary bg-tertiary-container/20'
      : tone === 'error'
        ? 'border-error bg-error-container/15'
        : 'border-primary bg-primary-container/20';
  return (
    <section
      className={[
        'border rounded-lg px-6 py-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between shadow-ambient',
        toneClass
      ].join(' ')}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-headline text-xl font-bold text-on-surface">
          All {summary.total} labels reviewed.
        </h2>
        <p className="text-sm text-on-surface-variant font-body">
          {summary.pass} Pass · {summary.review} Review · {summary.fail} Fail
          {summary.error > 0 ? ` · ${summary.error} Error` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBackToIntake}
          className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Back to Intake
        </button>
        <button
          type="button"
          onClick={onOpenDashboard}
          className="px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest flex items-center gap-2 bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]"
        >
          Open Dashboard
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            arrow_forward
          </span>
        </button>
      </div>
    </section>
  );
}

export function CancelledActions({ onBackToIntake }: { onBackToIntake: () => void }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-6 py-4 flex items-center justify-end">
      <button
        type="button"
        onClick={onBackToIntake}
        className="px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all"
      >
        Back to Intake
      </button>
    </section>
  );
}

export function Banner({
  tone,
  icon,
  heading,
  body
}: {
  tone: 'neutral' | 'error';
  icon: string;
  heading: string;
  body: string;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-error bg-error-container/15 text-on-error-container'
      : 'border-primary bg-primary-container/25 text-on-primary-container';
  return (
    <section
      role="status"
      className={['border-l-4 rounded-lg px-5 py-4 flex items-start gap-3', toneClass].join(
        ' '
      )}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-2xl flex-shrink-0">
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <h3 className="font-headline text-base font-bold text-on-surface">{heading}</h3>
        <p className="text-sm font-body">{body}</p>
      </div>
    </section>
  );
}

export function PrivacyFoot() {
  return (
    <div className="flex items-center gap-2 text-on-surface-variant">
      <span aria-hidden="true" className="material-symbols-outlined text-lg">
        shield
      </span>
      <p className="text-sm font-label">
        Nothing is stored. Inputs and results are discarded when you leave.
      </p>
    </div>
  );
}

function summaryIntent(summary: BatchTerminalSummary): string {
  if (summary.total === 0) return 'No labels finished.';
  if (summary.pass === summary.total) {
    return `All ${summary.total} labels passed.`;
  }
  if (summary.fail === summary.total) {
    return `All ${summary.total} labels failed.`;
  }
  return `All ${summary.total} labels reviewed. Nothing is stored.`;
}

function StreamRow({
  item,
  onRetry,
  onPreview
}: {
  item: BatchStreamItem;
  onRetry: () => void;
  onPreview: () => void;
}) {
  const isError = item.status === 'error';
  return (
    <div
      className={[
        'bg-surface-container-lowest border rounded-lg px-4 py-3',
        'grid grid-cols-1 md:grid-cols-12 gap-3 items-center',
        isError ? 'border-error/30' : 'border-outline-variant/15'
      ].join(' ')}
    >
      <div className="md:col-span-5 min-w-0 flex items-center gap-3">
        <StreamThumb item={item} onPreview={onPreview} />
        <div className="min-w-0">
          <button
            type="button"
            onClick={onPreview}
            className="font-mono text-sm text-on-surface truncate hover:underline text-left"
          >
            {item.filename}
          </button>
        </div>
      </div>
      <div className="md:col-span-5 min-w-0">
        <p className="text-sm text-on-surface font-semibold truncate">
          {item.identity || '—'}
        </p>
        {isError && item.errorMessage ? (
          <p className="text-xs text-on-surface-variant font-body mt-0.5 truncate">
            {item.errorMessage}
          </p>
        ) : null}
      </div>
      <div className="md:col-span-2 flex md:justify-end items-center gap-3">
        <StreamStatusBadge status={item.status} />
        {isError ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-label font-bold uppercase tracking-widest text-primary hover:underline"
          >
            Retry this item
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StreamThumb({
  item,
  onPreview
}: {
  item: BatchStreamItem;
  onPreview: () => void;
}) {
  const boxClass =
    'w-10 h-[52px] rounded border border-outline-variant/20 bg-surface-container-highest flex items-center justify-center flex-shrink-0 cursor-zoom-in transition-transform hover:scale-[1.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden';
  const body = item.isPdf ? (
    <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">
      picture_as_pdf
    </span>
  ) : item.previewUrl ? (
    <img
      alt={`Preview of ${item.filename}`}
      src={item.previewUrl}
      className="w-10 h-[52px] object-cover"
    />
  ) : (
    <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">
      image
    </span>
  );
  return (
    <button
      type="button"
      onClick={onPreview}
      aria-label={`View larger preview of ${item.filename}`}
      className={boxClass}
    >
      {body}
    </button>
  );
}

function StreamStatusBadge({ status }: { status: BatchItemStatus }) {
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

function humanizeSeconds(total: number): string {
  if (total < 60) return `${total} seconds`;
  const minutes = Math.round(total / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
