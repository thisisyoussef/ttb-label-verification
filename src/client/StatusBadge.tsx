import {
  DISPLAY_STATUS_COPY,
  toDisplayStatus,
  type DisplayCheckStatus
} from './reviewDisplayAdapter';
import type { CheckStatus } from './types';

interface StatusBadgeProps {
  status: CheckStatus;
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

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const displayStatus = toDisplayStatus(status);
  const { label, icon } = DISPLAY_STATUS_COPY[displayStatus];
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
