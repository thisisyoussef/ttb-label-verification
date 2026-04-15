import type { CheckReview } from './types';

interface FocusAreasProps {
  checks: CheckReview[];
  crossFieldChecks: CheckReview[];
  onJumpToCheck: (id: string) => void;
}

const SEVERITY_RANK: Record<CheckReview['severity'], number> = {
  blocker: 0,
  major: 1,
  minor: 2,
  note: 3
};

const SEVERITY_ICON: Record<CheckReview['severity'], string> = {
  blocker: 'block',
  major: 'priority_high',
  minor: 'remove',
  note: 'notes'
};

const SEVERITY_CLASS: Record<CheckReview['severity'], string> = {
  blocker: 'text-error',
  major: 'text-caution',
  minor: 'text-on-surface-variant',
  note: 'text-on-surface-variant'
};

/**
 * Surfaces the 2-3 most critical findings right below the verdict banner,
 * so a reviewer can see what needs attention without expanding every row.
 */
export function FocusAreas({ checks, crossFieldChecks, onJumpToCheck }: FocusAreasProps) {
  const allChecks = [...checks, ...crossFieldChecks];
  const actionable = allChecks.filter(
    (c) => c.status === 'fail' || c.status === 'review'
  );

  if (actionable.length === 0) return null;

  const sorted = [...actionable].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.status === 'fail' ? -1 : 1;
  });

  const top = sorted.slice(0, 3);
  const remaining = sorted.length - top.length;

  return (
    <section
      aria-label="Focus areas"
      className="rounded-lg bg-surface-container-low border border-outline-variant/20 px-5 py-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-on-surface-variant">
          center_focus_strong
        </span>
        <h3 className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
          Where to look first
        </h3>
      </div>
      <ul className="flex flex-col gap-2">
        {top.map((check) => (
          <FocusItem key={check.id} check={check} onJump={onJumpToCheck} />
        ))}
      </ul>
      {remaining > 0 ? (
        <p className="text-xs font-body text-on-surface-variant">
          +{remaining} more {remaining === 1 ? 'item' : 'items'} in the checklist below
        </p>
      ) : null}
    </section>
  );
}

function FocusItem({
  check,
  onJump
}: {
  check: CheckReview;
  onJump: (id: string) => void;
}) {
  const isLowConfidence = check.confidence < 0.7;

  return (
    <li>
      <button
        type="button"
        onClick={() => onJump(check.id)}
        className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container-high/60 transition-colors group focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      >
        <span
          aria-hidden="true"
          className={`material-symbols-outlined text-[16px] mt-0.5 ${SEVERITY_CLASS[check.severity]}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {SEVERITY_ICON[check.severity]}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="font-body text-sm font-semibold text-on-surface">
            {check.label}
            {isLowConfidence ? (
              <span className="ml-2 text-[10px] font-label font-bold uppercase tracking-wider text-caution">
                Low confidence
              </span>
            ) : null}
          </span>
          <span className="text-xs font-body text-on-surface-variant leading-relaxed">
            {check.summary}
          </span>
        </div>
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[14px] text-on-surface-variant/50 group-hover:text-on-surface-variant transition-colors mt-1"
        >
          chevron_right
        </span>
      </button>
    </li>
  );
}
