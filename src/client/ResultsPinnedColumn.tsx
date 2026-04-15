import { useCallback, useEffect, useRef, useState } from 'react';
import { InfoAnchor } from './InfoAnchor';
import type { BeverageSelection, LabelImage } from './types';

const BEVERAGE_LABELS: Record<BeverageSelection, string> = {
  auto: 'Auto-detect',
  'distilled-spirits': 'Distilled Spirits',
  'malt-beverage': 'Malt Beverage',
  wine: 'Wine',
  unknown: 'Unknown'
};

interface ResultsPinnedColumnProps {
  image: LabelImage;
  beverage: BeverageSelection;
}

export function ResultsPinnedColumn({ image, beverage }: ResultsPinnedColumnProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const isPdf = image.file.type === 'application/pdf';

  return (
    <aside className="md:col-span-4 lg:col-span-3 bg-surface-container-low p-4 lg:p-6 xl:p-8 flex flex-col gap-4 xl:gap-6 border-r border-outline-variant/15 overflow-y-auto">
      <h2 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        Intake context
      </h2>

      {isPdf ? (
        <div className="aspect-[3/4] bg-surface-container-highest rounded-lg flex items-center justify-center">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-5xl text-on-surface-variant"
          >
            picture_as_pdf
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="relative group w-full cursor-zoom-in rounded-lg overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="View full-size label image"
        >
          <img
            alt="Submitted label thumbnail"
            src={image.previewUrl}
            className="w-full aspect-[3/4] object-cover bg-surface-container-highest transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-on-surface/0 group-hover:bg-on-surface/30 transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">
              zoom_in
            </span>
          </div>
        </button>
      )}

      <dl className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
            Filename
          </dt>
          <dd className="font-mono text-sm font-semibold text-on-surface break-all">
            {image.file.name}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
            Size
          </dt>
          <dd className="font-body text-sm text-on-surface">{image.sizeLabel}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
            Beverage type
          </dt>
          <dd>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label text-sm font-bold">
              {BEVERAGE_LABELS[beverage]}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-auto pt-6 border-t border-outline-variant/15 text-xs text-on-surface-variant leading-relaxed flex items-center gap-2 flex-wrap">
        <span>Nothing is stored. Inputs and results are discarded when you leave.</span>
        <InfoAnchor anchorKey="no-persistence" placement="bottom" />
      </p>

      {overlayOpen ? (
        <LabelImageOverlay
          image={image}
          onClose={() => setOverlayOpen(false)}
        />
      ) : null}
    </aside>
  );
}

function LabelImageOverlay({
  image,
  onClose
}: {
  image: LabelImage;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      lastFocusedRef.current?.focus();
    };
  }, [handleClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-size label image"
      onClick={handleClose}
      className="fixed inset-0 z-[60] bg-on-surface/80 backdrop-blur-sm flex items-center justify-center px-6 py-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface-container-lowest rounded-xl shadow-ambient max-w-[min(960px,92vw)] max-h-[92vh] flex flex-col overflow-hidden"
      >
        <header className="flex items-center gap-4 px-5 py-3 border-b border-outline-variant/15 bg-surface-container-low">
          <div className="min-w-0 flex-grow">
            <h2 className="font-mono text-sm text-on-surface truncate font-semibold">
              {image.file.name}
            </h2>
            <p className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
              {image.sizeLabel}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Close
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              close
            </span>
          </button>
        </header>
        <div className="flex-grow flex items-center justify-center bg-surface-container-low p-6 min-h-0">
          <img
            alt={`Full-size preview of ${image.file.name}`}
            src={image.previewUrl}
            className="max-w-full max-h-[70vh] object-contain rounded shadow-ambient bg-surface-container-lowest"
          />
        </div>
        <footer className="px-5 py-2 border-t border-outline-variant/15 bg-surface-container-low text-[11px] font-label text-on-surface-variant">
          Press <kbd className="font-mono font-bold text-on-surface">Esc</kbd> or click outside to
          close.
        </footer>
      </div>
    </div>
  );
}
