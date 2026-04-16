import { type FormEvent, type RefObject } from 'react';

import type { AuthPhase } from './authState';
import { AUTH_IDENTITY } from './authState';
import { PrimaryAuthButton, StatusState } from './AuthScreenPrimitives';

interface AuthScreenCardBodyProps {
  phase: AuthPhase;
  userId: string;
  onUserIdChange: (value: string) => void;
  userIdRef: RefObject<HTMLInputElement | null>;
  onStartPiv: () => void;
  onStartSsoForm: () => void;
  onBackFromSso: () => void;
  onSsoSubmit: (event: FormEvent) => void;
}

export function AuthScreenCardBody({
  phase,
  userId,
  onUserIdChange,
  userIdRef,
  onStartPiv,
  onStartSsoForm,
  onBackFromSso,
  onSsoSubmit
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
