import { FieldEvidencePanel } from './FieldEvidence';
import { StatusBadge } from './StatusBadge';
import { WarningEvidencePanel } from './WarningEvidence';
import type { CheckReview } from './types';

interface FieldRowProps {
  check: CheckReview;
  expanded: boolean;
  onToggle: () => void;
  standalone: boolean;
  rowRef?: (node: HTMLButtonElement | null) => void;
  onKeyNav?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

const STATUS_BORDER: Record<CheckReview['status'], string> = {
  pass: 'border-tertiary/40',
  review: 'border-caution',
  fail: 'border-error',
  info: 'border-secondary'
};

export function FieldRow({
  check,
  expanded,
  onToggle,
  standalone,
  rowRef,
  onKeyNav
}: FieldRowProps) {
  const isWarning = check.id === 'government-warning';
  const panelId = `${check.id}-panel`;

  return (
    <article
      className={[
        'bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden ring-1 ring-outline-variant/15 border-l-4',
        STATUS_BORDER[check.status]
      ].join(' ')}
    >
      <button
        ref={rowRef}
        type="button"
        onClick={onToggle}
        onKeyDown={onKeyNav}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-surface-container-low/60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      >
        <span
          aria-hidden="true"
          className={[
            'material-symbols-outlined text-on-surface-variant transition-transform duration-200 motion-reduce:transition-none',
            expanded ? 'rotate-90' : ''
          ].join(' ')}
        >
          chevron_right
        </span>
        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 min-w-0">
          <span className="md:w-[30%] shrink-0 font-body font-semibold text-on-surface">
            {check.label}
          </span>
          {!standalone ? (
            <span className="md:w-[25%] shrink-0 font-mono text-xs text-on-surface-variant truncate">
              {check.applicationValue || '—'}
            </span>
          ) : null}
          <span className="flex-1 font-mono text-xs text-on-surface truncate min-w-0">
            {check.extractedValue || '—'}
          </span>
          <span className="shrink-0 flex md:justify-end">
            <StatusBadge status={check.status} size="sm" />
          </span>
        </div>
      </button>
      {expanded ? (
        <div id={panelId} className="border-t border-outline-variant/15 bg-surface-container-low/40">
          {isWarning && check.warning ? (
            <WarningEvidencePanel check={check} />
          ) : (
            <FieldEvidencePanel check={check} standalone={standalone} />
          )}
        </div>
      ) : null}
    </article>
  );
}
