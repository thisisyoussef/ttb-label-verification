import { useEffect, useRef } from 'react';
import type { BatchLabelImage } from './batch/batchTypes';

interface ImagePreviewOverlayProps {
  image: BatchLabelImage | null;
  onClose: () => void;
}

export function ImagePreviewOverlay({ image, onClose }: ImagePreviewOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!image) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocusedRef.current?.focus();
    };
  }, [image, onClose]);

  if (!image) return null;

  const titleId = 'image-preview-title';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-on-surface/80 backdrop-blur-sm flex items-center justify-center px-6 py-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative bg-surface-container-lowest rounded-xl shadow-ambient max-w-[min(960px,92vw)] max-h-[92vh] flex flex-col overflow-hidden"
      >
        <header className="flex items-center gap-4 px-5 py-3 border-b border-outline-variant/15 bg-surface-container-low">
          <div className="min-w-0 flex-grow">
            <h2
              id={titleId}
              className="font-mono text-sm text-on-surface truncate font-semibold"
            >
              {image.filename}
            </h2>
            <p className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
              {image.sizeLabel}
              {image.isPdf ? ' · PDF' : ''}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Close
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[18px]"
            >
              close
            </span>
          </button>
        </header>
        <div className="flex-grow flex items-center justify-center bg-surface-container-low p-6 min-h-0">
          {image.isPdf ? (
            <div className="flex flex-col items-center gap-3 text-on-surface-variant">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-6xl"
              >
                picture_as_pdf
              </span>
              <p className="font-body text-sm">
                PDF preview is not available yet.
              </p>
            </div>
          ) : image.previewUrl ? (
            <img
              alt={`Preview of ${image.filename}`}
              src={image.previewUrl}
              className="max-w-full max-h-[70vh] object-contain rounded shadow-ambient bg-surface-container-lowest"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-on-surface-variant">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-6xl"
              >
                image
              </span>
              <p className="font-body text-sm">
                No preview available for this image yet.
              </p>
            </div>
          )}
        </div>
        <footer className="px-5 py-2 border-t border-outline-variant/15 bg-surface-container-low text-[11px] font-label text-on-surface-variant">
          Press <kbd className="font-mono font-bold text-on-surface">Esc</kbd> or click
          outside to close. Nothing is stored.
        </footer>
      </div>
    </div>
  );
}
