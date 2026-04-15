import { InfoAnchor } from './InfoAnchor';

interface StandaloneBannerProps {
  onRunFullComparison: () => void;
}

export function StandaloneBanner({ onRunFullComparison }: StandaloneBannerProps) {
  return (
    <div
      className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-secondary-container text-on-secondary-container px-6 py-4 rounded-lg"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-secondary flex-shrink-0 mt-0.5"
        >
          info
        </span>
        <p className="font-body text-sm md:text-base flex items-center gap-2 flex-wrap">
          <span>Image only — no application data was provided. Values read from the label are shown below.</span>
          <InfoAnchor anchorKey="standalone-mode" />
        </p>
      </div>
      <button
        type="button"
        onClick={onRunFullComparison}
        className="self-start md:self-auto flex-shrink-0 px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label font-bold text-sm hover:brightness-110 transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Run Full Comparison
      </button>
    </div>
  );
}
