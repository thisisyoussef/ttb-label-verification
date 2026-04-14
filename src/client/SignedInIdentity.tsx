import { useEffect, useState } from 'react';
import { AUTH_IDENTITY } from './authState';

interface SignedInIdentityProps {
  onSignOut: () => void;
}

export function SignedInIdentity({ onSignOut }: SignedInIdentityProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const handle = window.setTimeout(() => setConfirming(false), 4500);
    return () => window.clearTimeout(handle);
  }, [confirming]);

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="hidden md:inline-block h-6 w-px bg-outline-variant/40" />
      <span className="font-label text-xs font-semibold text-on-surface-variant">
        {AUTH_IDENTITY.name} · {AUTH_IDENTITY.division}
      </span>
      {confirming ? (
        <div
          role="group"
          aria-label="Confirm sign out"
          className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-1.5"
        >
          <span className="text-[11px] font-label text-on-surface">
            Sign out and clear this session?
          </span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-3 py-1 rounded text-[11px] font-label font-bold uppercase tracking-widest bg-error text-on-error hover:brightness-110 transition-all"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Sign out"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-label font-bold uppercase tracking-widest bg-surface-container-lowest text-on-surface border border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
            logout
          </span>
          Sign out
        </button>
      )}
    </div>
  );
}
