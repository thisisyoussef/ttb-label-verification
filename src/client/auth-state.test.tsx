import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AuthScreen } from './AuthScreen';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { SignedInIdentity } from './SignedInIdentity';
import {
  AUTH_TIMINGS,
  advanceAuthPhase,
  advanceSessionTimeoutCountdown,
  applyMockAuthSignOutReset,
  getSessionTimeoutSeconds,
  getAuthAutoAdvanceDelay
} from './authState';

describe('auth state helpers', () => {
  it('advances the transient auth phases toward signed-in', () => {
    expect(advanceAuthPhase('signed-out')).toBe('signed-out');
    expect(advanceAuthPhase('piv-loading')).toBe('piv-success');
    expect(advanceAuthPhase('piv-success')).toBe('mode-select');
    expect(advanceAuthPhase('sso-form')).toBe('sso-form');
    expect(advanceAuthPhase('sso-loading')).toBe('sso-success');
    expect(advanceAuthPhase('sso-success')).toBe('mode-select');
    expect(advanceAuthPhase('mode-select')).toBe('signed-in');
    expect(advanceAuthPhase('signed-in')).toBe('signed-in');
  });

  it('exposes the phase delay contract used by the auth screen', () => {
    expect(getAuthAutoAdvanceDelay('signed-out')).toBeNull();
    expect(getAuthAutoAdvanceDelay('piv-loading')).toBe(AUTH_TIMINGS.loadingMs);
    expect(getAuthAutoAdvanceDelay('piv-success')).toBe(AUTH_TIMINGS.successMs);
    expect(getAuthAutoAdvanceDelay('sso-form')).toBeNull();
    expect(getAuthAutoAdvanceDelay('sso-loading')).toBe(AUTH_TIMINGS.loadingMs);
    expect(getAuthAutoAdvanceDelay('sso-success')).toBe(AUTH_TIMINGS.successMs);
    expect(getAuthAutoAdvanceDelay('signed-in')).toBeNull();
  });

  it('advances the inactivity timeout countdown in one-second steps', () => {
    expect(advanceSessionTimeoutCountdown(120000)).toBe(119000);
    expect(advanceSessionTimeoutCountdown(500)).toBe(0);
  });

  it('rounds timeout warning copy up to the visible remaining second', () => {
    expect(getSessionTimeoutSeconds(60000)).toBe(60);
    expect(getSessionTimeoutSeconds(59001)).toBe(60);
    expect(getSessionTimeoutSeconds(59000)).toBe(59);
    expect(getSessionTimeoutSeconds(1)).toBe(1);
    expect(getSessionTimeoutSeconds(0)).toBe(1);
  });

  it('orchestrates the full app reset on sign out', () => {
    const setPendingVerifyTourAdvance = vi.fn();
    const resetSingle = vi.fn();
    const resetBatch = vi.fn();
    const resetHelp = vi.fn();
    const setMode = vi.fn();
    const setView = vi.fn();
    const setAuthPhase = vi.fn();

    applyMockAuthSignOutReset({
      setPendingVerifyTourAdvance,
      resetSingle,
      resetBatch,
      resetHelp,
      setMode,
      setView,
      setAuthPhase
    });

    expect(setPendingVerifyTourAdvance).toHaveBeenCalledWith(false);
    expect(resetSingle).toHaveBeenCalledTimes(1);
    expect(resetBatch).toHaveBeenCalledTimes(1);
    expect(resetHelp).toHaveBeenCalledTimes(1);
    expect(setMode).toHaveBeenCalledWith('single');
    expect(setView).toHaveBeenCalledWith('intake');
    expect(setAuthPhase).toHaveBeenCalledWith('signed-out');
  });
});

