import { useState, type FormEvent, type RefObject } from 'react';

import type { ExtractionMode } from './appTypes';
import type { AuthPhase } from './authState';
import { AUTH_IDENTITY } from './authState';
import { PrimaryAuthButton, StatusState } from './AuthScreenPrimitives';

interface AuthScreenCardBodyProps {
  phase: AuthPhase;
  userId: string;
  extractionMode: ExtractionMode;
  onExtractionModeChange: (mode: ExtractionMode) => void;
  onUserIdChange: (value: string) => void;
  userIdRef: RefObject<HTMLInputElement | null>;
  onStartPiv: () => void;
  onStartSsoForm: () => void;
  onBackFromSso: () => void;
  onSsoSubmit: (event: FormEvent) => void;
  onContinue: () => void;
}

export function AuthScreenCardBody({
  phase,
  userId,
  extractionMode,
  onExtractionModeChange,
  onUserIdChange,
  userIdRef,
  onStartPiv,
  onStartSsoForm,
  onBackFromSso,
  onSsoSubmit,
  onContinue
}: AuthScreenCardBodyProps) {
  if (phase === 'piv-loading') {
    return <StatusState icon="hourglass_top" message="Reading PIV card…" pulsing />;
  }
  if (phase === 'piv-success') {
    return (
      <StatusState
        icon="check_circle"
        message={`Certificate verified — Welcome, ${AUTH_IDENTITY.name}.`}
        tone="tertiary"
      />
    );
  }
  if (phase === 'sso-loading') {
    return (
      <StatusState icon="hourglass_top" message="Verifying Treasury SSO session…" pulsing />
    );
  }
  if (phase === 'sso-success') {
    return (
      <StatusState
        icon="check_circle"
        message={`Session verified — Welcome, ${AUTH_IDENTITY.name}.`}
        tone="tertiary"
      />
    );
  }
  if (phase === 'sso-form') {
    return (
      <form onSubmit={onSsoSubmit} className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBackFromSso}
          className="self-start inline-flex items-center gap-1 text-[11px] font-label font-bold uppercase tracking-widest text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
            arrow_back
          </span>
          Back
        </button>
        <label className="flex flex-col gap-1.5">
          <span className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            User ID
          </span>
          <input
            ref={userIdRef}
            type="text"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Any value (mock auth)"
            className="bg-surface-container-lowest border-0 border-b-2 border-outline-variant/20 focus:border-primary focus:ring-0 text-on-surface py-2.5 px-3 rounded-t-sm font-body transition-colors"
          />
          <span className="text-[11px] font-label text-on-surface-variant">
            Type anything — no real credentials are checked.
          </span>
        </label>
        <PrimaryAuthButton type="submit">
          Continue
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </PrimaryAuthButton>
      </form>
    );
  }
  if (phase === 'mode-select') {
    return (
      <AuthScreenModeSelect
        extractionMode={extractionMode}
        onExtractionModeChange={onExtractionModeChange}
        onContinue={onContinue}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PrimaryAuthButton onClick={onStartPiv}>
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          badge
        </span>
        Sign in with PIV / CAC Card
      </PrimaryAuthButton>
      <PrimaryAuthButton onClick={onStartSsoForm}>
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          key
        </span>
        Sign in with Treasury SSO
      </PrimaryAuthButton>
      <p className="mt-1 text-[11px] font-label text-on-surface-variant flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[14px] text-caution"
        >
          info
        </span>
        Mock auth — either path simulates success. No real credentials are checked.
      </p>
    </div>
  );
}

interface AuthScreenModeSelectProps {
  extractionMode: ExtractionMode;
  onExtractionModeChange: (mode: ExtractionMode) => void;
  onContinue: () => void;
}

function AuthScreenModeSelect({
  extractionMode,
  onExtractionModeChange,
  onContinue
}: AuthScreenModeSelectProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="font-body text-sm text-on-surface leading-relaxed">
          Welcome, <span className="font-semibold">{AUTH_IDENTITY.name}</span>.
        </p>
        <p className="font-body text-sm text-on-surface-variant leading-relaxed">
          Choose how this workstation reads label images.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2.5" aria-label="How this workstation reads label images">
        <ModeOption
          value="local"
          icon="hard_drive"
          label="Local (on-premise)"
          description="All label reading runs on this workstation. No label data leaves the network. Required for restricted or air-gapped deployments."
          tooltip="Local mode keeps all data on this workstation. It does not require outbound network access, making it suitable for restricted or air-gapped environments."
          checked={extractionMode === 'local'}
          onChange={() => onExtractionModeChange('local')}
        />
        <ModeOption
          value="cloud"
          icon="cloud"
          label="Cloud (demo)"
          description="Sends label images to a cloud service for higher accuracy on complex labels. Requires outbound network access."
          tooltip="Cloud mode reads labels more accurately, especially for small text, unusual layouts, and government warning formatting. It requires outbound network access."
          checked={extractionMode === 'cloud'}
          onChange={() => onExtractionModeChange('cloud')}
        />
      </fieldset>

      <PrimaryAuthButton onClick={onContinue}>
        Continue to workstation
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          arrow_forward
        </span>
      </PrimaryAuthButton>
    </div>
  );
}

interface ModeOptionProps {
  value: string;
  icon: string;
  label: string;
  description: string;
  tooltip: string;
  checked: boolean;
  onChange: () => void;
}

function ModeOption({
  value,
  icon,
  label,
  description,
  tooltip,
  checked,
  onChange
}: ModeOptionProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <label
      className={[
        'relative flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all',
        checked
          ? 'border-primary bg-primary/5'
          : 'border-outline-variant/30 hover:border-outline-variant/60 hover:bg-surface-container-low/50'
      ].join(' ')}
    >
      <input
        type="radio"
        name="extraction-mode"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 text-primary focus:ring-primary/40"
      />
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <span className="flex items-center gap-2">
          <span
            className={[
              'material-symbols-outlined text-[18px]',
              checked ? 'text-primary' : 'text-on-surface-variant'
            ].join(' ')}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="font-body text-sm font-semibold text-on-surface">{label}</span>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setShowTooltip((previous) => !previous);
            }}
            aria-label={`Why ${label}`}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              help
            </span>
          </button>
        </span>
        <span className="font-body text-xs text-on-surface-variant leading-relaxed">
          {description}
        </span>
        {showTooltip ? (
          <div className="mt-1 p-2.5 bg-surface-container-low rounded border border-outline-variant/20 text-[11px] font-body text-on-surface-variant leading-relaxed">
            {tooltip}
          </div>
        ) : null}
      </div>
    </label>
  );
}
