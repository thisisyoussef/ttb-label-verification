import { useEffect, useRef, useState } from 'react';
import { FieldEvidencePanel } from './FieldEvidence';
import { StatusBadge } from './StatusBadge';
import { WarningEvidencePanel } from './WarningEvidence';
import type { CheckReview } from './types';

interface FieldRowProps {
  check: CheckReview;
  expanded: boolean;
  onToggle: () => void;
  standalone: boolean;
  /**
   * Row-level refine (Option C). `true` when a second-pass verification
   * call is in flight AND this row is one of the identifier fields the
   * refine pass is targeting. Shows a subtle pulsing indicator next to
   * the status badge so the reviewer can tell the row might update in a
   * moment — especially helpful when they've already expanded evidence.
   */
  refining?: boolean;
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
  refining = false,
  rowRef,
  onKeyNav
}: FieldRowProps) {
  const isWarning = check.id === 'government-warning';
  const panelId = `${check.id}-panel`;

  // Smooth transition when the refine pass completes and the check
  // updates. We track the previous status/value and, when they change
  // while the row is NOT currently refining, pulse a primary ring
  // briefly so the change is visible even if the row is expanded. The
  // pulse clears on a timer so the UI doesn't stay highlighted
  // forever.
  const prevRef = useRef<{ status: string; extractedValue?: string }>({
    status: check.status,
    extractedValue: check.extractedValue
  });
  const [justUpdated, setJustUpdated] = useState(false);
  useEffect(() => {
    const prev = prevRef.current;
    const changed =
      prev.status !== check.status || prev.extractedValue !== check.extractedValue;
    if (changed && !refining) {
      setJustUpdated(true);
      const timer = window.setTimeout(() => setJustUpdated(false), 1800);
      prevRef.current = {
        status: check.status,
        extractedValue: check.extractedValue
      };
      return () => window.clearTimeout(timer);
    }
    prevRef.current = {
      status: check.status,
      extractedValue: check.extractedValue
    };
  }, [check.status, check.extractedValue, refining]);

  return (
    <article
      aria-busy={refining ? true : undefined}
      className={[
        'bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden ring-1 ring-outline-variant/15 border-l-4',
        'transition-all duration-500 motion-reduce:transition-none',
        STATUS_BORDER[check.status],
        justUpdated ? 'ring-2 ring-primary/40' : '',
        refining ? 'bg-primary/[0.02]' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        ref={rowRef}
        type="button"
        onClick={onToggle}
        onKeyDown={onKeyNav}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-surface-container-low/60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] min-h-[56px]"
      >
        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 min-w-0">
          <span className="md:w-[30%] shrink-0 font-body font-semibold text-on-surface">
            {check.label}
          </span>
          {!standalone ? (
            <span className="md:w-[25%] shrink-0 font-mono text-sm text-on-surface-variant truncate">
              {check.applicationValue || '—'}
            </span>
          ) : null}
          <span className="flex-1 font-mono text-sm text-on-surface truncate min-w-0">
            {check.extractedValue || '—'}
          </span>
          <span className="shrink-0 flex items-center gap-2 md:justify-end">
            {refining ? (
              <span
                className="inline-flex items-center gap-1 font-label text-[10px] font-bold uppercase tracking-widest text-primary"
                title="Taking a closer look at this field."
                aria-label="Verifying"
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none"
                />
                Verifying
              </span>
            ) : null}
            <StatusBadge check={check} size="sm" />
          </span>
        </div>
        {/*
          Replace the tiny chevron with an explicit "Show/Hide evidence"
          affordance. A label pairs with the icon so that users who don't
          recognize a chevron as "expandable" still see what the row does.
        */}
        <span
          className={[
            'shrink-0 inline-flex items-center gap-1.5 pl-3 pr-1 text-sm font-label font-semibold transition-colors',
            expanded ? 'text-primary' : 'text-on-surface-variant'
          ].join(' ')}
        >
          <span className="hidden sm:inline whitespace-nowrap">
            {expanded ? 'Hide evidence' : 'Show evidence'}
          </span>
          <span
            aria-hidden="true"
            className={[
              'material-symbols-outlined text-[22px] transition-transform duration-200 motion-reduce:transition-none',
              expanded ? 'rotate-90' : ''
            ].join(' ')}
          >
            chevron_right
          </span>
        </span>
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
