import type {
  BatchDashboardFilter,
  BatchDashboardRow,
  BatchDashboardSummary
} from './batchTypes';

interface TriageGuidanceProps {
  summary: BatchDashboardSummary;
  rows: BatchDashboardRow[];
  onFilterTo: (filter: BatchDashboardFilter) => void;
}

/**
 * Actionable triage guidance that tells the reviewer what to do first,
 * computed from the actual batch results.
 */
export function TriageGuidance({ summary, rows, onFilterTo }: TriageGuidanceProps) {
  const steps = buildTriageSteps(summary, rows);
  if (steps.length === 0) return null;

  return (
    <section
      aria-label="Triage guidance"
      className="rounded-lg bg-surface-container-low border border-outline-variant/20 px-5 py-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[16px] text-on-surface-variant"
        >
          assignment
        </span>
        <h3 className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
          Suggested review order
        </h3>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step.filter} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center text-[11px] font-mono font-bold text-on-surface-variant">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onFilterTo(step.filter)}
                className="text-left text-sm font-body text-on-surface hover:underline"
              >
                <span className="font-semibold">{step.headline}</span>
                {step.detail ? (
                  <span className="text-on-surface-variant"> — {step.detail}</span>
                ) : null}
              </button>
            </div>
            <span
              aria-hidden="true"
              className={`material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5 ${step.iconClass}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {step.icon}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface TriageStep {
  filter: BatchDashboardFilter;
  headline: string;
  detail: string | null;
  icon: string;
  iconClass: string;
}

function buildTriageSteps(
  summary: BatchDashboardSummary,
  rows: BatchDashboardRow[]
): TriageStep[] {
  const steps: TriageStep[] = [];

  if (summary.fail > 0) {
    const failRows = rows.filter((r) => r.status === 'fail');
    const blockerCount = failRows.reduce((n, r) => n + r.issues.blocker, 0);
    const detail = blockerCount > 0
      ? `${blockerCount} blocking ${blockerCount === 1 ? 'issue' : 'issues'} across ${summary.fail} ${summary.fail === 1 ? 'label' : 'labels'}`
      : `${summary.fail} ${summary.fail === 1 ? 'label' : 'labels'} with deterministic violations`;

    steps.push({
      filter: 'reject',
      headline: `Review ${summary.fail} rejected ${summary.fail === 1 ? 'label' : 'labels'}`,
      detail,
      icon: 'cancel',
      iconClass: 'text-error'
    });
  }

  if (summary.review > 0) {
    const reviewRows = rows.filter((r) => r.status === 'review');
    const lowConfCount = reviewRows.filter((r) => r.confidenceState === 'low-confidence').length;
    const detail = lowConfCount > 0
      ? `${lowConfCount} flagged due to low extraction confidence`
      : 'cosmetic mismatches or advisory issues flagged by rules';

    steps.push({
      filter: 'review',
      headline: `Check ${summary.review} flagged ${summary.review === 1 ? 'label' : 'labels'}`,
      detail,
      icon: 'warning',
      iconClass: 'text-caution'
    });
  }

  if (summary.pass > 0 && (summary.fail > 0 || summary.review > 0)) {
    steps.push({
      filter: 'approve',
      headline: `${summary.pass} ${summary.pass === 1 ? 'label' : 'labels'} passed all checks`,
      detail: 'spot-check if needed',
      icon: 'check_circle',
      iconClass: 'text-tertiary'
    });
  }

  return steps;
}
