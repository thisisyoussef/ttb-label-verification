interface SessionTimeoutModalProps {
  open: boolean;
  remainingSeconds: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

export function SessionTimeoutModal({
  open,
  remainingSeconds,
  onStaySignedIn,
  onSignOut
}: SessionTimeoutModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-description"
        className="w-full max-w-md rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-ambient"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[24px] text-primary"
          >
            schedule
          </span>
          <div className="space-y-2">
            <h2
              id="session-timeout-title"
              className="font-headline text-lg font-bold text-on-surface"
            >
              Your session is about to timeout
            </h2>
            <p
              id="session-timeout-description"
              className="text-sm leading-6 text-on-surface-variant"
            >
              For security, this prototype signs out after 15 minutes of inactivity.
              You will be signed out in {remainingSeconds} second
              {remainingSeconds === 1 ? '' : 's'} unless you choose to stay signed in.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-outline-variant/30 px-4 py-2 text-sm font-label font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onStaySignedIn}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-label font-semibold text-on-primary hover:brightness-110 transition-all"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
