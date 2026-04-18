import { useState } from 'react';
import { AUTH_IDENTITY } from './authState';

interface SignedInIdentityProps {
  onSignOut: () => void;
}

export function SignedInIdentity({ onSignOut }: SignedInIdentityProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="hidden md:inline-block h-6 w-px bg-outline-variant/40" />
      <span className="font-label text-sm font-semibold text-on-surface">
        {AUTH_IDENTITY.name}
      </span>
      {confirming ? (
        <div
          role="group"
          aria-label="Confirm sign out"
          className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2"
        >
          <span className="text-sm font-label text-on-surface">
            Sign out and clear this session?
          </span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-3 py-2 rounded text-sm font-label font-semibold text-on-surface-variant hover:text-on-surface transition-colors min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 rounded text-sm font-label font-semibold bg-error text-on-error hover:brightness-110 transition-all min-h-[40px]"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Sign out"
          className="inline-flex items-center gap-1.5 px-4 py-3 rounded-lg text-sm font-label font-semibold bg-surface-container-lowest text-on-surface border border-outline-variant/30 shadow-ambient hover:bg-gradient-to-b hover:from-primary hover:to-primary-dim hover:text-on-primary hover:border-transparent active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[44px]"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            logout
          </span>
          Sign out
        </button>
      )}
    </div>
  );
}
