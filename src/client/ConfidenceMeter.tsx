import { InfoAnchor } from './InfoAnchor';

interface ConfidenceMeterProps {
  confidence: number; // 0..1
  label?: string;
  showHelp?: boolean;
}

export function ConfidenceMeter({
  confidence,
  label = 'Confidence',
  showHelp = true
}: ConfidenceMeterProps) {
  const pct = Math.max(0, Math.min(1, confidence));
  const display = Math.round(pct * 100);

  const fillClass =
    pct >= 0.9
      ? 'bg-tertiary'
      : pct >= 0.7
        ? 'bg-caution'
        : 'bg-error';

  const widthStyle = { width: `${display}%` } as const;

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
    </div>
  );
}
