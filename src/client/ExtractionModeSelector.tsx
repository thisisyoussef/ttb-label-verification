import type { ExtractionMode } from './appTypes';

interface ExtractionModeSelectorProps {
  mode: ExtractionMode;
  disabled: boolean;
  onChange: (mode: ExtractionMode) => void;
}

export function ExtractionModeSelector({
  mode,
  disabled,
  onChange
}: ExtractionModeSelectorProps) {
  const icon = mode === 'cloud' ? 'cloud' : 'hard_drive';
  const label = mode === 'cloud' ? 'Cloud' : 'Local';
  const altMode: ExtractionMode = mode === 'cloud' ? 'local' : 'cloud';
  const altLabel = altMode === 'cloud' ? 'Cloud' : 'Local';

  return (
    <div className="flex items-center gap-2">
      <span
        className="material-symbols-outlined text-[14px] text-on-surface-variant/70"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="font-label text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      {disabled ? null : (
        <button
          type="button"
          onClick={() => onChange(altMode)}
          className="font-label text-[10px] font-bold uppercase tracking-widest text-primary hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Switch to {altLabel}
        </button>
      )}
    </div>
  );
}
