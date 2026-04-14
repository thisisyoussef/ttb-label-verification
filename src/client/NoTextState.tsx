interface NoTextStateProps {
  onTryAnother: () => void;
  onContinueWithCaution: () => void;
}

export function NoTextState({ onTryAnother, onContinueWithCaution }: NoTextStateProps) {
  return (
    <section
      role="alert"
      aria-label="Extraction produced no readable text"
      className="bg-surface-container-low border-l-4 border-secondary rounded-lg p-6 md:p-8 flex flex-col gap-6"
    >
      <div className="flex items-start gap-5">
        <div className="p-3 bg-surface-container-lowest rounded-lg shadow-sm flex-shrink-0">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-secondary text-3xl"
          >
            visibility_off
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-headline text-2xl font-bold text-on-surface">
            We couldn't read enough text from this image.
          </h2>
          <p className="font-body text-on-surface-variant leading-relaxed max-w-2xl">
            The photo may be too blurry, too dark, or cropped. Your inputs are still here —
            nothing was saved.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <button
          type="button"
          onClick={onTryAnother}
          className="flex items-start gap-3 p-5 bg-surface-container-lowest rounded-lg ring-1 ring-outline-variant/15 hover:ring-primary hover:bg-primary-container/40 transition-all text-left group focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-primary group-hover:scale-105 transition-transform"
          >
            add_a_photo
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-body font-bold text-on-surface">Try another image</span>
            <span className="text-xs text-on-surface-variant">
              Clears the current image and keeps your intake fields.
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onContinueWithCaution}
          className="flex items-start gap-3 p-5 bg-surface-container-lowest rounded-lg ring-1 ring-outline-variant/15 hover:ring-secondary hover:bg-secondary-container/40 transition-all text-left group focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-secondary group-hover:scale-105 transition-transform"
          >
            edit_note
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-body font-bold text-on-surface">Continue with caution</span>
            <span className="text-xs text-on-surface-variant">
              Render whatever the system read, flagged as low confidence.
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
