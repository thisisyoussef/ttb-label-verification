import type { ReactNode } from 'react';

interface PrimaryAuthButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

export function PrimaryAuthButton({
  children,
  onClick,
  type = 'button'
}: PrimaryAuthButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg text-sm font-label font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </button>
  );
}

interface StatusStateProps {
  icon: string;
  message: string;
  pulsing?: boolean;
  tone?: 'tertiary';
}

export function StatusState({
  icon,
  message,
  pulsing,
  tone
}: StatusStateProps) {
  const iconClass = tone === 'tertiary' ? 'text-tertiary' : 'text-primary';

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-6">
      <span
        aria-hidden="true"
        className={[
          'material-symbols-outlined text-[36px]',
          iconClass,
          pulsing ? 'animate-pulse motion-reduce:animate-none' : ''
        ].join(' ')}
        style={tone === 'tertiary' ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {icon}
      </span>
      <p className="font-body text-sm text-on-surface text-center max-w-xs leading-relaxed">
        {message}
      </p>
    </div>
  );
}
