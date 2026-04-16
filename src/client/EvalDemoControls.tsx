import type { EvalPack } from './evalDemoApi';
import type { EvalProvider, EvalRunConfig } from './evalDemoTypes';

interface EvalDemoControlsProps {
  packs: EvalPack[];
  config: EvalRunConfig;
  onChange: (next: EvalRunConfig) => void;
  disabled: boolean;
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
  isRunning: boolean;
  canRun: boolean;
}

const PROVIDER_OPTIONS: Array<{
  value: EvalProvider;
  label: string;
  description: string;
  model: string;
}> = [
  {
    value: 'cloud',
    label: 'Cloud',
    description: 'Hosted Gemini via the server AI_PROVIDER=gemini path.',
    model: 'Gemini 2.x VLM'
  },
  {
    value: 'local',
    label: 'Local',
    description: 'Ollama VLM. Requires AI_PROVIDER=local on the server.',
    model: 'Qwen2.5-VL-3B (local)'
  }
];

export function EvalDemoControls(props: EvalDemoControlsProps) {
  const { packs, config, onChange, disabled, onStart, onCancel, onReset, isRunning, canRun } = props;
  const selectedPack = packs.find((pack) => pack.id === config.packId) ?? null;

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-ambient">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-lg text-on-surface">Configuration</h2>
          <p className="text-sm text-on-surface-variant">
            Pick a golden set pack and provider, then run the live eval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-on-error hover:brightness-95"
            >
              Cancel run
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onReset}
                disabled={disabled}
                className="rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onStart}
                disabled={!canRun}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-dim disabled:opacity-50"
              >
                Run eval
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface">
            Golden set pack
          </label>
          <select
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface disabled:opacity-50"
            value={config.packId}
            disabled={disabled || packs.length === 0}
            onChange={(event) => onChange({ ...config, packId: event.target.value })}
          >
            {packs.length === 0 ? (
              <option value="">Loading eval packs…</option>
            ) : (
              packs.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.title} ({pack.imageCount})
                </option>
              ))
            )}
          </select>
          {selectedPack ? (
            <p className="mt-2 text-xs text-on-surface-variant">
              {selectedPack.description}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface">
            Provider
          </label>
          <div className="space-y-2">
            {PROVIDER_OPTIONS.map((option) => {
              const selected = config.provider === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                    selected
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <input
                    type="radio"
                    name="eval-provider"
                    className="mt-1"
                    checked={selected}
                    disabled={disabled}
                    onChange={() =>
                      onChange({ ...config, provider: option.value })
                    }
                  />
                  <div>
                    <div className="font-medium">{option.label} — {option.model}</div>
                    <div className="text-xs opacity-80">{option.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ToggleCard
              title="LLM judgment layer"
              description="Run the OpenAI-based judgment pass after field extraction."
              checked={config.enableJudgment}
              disabled={disabled}
              onToggle={(next) => onChange({ ...config, enableJudgment: next })}
            />
            <ToggleCard
              title="OCR prepass"
              description="Run Tesseract OCR prepass before VLM extraction."
              checked={config.enableOcrPrepass}
              disabled={disabled}
              onToggle={(next) => onChange({ ...config, enableOcrPrepass: next })}
            />
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Toggles are informational — the actual provider + judgment + OCR behavior is
            controlled by the server&apos;s environment (<code>AI_PROVIDER</code>,
            judgment wiring, OCR config). The UI records the chosen configuration for
            demo context.
          </p>
        </div>
      </div>
    </section>
  );
}

function ToggleCard(props: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
        props.checked
          ? 'border-primary bg-primary-container text-on-primary-container'
          : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container'
      }`}
    >
      <input
        type="checkbox"
        className="mt-1"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onToggle(event.target.checked)}
      />
      <div>
        <div className="font-medium">{props.title}</div>
        <div className="text-xs opacity-80">{props.description}</div>
      </div>
    </label>
  );
}
