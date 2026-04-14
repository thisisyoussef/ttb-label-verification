import type { CheckStatus } from './types';

interface StatusBadgeProps {
  status: CheckStatus;
  size?: 'sm' | 'md';
}

const STATUS_COPY: Record<CheckStatus, string> = {
  pass: 'Pass',
  review: 'Review',
  fail: 'Fail',
  info: 'Info'
};

const STATUS_ICON: Record<CheckStatus, string> = {
  pass: 'check_circle',
  review: 'warning',
  fail: 'cancel',
  info: 'info'
};

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: 'bg-tertiary-container/40 text-on-tertiary-container',
  review: 'bg-caution-container text-on-caution-container',
  fail: 'bg-error-container/40 text-on-error-container',
  info: 'bg-secondary-container text-on-secondary-container'
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizing =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-[10px] gap-1'
      : 'px-3 py-1 text-xs gap-1.5';
  const iconSize = size === 'sm' ? 'text-[14px]' : 'text-[16px]';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-label font-bold uppercase tracking-wider',
        sizing,
        STATUS_CLASS[status]
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined ${iconSize}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {STATUS_ICON[status]}
      </span>
      <span>{STATUS_COPY[status]}</span>
    </span>
  );
}
