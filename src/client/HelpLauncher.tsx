interface HelpLauncherProps {
  active: boolean;
  showNudge: boolean;
  onLaunch: () => void;
  onDismissNudge: () => void;
}

export function HelpLauncher({
  active,
  showNudge,
  onLaunch,
  onDismissNudge
}: HelpLauncherProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onLaunch}
        aria-pressed={active}
        aria-label="Open guided review"
        data-tour-target="tour-launcher"
        className={[
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-label font-bold uppercase tracking-widest transition-all focus-visible:outline-2 focus-visible:outline-offset-2 border',
          active
            ? 'bg-primary-container text-on-primary-container border-primary shadow-ambient'
            : 'bg-surface-container-lowest text-on-surface border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent'
        ].join(' ')}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
          school
        </span>
        Guided review
      </button>
      {showNudge ? (
        <div
          role="status"
          className="absolute top-[calc(100%+10px)] right-0 z-30 w-64 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-ambient p-3 flex flex-col gap-2"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 right-6 w-3 h-3 bg-surface-container-lowest border-l border-t border-outline-variant/30 rotate-45"
          />
          <p className="text-sm text-on-surface font-body">
            New here? Take a 2-minute tour.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onDismissNudge}
              className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={onLaunch}
              className="text-[11px] font-label font-bold uppercase tracking-widest text-primary hover:underline"
            >
              Take the tour
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
