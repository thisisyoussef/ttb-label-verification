import { useEffect, useRef, useState } from 'react';
import type { AuthPhase } from './authState';
import { AUTH_IDENTITY, getAuthAutoAdvanceDelay } from './authState';

interface AuthScreenProps {
  phase: AuthPhase;
  onStartPiv: () => void;
  onStartSsoForm: () => void;
  onBackFromSso: () => void;
  onSubmitSso: () => void;
  onPhaseComplete: () => void;
}

export function AuthScreen({
  phase,
  onStartPiv,
  onStartSsoForm,
  onBackFromSso,
  onSubmitSso,
  onPhaseComplete
}: AuthScreenProps) {
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const userIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'sso-form') {
      userIdRef.current?.focus();
    }
  }, [phase]);

  useEffect(() => {
    const delay = getAuthAutoAdvanceDelay(phase);
    if (delay === null) return undefined;

    const handle = window.setTimeout(onPhaseComplete, delay);
    return () => window.clearTimeout(handle);
  }, [phase, onPhaseComplete]);

  const handleSsoSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmitSso();
  };

  return (
    <div className="min-h-full flex flex-col bg-background">
      <GovernmentBanner
        open={disclosureOpen}
        onToggle={() => setDisclosureOpen((prev) => !prev)}
      />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <section
          role="main"
          aria-labelledby="auth-card-heading"
          className="w-full max-w-[440px] bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-ambient flex flex-col"
        >
          <header className="px-8 pt-8 pb-6">
            <h1
              id="auth-card-heading"
              className="font-headline text-2xl font-extrabold text-on-surface tracking-tight"
            >
              TTB Label Verification System
            </h1>
            <p className="mt-2 font-body text-sm text-on-surface-variant leading-relaxed">
              Alcohol Labeling and Formulation Division — Internal Use Only.
            </p>
          </header>
          <div className="h-px w-full bg-outline-variant/15" />
          <div className="px-8 py-6">
            <CardBody
              phase={phase}
              userId={userId}
              onUserIdChange={setUserId}
              userIdRef={userIdRef}
              onStartPiv={onStartPiv}
              onStartSsoForm={onStartSsoForm}
              onBackFromSso={onBackFromSso}
              onSsoSubmit={handleSsoSubmit}
            />
          </div>
          <footer className="px-8 pb-8 flex flex-col gap-1.5">
            <p className="font-body text-xs text-on-surface-variant leading-relaxed">
              This is a prototype. It is not a production Treasury system.
            </p>
            <p className="font-body text-[11px] text-on-surface-variant/80 leading-relaxed">
              Every path below is simulated. Any card, user ID, or input will pass through into the demo app.
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}

function GovernmentBanner({
  open,
  onToggle
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      aria-label="Government website banner"
      className="w-full bg-surface-container-low border-b border-outline-variant/20"
    >
      <div className="max-w-[1400px] mx-auto w-full px-6 py-2 flex items-center justify-between gap-3">
        <p className="font-label text-[11px] text-on-surface-variant flex items-center gap-2 flex-wrap">
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1 font-bold uppercase tracking-widest text-caution"
          >
            <span className="material-symbols-outlined text-[14px]">science</span>
            Prototype
          </span>
          <span>
            Not an official U.S. government website — this is a demo of an internal tool.
          </span>
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-[11px] font-label font-bold uppercase tracking-widest text-primary hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          What would appear here
          <span
            aria-hidden="true"
            className={[
              'material-symbols-outlined text-[14px] transition-transform duration-150 motion-reduce:transition-none',
              open ? 'rotate-180' : ''
            ].join(' ')}
          >
            expand_more
          </span>
        </button>
      </div>
      {open ? (
        <div className="max-w-[1400px] mx-auto w-full px-6 pb-3">
          <p className="text-[11px] text-on-surface-variant font-body leading-relaxed max-w-2xl">
            In production, the official U.S. government identity banner (with the
            standard "An official website of the United States government" line
            and the `Here's how you know` disclosure) would appear here. This
            prototype deliberately does not reproduce it so there is no chance of
            mistaking the demo for a real government portal.
          </p>
        </div>
      ) : null}
    </section>
  );
}

interface CardBodyProps {
  phase: AuthPhase;
  userId: string;
  onUserIdChange: (value: string) => void;
  userIdRef: React.RefObject<HTMLInputElement | null>;
  onStartPiv: () => void;
  onStartSsoForm: () => void;
  onBackFromSso: () => void;
  onSsoSubmit: (event: React.FormEvent) => void;
}

function CardBody({
  phase,
  userId,
  onUserIdChange,
  userIdRef,
  onStartPiv,
  onStartSsoForm,
  onBackFromSso,
  onSsoSubmit
}: CardBodyProps) {
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
      <form
        onSubmit={onSsoSubmit}
        className="flex flex-col gap-3"
      >
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
        <button
          type="submit"
          className="mt-2 inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg text-sm font-label font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Continue
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </button>
      </form>
    );
  }
  // signed-out (entry)
  return (
    <div className="flex flex-col gap-3">
      <SignInButton icon="badge" onClick={onStartPiv}>
        Sign in with PIV / CAC Card
      </SignInButton>
      <SignInButton icon="key" onClick={onStartSsoForm}>
        Sign in with Treasury SSO
      </SignInButton>
      <p className="mt-1 text-[11px] font-label text-on-surface-variant flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[14px] text-caution"
        >
          info
        </span>
        Mock auth — either path simulates success. No real credentials are
        checked.
      </p>
    </div>
  );
}

function SignInButton({
  icon,
  onClick,
  children
}: {
  icon: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg text-sm font-label font-bold uppercase tracking-widest bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
        {icon}
      </span>
      {children}
    </button>
  );
}

function StatusState({
  icon,
  message,
  pulsing,
  tone
}: {
  icon: string;
  message: string;
  pulsing?: boolean;
  tone?: 'tertiary';
}) {
  const iconClass = tone === 'tertiary' ? 'text-tertiary' : 'text-primary';
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 py-6"
    >
      <span
        aria-hidden="true"
        className={[
          'material-symbols-outlined text-[36px]',
          iconClass,
          pulsing ? 'animate-pulse motion-reduce:animate-none' : ''
        ].join(' ')}
        style={tone === 'tertiary' ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {icon}
      </span>
      <p className="font-body text-sm text-on-surface text-center max-w-xs leading-relaxed">
        {message}
      </p>
    </div>
  );
}
