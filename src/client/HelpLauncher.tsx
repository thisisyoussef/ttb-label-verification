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
        aria-label="Open guided tour"
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
        Guided tour
      </button>
      {showNudge ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Guided tour introduction"
          className="absolute top-[calc(100%+12px)] right-0 z-30 w-80 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-ambient p-4 flex flex-col gap-3"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 right-6 w-3 h-3 bg-surface-container-lowest border-l border-t border-outline-variant/30 rotate-45"
          />
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-primary text-[18px] mt-0.5"
            >
              school
            </span>
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
                How this works
              </p>
              <p className="text-sm text-on-surface font-body leading-relaxed">
                AI reads the label. Deterministic rules make every decision. You review the evidence and have the final word.
              </p>
              <p className="text-xs text-on-surface-variant font-mono">
                Nothing is stored. Inputs and results are discarded when you close the tab.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-outline-variant/10 pt-3">
            <button
              type="button"
              onClick={onDismissNudge}
              className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Got it
            </button>
            <button
              type="button"
              onClick={onLaunch}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-label font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 transition-all"
            >
              Take the tour
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
