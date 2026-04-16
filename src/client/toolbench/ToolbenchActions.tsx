import { useEffect, useState } from 'react';
import type { ExtractionMode, Mode } from '../appTypes';
import {
  readProviderOverride,
  writeProviderOverride,
  type ProviderOverrideChoice
} from '../providerOverride';

interface ToolbenchActionsProps {
  extractionMode: ExtractionMode;
  onReset: () => void;
  onOpenMode: (next: Mode) => void;
  onToggleExtraction: (next: ExtractionMode) => void;
  onLaunchTour: () => void;
}

const PROVIDER_OVERRIDE_OPTIONS: Array<{
  value: ProviderOverrideChoice;
  label: string;
  description: string;
}> = [
  {
    value: 'default',
    label: 'Default',
    description: 'Use the server default (AI_PROVIDER env + fallback chain).'
  },
  {
    value: 'cloud',
    label: 'Force cloud',
    description: 'Route every review through the cloud extractor.'
  },
  {
    value: 'local',
    label: 'Force local',
    description: 'Route every review through the local extractor (Ollama VLM).'
  }
];

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
  extractionMode,
  onReset,
  onOpenMode,
  onToggleExtraction,
  onLaunchTour,
}: ToolbenchActionsProps) {
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<Record<string, unknown> | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [providerOverride, setProviderOverride] =
    useState<ProviderOverrideChoice>('default');

  // Hydrate from localStorage on mount so the toolbench reflects the
  // persisted choice across reloads.
  useEffect(() => {
    setProviderOverride(readProviderOverride());
  }, []);

  const altExtraction: ExtractionMode = extractionMode === 'cloud' ? 'local' : 'cloud';
  const extractionIcon = altExtraction === 'cloud' ? 'cloud' : 'hard_drive';
  const extractionLabel =
    altExtraction === 'cloud' ? 'Use cloud extraction' : 'Use local extraction';

  function handleProviderOverrideChange(next: ProviderOverrideChoice) {
    setProviderOverride(next);
    writeProviderOverride(next);
  }

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
    <div className="flex flex-col gap-1 p-3">
      <ActionButton icon="restart_alt" label="Reset app" onClick={onReset} />
      <ActionButton
        icon="draft"
        label="Open single review"
        onClick={() => onOpenMode('single')}
      />
      <ActionButton
        icon="view_list"
        label="Open batch review"
        onClick={() => onOpenMode('batch')}
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

      <div className="mt-3 rounded border border-outline-variant/30 bg-surface-container-low p-2.5">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[16px] text-on-surface-variant"
          >
            alt_route
          </span>
          <span className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Provider Override
          </span>
        </div>
        <p className="mt-1 text-[10px] font-body text-on-surface-variant leading-relaxed">
          Dev-only. Forces all review and batch requests onto the chosen
          extractor via <code className="font-mono">X-Provider-Override</code>.
          Persisted in localStorage.
        </p>
        <fieldset
          className="mt-2 flex flex-col gap-1"
          aria-label="Force a specific extraction provider"
        >
          {PROVIDER_OVERRIDE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={[
                'flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors',
                providerOverride === option.value
                  ? 'bg-primary/10 text-on-surface'
                  : 'hover:bg-surface-container-high text-on-surface-variant'
              ].join(' ')}
            >
              <input
                type="radio"
                name="ttb-provider-override"
                value={option.value}
                checked={providerOverride === option.value}
                onChange={() => handleProviderOverrideChange(option.value)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="font-body text-xs font-semibold">
                  {option.label}
                </span>
                <span className="font-body text-[10px] leading-snug text-on-surface-variant">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

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
