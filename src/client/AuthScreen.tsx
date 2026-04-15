import { useEffect, useRef, useState } from 'react';
import type { ExtractionMode } from './appTypes';
import type { AuthPhase } from './authState';
import { getAuthAutoAdvanceDelay } from './authState';
import { AuthScreenCardBody } from './AuthScreenCardBody';
import { AuthScreenGovernmentBanner } from './AuthScreenGovernmentBanner';

interface AuthScreenProps {
  phase: AuthPhase;
  sessionExpired?: boolean;
  extractionMode: ExtractionMode;
  onExtractionModeChange: (mode: ExtractionMode) => void;
  onStartPiv: () => void;
  onStartSsoForm: () => void;
  onBackFromSso: () => void;
  onSubmitSso: () => void;
  onPhaseComplete: () => void;
}

export function AuthScreen({
  phase,
  sessionExpired,
  extractionMode,
  onExtractionModeChange,
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
      <AuthScreenGovernmentBanner
        open={disclosureOpen}
        onToggle={() => setDisclosureOpen((prev) => !prev)}
      />
      <main className="flex-1 flex items-center justify-center px-6 py-8 xl:py-12">
        {sessionExpired && phase === 'signed-out' && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-[60px] left-1/2 -translate-x-1/2 z-10 w-full max-w-[440px] px-4"
          >
            <div className="flex items-start gap-3 rounded-lg border border-caution/30 bg-caution/8 px-4 py-3 shadow-ambient">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[20px] text-caution mt-0.5"
              >
                schedule
              </span>
              <div>
                <p className="font-label text-sm font-semibold text-on-surface">
                  Your session has expired
                </p>
                <p className="mt-0.5 font-body text-xs text-on-surface-variant leading-relaxed">
                  You were signed out after 15 minutes of inactivity. Sign in again to continue.
                </p>
              </div>
            </div>
          </div>
        )}
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
            <AuthScreenCardBody
              phase={phase}
              userId={userId}
              extractionMode={extractionMode}
              onExtractionModeChange={onExtractionModeChange}
              onUserIdChange={setUserId}
              userIdRef={userIdRef}
              onStartPiv={onStartPiv}
              onStartSsoForm={onStartSsoForm}
              onBackFromSso={onBackFromSso}
              onSsoSubmit={handleSsoSubmit}
              onContinue={onPhaseComplete}
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
