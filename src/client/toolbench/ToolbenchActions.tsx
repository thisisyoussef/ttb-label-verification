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
  /**
   * Server-advertised capability: is the Local extractor track
   * available on this deployment? Ollama / in-process VLM runs only
   * on local dev machines — on Railway production the AI_EXTRACTION_
   * MODE_ALLOW_LOCAL env is false, so the server reports
   * allowLocal: false and we hide the "Force local" option here.
   * Starts as `null` (unknown) so the radio list doesn't flicker
   * between "all three options" and "two options" on mount.
   */
  const [allowLocal, setAllowLocal] = useState<boolean | null>(null);

  // Hydrate from localStorage on mount so the toolbench reflects the
  // persisted choice across reloads.
  useEffect(() => {
    setProviderOverride(readProviderOverride());
  }, []);

  // Probe the capability endpoint once. Silent failure — if the probe
  // errors we default to "local disabled" rather than showing an
  // option that would then fail on submission.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/capabilities');
        if (!res.ok) throw new Error(`capabilities HTTP ${res.status}`);
        const payload = (await res.json()) as { allowLocal?: boolean };
        if (cancelled) return;
        setAllowLocal(Boolean(payload.allowLocal));
      } catch {
        if (cancelled) return;
        setAllowLocal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If local was previously chosen but the server now reports
  // allowLocal=false (e.g. the user opened the bundle against the
  // Railway deploy after testing locally), quietly reset to default
  // so outgoing requests don't fail on every submit.
  useEffect(() => {
    if (allowLocal === false && providerOverride === 'local') {
      setProviderOverride('default');
      writeProviderOverride('default');
    }
  }, [allowLocal, providerOverride]);

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
          {PROVIDER_OVERRIDE_OPTIONS.map((option) => {
            // Hide the "Force local" choice when the server advertises
            // local as unavailable (Railway production / staging).
            // Still show it with a reason when the user is on a
            // deployment that could support it but Ollama is off.
            if (option.value === 'local' && allowLocal === false) {
              return null;
            }
            return (
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
            );
          })}
        </fieldset>
        {allowLocal === false ? (
          <p className="mt-2 text-[10px] font-body text-on-surface-variant italic leading-snug">
            Local extraction is not available on this deployment —
            Ollama runs only on local dev machines.
          </p>
        ) : null}
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
