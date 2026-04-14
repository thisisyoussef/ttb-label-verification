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
            'material-symbols-outlined text-on-surface-variant transition-transform duration-200',
            expanded ? 'rotate-90' : ''
          ].join(' ')}
        >
          chevron_right
        </span>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center">
          <span className="md:col-span-4 font-body font-semibold text-on-surface">
            {check.label}
          </span>
          {!standalone ? (
            <span className="md:col-span-3 font-mono text-xs text-on-surface-variant truncate">
              {check.applicationValue || '—'}
            </span>
          ) : null}
          <span
            className={[
              standalone ? 'md:col-span-8' : 'md:col-span-4',
              'font-mono text-xs text-on-surface truncate'
            ].join(' ')}
          >
            {check.extractedValue || '—'}
          </span>
          <span className={['flex justify-start md:justify-end', standalone ? 'md:col-span-4' : 'md:col-span-1'].join(' ')}>
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
