import { useState } from 'react';
import type { ExtractionMode, Mode } from '../appTypes';

interface ToolbenchActionsProps {
  mode: Mode;
  extractionMode: ExtractionMode;
  onReset: () => void;
  onSwitchMode: (next: Mode) => void;
  onToggleExtraction: (next: ExtractionMode) => void;
  onLaunchTour: () => void;
}

interface ActionButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  loading?: boolean;
}

function ActionButton({ icon, label, onClick, loading = false }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2.5 w-full rounded px-2.5 py-2 text-left text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
        {loading ? 'progress_activity' : icon}
      </span>
      <span className="text-xs font-body font-semibold">{label}</span>
    </button>
  );
}

export function ToolbenchActions({
  mode,
  extractionMode,
  onReset,
  onSwitchMode,
  onToggleExtraction,
  onLaunchTour,
}: ToolbenchActionsProps) {
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<Record<string, unknown> | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const altMode: Mode = mode === 'single' ? 'batch' : 'single';
  const switchIcon = altMode === 'batch' ? 'view_list' : 'draft';
  const switchLabel = altMode === 'batch' ? 'Switch to batch review' : 'Switch to single review';

  const altExtraction: ExtractionMode = extractionMode === 'cloud' ? 'local' : 'cloud';
  const extractionIcon = altExtraction === 'cloud' ? 'cloud' : 'hard_drive';
  const extractionLabel =
    altExtraction === 'cloud' ? 'Use cloud extraction' : 'Use local extraction';

  async function handleHealthCheck() {
    if (healthLoading) return;
    setHealthLoading(true);
    setHealthResult(null);
    setHealthError(null);
    try {
      const res = await fetch('/api/health');
      const json = (await res.json()) as Record<string, unknown>;
      setHealthResult(json);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setHealthLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto p-3">
      <ActionButton icon="restart_alt" label="Reset app" onClick={onReset} />
      <ActionButton
        icon={switchIcon}
        label={switchLabel}
        onClick={() => onSwitchMode(altMode)}
      />
      <ActionButton
        icon={extractionIcon}
        label={extractionLabel}
        onClick={() => onToggleExtraction(altExtraction)}
      />
      <ActionButton icon="help" label="Open help tour" onClick={onLaunchTour} />
      <ActionButton
        icon="monitor_heart"
        label="Check API health"
        onClick={handleHealthCheck}
        loading={healthLoading}
      />

      {healthResult !== null && (
        <div className="mt-2 rounded border border-outline-variant/30 bg-surface-dim p-2">
          <pre className="text-[10px] font-mono text-on-surface-variant whitespace-pre-wrap break-all">
            {JSON.stringify(healthResult, null, 2)}
          </pre>
        </div>
      )}

      {healthError !== null && (
        <div className="mt-2 rounded border border-outline-variant/30 bg-surface-dim p-2">
          <p className="text-[10px] font-mono text-on-surface-variant">{healthError}</p>
        </div>
      )}
    </div>
  );
}
