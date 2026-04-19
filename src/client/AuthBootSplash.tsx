// Shown briefly before AuthScreen so the icon font has time to load —
// otherwise the PIV/SSO buttons flash their raw ligature text (e.g.
// `badge`, `key`) while Material Symbols streams in. No icon font is
// used here on purpose.
export function AuthBootSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading sign-in"
      className="min-h-full flex items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="h-8 w-8 rounded-full border-2 border-outline-variant/30 border-t-primary animate-spin"
        />
        <p className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          Loading…
        </p>
      </div>
    </div>
  );
}
