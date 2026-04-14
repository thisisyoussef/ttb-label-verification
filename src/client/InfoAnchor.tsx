import { useEffect, useRef, useState } from 'react';
import { findInfoPopover } from './helpManifest';
import type { HelpAnchorKey } from './helpManifest';

interface InfoAnchorProps {
  anchorKey: HelpAnchorKey;
  placement?: 'right' | 'bottom';
}

export function InfoAnchor({ anchorKey, placement = 'right' }: InfoAnchorProps) {
  const entry = findInfoPopover(anchorKey);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        anchorRef.current?.querySelector('button')?.focus();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      if (!popoverRef.current || !anchorRef.current) return;
      const target = event.target as Node;
      if (
        !popoverRef.current.contains(target) &&
        !anchorRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const title = entry?.title ?? 'Learn more';
  const body = entry?.body ?? 'Help content is on the way.';
  const disabled = !entry;

  const popoverPositionClass =
    placement === 'bottom'
      ? 'top-full mt-2 left-1/2 -translate-x-1/2'
      : 'left-full ml-2 top-1/2 -translate-y-1/2';
  const tailPositionClass =
    placement === 'bottom'
      ? '-top-1.5 left-1/2 -translate-x-1/2 border-l border-t'
      : '-left-1.5 top-1/2 -translate-y-1/2 border-l border-t rotate-[-45deg]';

  return (
    <span ref={anchorRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={disabled ? 'Help content is on the way' : `Learn about ${title.toLowerCase()}`}
        title={disabled ? 'Help content is on the way.' : `Learn about ${title.toLowerCase()}`}
        className={[
          'inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
          disabled
            ? 'text-outline-variant/50 cursor-not-allowed'
            : 'text-on-surface-variant hover:text-primary hover:bg-primary-container/40'
        ].join(' ')}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
          info
        </span>
      </button>
      {open && !disabled ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={title}
          className={[
            'absolute z-30 w-[320px] bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-ambient p-4 flex flex-col gap-2',
            popoverPositionClass
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'absolute w-3 h-3 bg-surface-container-lowest border-outline-variant/30',
              tailPositionClass
            ].join(' ')}
          />
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-headline text-sm font-bold text-on-surface">{title}</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-on-surface-variant font-body leading-relaxed">
            {body}
          </p>
        </div>
      ) : null}
    </span>
  );
}
