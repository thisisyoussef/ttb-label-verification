import {
  DISPLAY_STATUS_COPY,
  resolveCheckBadge,
  toDisplayStatus,
  type DisplayCheckStatus
} from './reviewDisplayAdapter';
import type { CheckReview, CheckStatus } from './types';

interface StatusBadgeProps {
  /**
   * Either a raw status (legacy callers — renders the static
   * DISPLAY_STATUS_COPY entry) or a full CheckReview (preferred —
   * lets the badge show "Found on label" for pass-status rows whose
   * application field was left blank, instead of the misleading
   * "Matches").
   */
  status?: CheckStatus;
  check?: CheckReview;
  size?: 'sm' | 'md';
}

// Display-only classes — the engine's `fail` never surfaces here; it
// collapses to `review` via toDisplayStatus. See reviewDisplayAdapter
// for the rationale (tool is guiding, not gating).
const STATUS_CLASS: Record<DisplayCheckStatus, string> = {
  pass: 'bg-tertiary-container/40 text-on-tertiary-container',
  review: 'bg-caution-container text-on-caution-container',
  info: 'bg-secondary-container text-on-secondary-container'
};

export function StatusBadge({ status, check, size = 'md' }: StatusBadgeProps) {
  const effectiveStatus: CheckStatus = check ? check.status : (status ?? 'info');
  const displayStatus = toDisplayStatus(effectiveStatus);
  const { label, icon } = check
    ? resolveCheckBadge(check)
    : DISPLAY_STATUS_COPY[displayStatus];
  const sizing =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-xs gap-1'
      : 'px-3 py-1 text-sm gap-1.5';
  const iconSize = size === 'sm' ? 'text-[16px]' : 'text-[18px]';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-label font-bold uppercase tracking-wider',
        sizing,
        STATUS_CLASS[displayStatus]
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined ${iconSize}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}
