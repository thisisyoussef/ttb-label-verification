import { InfoAnchor } from './InfoAnchor';

interface ConfidenceMeterProps {
  confidence: number;
  label?: string;
  showHelp?: boolean;
}

const ESCALATION_THRESHOLD = 0.7;
const AMBER_THRESHOLD = 0.9;

export function ConfidenceMeter({
  confidence,
  label = 'Confidence',
  showHelp = true
}: ConfidenceMeterProps) {
  const pct = Math.max(0, Math.min(1, confidence));
  const display = Math.round(pct * 100);

  const fillClass =
    pct >= AMBER_THRESHOLD
      ? 'bg-tertiary'
      : pct >= ESCALATION_THRESHOLD
        ? 'bg-caution'
        : 'bg-error';

  const widthStyle = { width: `${display}%` } as const;
  const isLow = pct < ESCALATION_THRESHOLD;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
          {label}
          {showHelp ? <InfoAnchor anchorKey="confidence-indicator" /> : null}
        </span>
        <span className="font-mono text-xs font-bold text-on-surface">{display}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={display}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${display} percent`}
        className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden"
      >
        <div className={`h-full ${fillClass}`} style={widthStyle} />
      </div>
      {isLow ? <EscalationCallout confidence={pct} /> : null}
    </div>
  );
}

function EscalationCallout({ confidence }: { confidence: number }) {
  const reason =
    confidence < 0.4
      ? 'The image may be too blurry or obscured to read reliably.'
      : 'Some extracted text may be uncertain — partial matches or ambiguous characters.';

  return (
    <div
      role="note"
      className="flex items-start gap-2 mt-1 px-3 py-2 rounded bg-error-container/15 border border-error/15"
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-[14px] text-error mt-0.5 flex-shrink-0"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        visibility
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-label font-bold uppercase tracking-wider text-error">
          Manual verification recommended
        </span>
        <span className="text-xs font-body text-on-surface-variant leading-relaxed">
          {reason} Verify the extracted values against the physical label before relying on
          this result.
        </span>
      </div>
    </div>
  );
}
