import type { BatchFileError } from './batchTypes';

export interface BatchUploadCounts {
  images: number;
  csvRows: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
}

export function CountStrip({ counts }: { counts: BatchUploadCounts }) {
  return (
    <section aria-label="Batch summary" className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <CountCell label="Images" value={counts.images} />
      <CountCell label="CSV rows" value={counts.csvRows} />
      <CountCell label="Matched" value={counts.matched} />
      <CountCell label="Ambiguous" value={counts.ambiguous} tone="caution" />
      <CountCell label="Unmatched" value={counts.unmatched} tone="error" />
    </section>
  );
}

export function FileErrorList({ errors }: { errors: BatchFileError[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="File errors"
      className="rounded-lg border border-error/25 bg-error-container/10 px-5 py-4 flex flex-col gap-3"
    >
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-error">
          warning
        </span>
        <h2 className="font-headline text-lg font-bold text-on-surface">File issues</h2>
      </header>
      <ul className="flex flex-col gap-2">
        {errors.map((error, index) => (
          <li key={`${error.filename}-${index}`} className="text-sm text-on-surface font-body">
            <span className="font-mono">{error.filename}</span> — {error.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PrivacyActionBar({
  onReturn,
  onStart,
  disabled,
  ambiguous,
  unmatched
}: {
  onReturn: () => void;
  onStart: () => void;
  disabled: boolean;
  ambiguous: number;
  unmatched: number;
}) {
  return (
    <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-6 py-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
      <div className="flex items-start gap-3 text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-lg mt-0.5">
          shield
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-label text-on-surface">
            Nothing is stored. Images, CSV rows, and results are discarded when you leave.
          </p>
          <p className="text-xs font-body">
            Resolve every ambiguous or unmatched item before processing the batch.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReturn}
          className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Back to Single Review
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          aria-disabled={disabled}
          title={disabled ? disabledTooltip(ambiguous, unmatched) : undefined}
          className={[
            'px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all',
            disabled
              ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
              : 'bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]'
          ].join(' ')}
        >
          Start Batch Review
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            arrow_forward
          </span>
        </button>
      </div>
    </section>
  );
}

function CountCell({
  label,
  value,
  tone = 'neutral'
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'caution' | 'error';
}) {
  const toneClass =
    tone === 'error'
      ? 'border-error/25 bg-error-container/10'
      : tone === 'caution'
        ? 'border-caution/30 bg-caution-container/10'
        : 'border-outline-variant/20 bg-surface-container-lowest';
  return (
    <div className={['rounded-lg border px-4 py-3 flex flex-col gap-1 shadow-ambient', toneClass].join(' ')}>
      <div className="flex items-center gap-2">
        <Dot tone={tone} />
        <span className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
      </div>
      <span className="font-headline text-2xl font-extrabold text-on-surface">{value}</span>
    </div>
  );
}

function Dot({ tone }: { tone: 'neutral' | 'caution' | 'error' }) {
  const color =
    tone === 'error'
      ? 'bg-error'
      : tone === 'caution'
        ? 'bg-caution'
        : 'bg-primary';
  return <span className={['w-2 h-2 rounded-full', color].join(' ')} />;
}

function disabledTooltip(ambiguous: number, unmatched: number): string {
  if (ambiguous > 0 && unmatched > 0) {
    return 'Resolve ambiguous and unmatched items first.';
  }
  if (ambiguous > 0) {
    return 'Resolve ambiguous matches before starting.';
  }
  if (unmatched > 0) {
    return 'Resolve unmatched items before starting.';
  }
  return 'Add label images and one CSV before starting.';
}
