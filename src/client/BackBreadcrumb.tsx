interface BackBreadcrumbProps {
  onBack: () => void;
  label: string;
  ariaLabel: string;
  rightSlot?: React.ReactNode;
}

export function BackBreadcrumb({
  onBack,
  label,
  ariaLabel,
  rightSlot
}: BackBreadcrumbProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="bg-surface-container-low border-b border-outline-variant/15"
    >
      <div className="w-full px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={ariaLabel}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-label font-semibold bg-surface-container-lowest text-on-surface border border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[44px]"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            arrow_back
          </span>
          {label}
        </button>
        {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
      </div>
    </nav>
  );
}

