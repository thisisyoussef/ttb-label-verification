import { InfoAnchor } from './InfoAnchor';
import { StatusBadge } from './StatusBadge';
import { WarningDiff } from './WarningDiff';
import { plainifyReason, toDisplayStatus } from './reviewDisplayAdapter';
import type { CheckReview } from './types';

interface WarningEvidencePanelProps {
  check: CheckReview;
}

export function WarningEvidencePanel({ check }: WarningEvidencePanelProps) {
  const warning = check.warning;
  if (!warning) return null;

  return (
    <div
      data-tour-target="tour-warning-row"
      className="flex flex-col gap-8 px-6 md:px-8 pt-4 pb-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="flex flex-col gap-4">
          <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-2 flex items-center gap-2">
            <span>Sub-checks</span>
            <InfoAnchor anchorKey="warning-evidence" />
          </h4>
          <ul className="flex flex-col gap-3">
            {warning.subChecks.map((sub) => {
              const displayStatus = toDisplayStatus(sub.status);
              return (
                <li key={sub.id} className="flex items-start gap-3">
                  <SubCheckIcon status={sub.status} />
                  <div className="flex-1">
                    <p className="font-body text-sm font-semibold text-on-surface">{sub.label}</p>
                    <p
                      className={[
                        'text-xs mt-0.5',
                        displayStatus === 'review'
                          ? 'text-on-caution-container'
                          : 'text-on-surface-variant'
                      ].join(' ')}
                    >
                      {plainifyReason(sub.reason ?? '')}
                    </p>
                  </div>
                  <StatusBadge status={sub.status} size="sm" />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-4 bg-surface-container-low rounded-lg p-5">
          <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Regulatory reference
          </h4>
          <ul className="flex flex-col gap-1">
            {check.citations.map((citation) => (
              <li key={citation} className="font-mono text-xs text-on-surface">
                {citation}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          Text comparison
        </h4>
        <WarningDiff segments={warning.segments} />
      </section>
    </div>
  );
}

function SubCheckIcon({ status }: { status: CheckReview['status'] }) {
  const common = 'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5';
  const icon =
    status === 'pass'
      ? 'check'
      : status === 'fail'
        ? 'close'
        : status === 'review'
          ? 'schedule'
          : 'info';
  const skin =
    status === 'pass'
      ? 'bg-tertiary-container text-on-tertiary-container'
      : status === 'fail'
        ? 'bg-error text-on-error'
        : status === 'review'
          ? 'bg-caution-container text-on-caution-container'
          : 'bg-secondary-container text-on-secondary-container';

  return (
    <div className={`${common} ${skin}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
        {icon}
      </span>
    </div>
  );
}