describe('AuthScreen', () => {
  it('renders the signed-out entry state with the required prototype copy', () => {
    const html = renderToStaticMarkup(
      <AuthScreen
        phase="signed-out"
        extractionMode="local"
        onExtractionModeChange={vi.fn()}
        onStartPiv={vi.fn()}
        onStartSsoForm={vi.fn()}
        onBackFromSso={vi.fn()}
        onSubmitSso={vi.fn()}
        onPhaseComplete={vi.fn()}
      />
    );

    expect(html).toContain('Not an official U.S. government website');
    expect(html).toContain('TTB Label Verification System');
    expect(html).toContain('Sign in with PIV / CAC Card');
    expect(html).toContain('Sign in with Treasury SSO');
    expect(html).toContain('Mock auth — either path simulates success. No real credentials are checked.');
  });

  it('renders the SSO form guidance and placeholder copy', () => {
    const html = renderToStaticMarkup(
      <AuthScreen
        phase="sso-form"
        extractionMode="local"
        onExtractionModeChange={vi.fn()}
        onStartPiv={vi.fn()}
        onStartSsoForm={vi.fn()}
        onBackFromSso={vi.fn()}
        onSubmitSso={vi.fn()}
        onPhaseComplete={vi.fn()}
      />
    );

    expect(html).toContain('User ID');
    expect(html).toContain('Any value (mock auth)');
    expect(html).toContain('Type anything — no real credentials are checked.');
    expect(html).toContain('Continue');
  });

  it('renders the success messaging for both sign-in paths', () => {
    const pivHtml = renderToStaticMarkup(
      <AuthScreen
        phase="piv-success"
        extractionMode="local"
        onExtractionModeChange={vi.fn()}
        onStartPiv={vi.fn()}
        onStartSsoForm={vi.fn()}
        onBackFromSso={vi.fn()}
        onSubmitSso={vi.fn()}
        onPhaseComplete={vi.fn()}
      />
    );
    const ssoHtml = renderToStaticMarkup(
      <AuthScreen
        phase="sso-success"
        extractionMode="local"
        onExtractionModeChange={vi.fn()}
        onStartPiv={vi.fn()}
        onStartSsoForm={vi.fn()}
        onBackFromSso={vi.fn()}
        onSubmitSso={vi.fn()}
        onPhaseComplete={vi.fn()}
      />
    );

    expect(pivHtml).toContain('Certificate verified — Welcome, Sarah Chen.');
    expect(ssoHtml).toContain('Session verified — Welcome, Sarah Chen.');
  });
});

describe('SignedInIdentity', () => {
  it('renders the approved signed-in identity shell affordance', () => {
    const html = renderToStaticMarkup(<SignedInIdentity onSignOut={vi.fn()} />);

    expect(html).toContain('Sarah Chen · ALFD');
    expect(html).toContain('Sign out');
  });
});

describe('SessionTimeoutModal', () => {
  it('renders the government-style timeout warning copy', () => {
    const html = renderToStaticMarkup(
      <SessionTimeoutModal
        open={true}
        remainingSeconds={60}
        onStaySignedIn={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(html).toContain('Your session is about to timeout');
    expect(html).toContain('15 minutes of inactivity');
    expect(html).toContain('You will be signed out in 60 seconds');
    expect(html).toContain('Stay signed in');
  });
});

describe('auth privacy invariants', () => {
  it('keeps the auth files free of durable storage, cookie, and network auth surfaces', () => {
    const combinedSource = [
      readFileSync(new URL('./App.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./AuthScreen.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./AuthScreenCardBody.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./AuthScreenGovernmentBanner.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./AuthScreenPrimitives.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./SignedInIdentity.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./SessionTimeoutModal.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./authState.ts', import.meta.url), 'utf8')
    ].join('\n');

    expect(combinedSource).not.toContain('localStorage');
    expect(combinedSource).not.toContain('sessionStorage');
    expect(combinedSource).not.toContain('document.cookie');
    expect(combinedSource).not.toContain('/api/auth');
    expect(combinedSource).not.toContain('fetch(');
    expect(combinedSource).not.toContain('ttb-auth');
    expect(combinedSource).not.toContain('treasury-sso');
  });
});
