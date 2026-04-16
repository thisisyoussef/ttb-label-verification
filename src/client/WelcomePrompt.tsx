interface WelcomePromptProps {
  onLaunchTour?: () => void;
}

export function WelcomePrompt({ onLaunchTour }: WelcomePromptProps = {}) {
  return (
    <div className="bg-surface-container-low rounded-lg p-6 flex flex-col gap-4 border border-outline-variant/15">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-[20px] text-primary"
          aria-hidden="true"
        >
          lightbulb
        </span>
        <h2 className="font-headline text-lg font-bold text-on-surface">
          Getting started
        </h2>
      </div>
      <ol className="flex flex-col gap-2 font-body text-sm text-on-surface-variant list-decimal list-inside">
        <li>Drop or browse for a label image.</li>
        <li>
          Fill in the declared values from the COLA application
          <span className="text-on-surface-variant/60"> (or paste JSON)</span>.
        </li>
        <li>Click <strong className="text-on-surface font-semibold">Verify Label</strong>.</li>
      </ol>
      <p className="text-sm text-on-surface-variant font-label">
        You can also upload just the image to check it without application data.
      </p>
      {onLaunchTour ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={onLaunchTour}
            className="inline-flex items-center gap-1 py-3 text-sm font-label font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          >
            Not sure where to start? Take a 60-second tour
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
