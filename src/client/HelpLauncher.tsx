interface HelpLauncherProps {
  active: boolean;
  showNudge: boolean;
  onLaunch: () => void;
}

export function HelpLauncher({
  active,
  showNudge,
  onLaunch
}: HelpLauncherProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onLaunch}
        aria-pressed={active}
        aria-label="Open guided tour"
        data-tour-target="tour-launcher"
        className={[
          'inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-label font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 border min-h-[44px]',
          active
            ? 'bg-primary-container text-on-primary-container border-primary shadow-ambient'
            : 'bg-surface-container-lowest text-on-surface border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent'
        ].join(' ')}
      >
        {showNudge ? (
          <>
            <span
              aria-hidden="true"
              data-help-indicator="true"
              className="absolute right-2 top-2 flex h-2.5 w-2.5"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary/35" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="sr-only">Tour available</span>
          </>
        ) : null}
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          school
        </span>
        Guided tour
      </button>
    </div>
  );
}
