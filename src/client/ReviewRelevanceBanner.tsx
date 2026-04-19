import type { ReviewRelevanceResult } from '../shared/contracts/review';

interface ReviewRelevanceBannerProps {
  pending: boolean;
  relevance: ReviewRelevanceResult | null;
  onTryAnotherImage: () => void;
  onContinueAnyway: () => void;
}

export function ReviewRelevanceBanner({
  pending,
  relevance,
  onTryAnotherImage,
  onContinueAnyway
}: ReviewRelevanceBannerProps) {
  if (pending) {
    return (
      <div
        role="status"
        className="mt-3 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
      >
        Quick scan checking whether this looks like a readable alcohol label.
      </div>
    );
  }

  if (!relevance || relevance.decision !== 'unlikely-label') {
    return null;
  }

  return (
    <section
      role="alert"
      aria-label="Quick scan could not confirm this upload is a readable alcohol label"
      className="mt-3 rounded-lg border border-secondary/25 bg-surface-container-low px-4 py-4 flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-secondary text-[20px] mt-0.5"
        >
          visibility_off
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="font-body text-base font-bold text-on-surface">
            This doesn&apos;t look like a readable alcohol label yet.
          </h3>
          <p className="text-sm text-on-surface-variant max-w-xl">
            {relevance.summary} Verify is paused until you choose to continue or replace
            the image.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onTryAnotherImage}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-surface-container-lowest text-on-surface ring-1 ring-outline-variant/20 hover:ring-primary hover:bg-primary-container/30 transition-all"
        >
          Try another image
        </button>
        <button
          type="button"
          onClick={onContinueAnyway}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-container text-on-secondary-container hover:brightness-105 transition-all"
        >
          Continue anyway
        </button>
      </div>
    </section>
  );
}
