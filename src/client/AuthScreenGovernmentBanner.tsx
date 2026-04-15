interface AuthScreenGovernmentBannerProps {
  open: boolean;
  onToggle: () => void;
}

export function AuthScreenGovernmentBanner({
  open,
  onToggle
}: AuthScreenGovernmentBannerProps) {
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
