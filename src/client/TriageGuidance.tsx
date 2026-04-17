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

  // User-facing model: collapse fail → review. A reviewer sees one
  // bucket of "needs review" labels (sorted so clear-mismatch ones come
  // first) and one bucket of "looks good" labels.
  const needsReviewCount = summary.fail + summary.review;
  if (needsReviewCount > 0) {
    const failRows = rows.filter((r) => r.status === 'fail');
    const reviewRows = rows.filter((r) => r.status === 'review');
    const blockerCount = failRows.reduce((n, r) => n + r.issues.blocker, 0);
    const lowConfCount = reviewRows.filter((r) => r.confidenceState === 'low-confidence').length;
    const parts: string[] = [];
    if (blockerCount > 0) {
      parts.push(`${blockerCount} clear mismatch${blockerCount === 1 ? '' : 'es'}`);
    }
    if (lowConfCount > 0) {
      parts.push(`${lowConfCount} hard to read`);
    }
    const detail = parts.length > 0
      ? parts.join(' · ')
      : 'small differences worth a second look';

    steps.push({
      filter: 'review',
      headline: `Open ${needsReviewCount} ${needsReviewCount === 1 ? 'label' : 'labels'} that need your review`,
      detail,
      icon: 'visibility',
      iconClass: 'text-caution'
    });
  }

  if (summary.pass > 0 && needsReviewCount > 0) {
    steps.push({
      filter: 'approve',
      headline: `${summary.pass} ${summary.pass === 1 ? 'label' : 'labels'} matched everything`,
      detail: 'spot-check if needed',
      icon: 'check_circle',
      iconClass: 'text-tertiary'
    });
  }

  return steps;
}
