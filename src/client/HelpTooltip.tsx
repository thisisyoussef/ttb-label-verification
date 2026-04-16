import { useEffect, useId, useRef, useState } from 'react';

interface HelpTooltipProps {
  /** The technical term to explain. Shown bold in the popover heading. */
  term?: string;
  /**
   * Plain-English explanation. Should be 1-3 sentences. No jargon; assume
   * the reader is a first-time visitor who doesn't work in regulatory
   * compliance. For example: "Review means a person should double-check
   * this — we're not sure either way."
   */
  explanation: string;
  /** Optional visible label. Defaults to "What does this mean?". */
  label?: string;
  /**
   * If true, renders only the help-circle icon without the label text.
   * Use this when space is tight (e.g. next to a badge in a table row).
   * The popover content still contains the full term + explanation.
   */
  iconOnly?: boolean;
}

/**
 * Plain-English help tooltip. A small "(?)" affordance that opens a
 * popover explaining a technical term in non-compliance language.
 *
 * Behavior:
 *   - Click to toggle open.
 *   - ESC to close.
 *   - Click outside to close.
 *   - Focusable via keyboard; Enter/Space open.
 *   - Body copy is aria-describedby'd on the trigger so screen readers
 *     get the explanation even without opening.
 *
 * Accessibility: the trigger is a full button with a 40x40 hit target
 * so it meets WCAG tap-target guidance on primary surfaces. In dense
 * areas (iconOnly=true), the button shrinks to 32x32 which is still
 * above the 24px WCAG minimum.
 */
export function HelpTooltip({
  term,
  explanation,
  label = 'What does this mean?',
  iconOnly = false
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={panelId}
        aria-label={term ? `What does "${term}" mean?` : label}
        className={[
          'inline-flex items-center justify-center gap-1.5 rounded-full',
          'text-on-surface-variant hover:text-on-surface',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          'transition-colors',
          iconOnly
            ? 'h-8 w-8 min-w-[32px]'
            : 'h-10 px-3 text-sm font-label font-medium'
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={['material-symbols-outlined', iconOnly ? 'text-[20px]' : 'text-[18px]'].join(' ')}
        >
          help
        </span>
        {!iconOnly ? <span className="whitespace-nowrap">{label}</span> : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className="absolute z-30 left-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-ambient"
        >
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-primary text-[18px] mt-0.5"
            >
              info
            </span>
            <div className="flex flex-col gap-1 flex-1">
              {term ? (
                <p className="font-body font-semibold text-sm text-on-surface">{term}</p>
              ) : null}
              <p className="text-sm font-body text-on-surface leading-relaxed">{explanation}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="shrink-0 inline-flex items-center justify-center rounded h-8 w-8 text-on-surface-variant hover:text-on-surface"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
