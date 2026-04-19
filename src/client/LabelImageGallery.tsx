import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LabelImage } from './types';

type GalleryVariant = 'results' | 'processing';

type GalleryEntry = {
  id: 'primary' | 'secondary';
  label: string;
  shortLabel: string;
  image: LabelImage;
};

interface LabelImageGalleryProps {
  primaryImage: LabelImage;
  secondaryImage?: LabelImage | null;
  variant?: GalleryVariant;
}

export function LabelImageGallery({
  primaryImage,
  secondaryImage = null,
  variant = 'results'
}: LabelImageGalleryProps) {
  const images = useMemo<GalleryEntry[]>(
    () => [
      {
        id: 'primary',
        label: 'Image 1',
        shortLabel: 'Image 1',
        image: primaryImage
      },
      ...(secondaryImage
        ? [
            {
              id: 'secondary' as const,
              label: 'Image 2',
              shortLabel: 'Image 2',
              image: secondaryImage
            }
          ]
        : [])
    ],
    [primaryImage, secondaryImage]
  );
  const [activeId, setActiveId] = useState<GalleryEntry['id']>('primary');
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    if (!images.some((entry) => entry.id === activeId)) {
      setActiveId(images[0]?.id ?? 'primary');
    }
  }, [activeId, images]);

  const activeIndex = Math.max(
    0,
    images.findIndex((entry) => entry.id === activeId)
  );
  const activeEntry = images[activeIndex] ?? images[0]!;
  const previewHeightClass =
    variant === 'results'
      ? 'min-h-[300px] max-h-[52vh]'
      : 'min-h-[220px] max-h-[34vh]';
  const thumbHeightClass = variant === 'results' ? 'h-20' : 'h-16';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            {images.length === 2 ? '2 images attached' : '1 image attached'}
          </p>
          <p className="mt-1 text-sm font-semibold text-on-surface">
            {activeEntry.label}
          </p>
          <p className="font-mono text-xs text-on-surface-variant break-all">
            {activeEntry.image.file.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-outline-variant/35 px-3 py-2 text-xs font-label font-bold uppercase tracking-widest text-on-surface hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            open_in_full
          </span>
          Expand
        </button>
      </div>

      <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-ambient">
        <LabelImageCanvas
          image={activeEntry.image}
          alt={`${activeEntry.label} preview`}
          className={previewHeightClass}
        />
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {images.map((entry) => {
            const isActive = entry.id === activeEntry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActiveId(entry.id)}
                aria-pressed={isActive}
                className={[
                  'flex items-center gap-3 rounded-lg border p-2 text-left transition-colors',
                  isActive
                    ? 'border-primary bg-primary-container/15'
                    : 'border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-high'
                ].join(' ')}
              >
                <LabelImageThumb
                  image={entry.image}
                  label={entry.label}
                  className={thumbHeightClass}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-on-surface">
                    {entry.shortLabel}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-on-surface-variant">
                    {entry.image.file.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {overlayOpen ? (
        <LabelImageLightbox
          images={images}
          activeIndex={activeIndex}
          onSelect={(index) => setActiveId(images[index]?.id ?? activeId)}
          onClose={() => setOverlayOpen(false)}
        />
      ) : null}
    </div>
  );
}

function LabelImageCanvas({
  image,
  alt,
  className
}: {
  image: LabelImage;
  alt: string;
  className: string;
}) {
  if (image.file.type === 'application/pdf') {
    return (
      <object
        data={image.previewUrl}
        type="application/pdf"
        aria-label={alt}
        className={`w-full rounded-lg bg-surface-container-highest ${className}`}
      >
        <div
          className={`flex w-full items-center justify-center rounded-lg bg-surface-container-highest ${className}`}
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-5xl text-on-surface-variant"
          >
            picture_as_pdf
          </span>
        </div>
      </object>
    );
  }

  return (
    <img
      alt={alt}
      src={image.previewUrl}
      className={`w-full rounded-lg bg-surface-container-highest object-contain ${className}`}
    />
  );
}

function LabelImageThumb({
  image,
  label,
  className
}: {
  image: LabelImage;
  label: string;
  className: string;
}) {
  if (image.file.type === 'application/pdf') {
    return (
      <div
        aria-label={`${label} thumbnail`}
        className={`flex w-16 shrink-0 items-center justify-center rounded-md bg-surface-container-highest ${className}`}
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-2xl text-on-surface-variant"
        >
          picture_as_pdf
        </span>
      </div>
    );
  }

  return (
    <img
      alt={`${label} thumbnail`}
      src={image.previewUrl}
      className={`h-full w-16 shrink-0 rounded-md bg-surface-container-highest object-cover ${className}`}
    />
  );
}

function LabelImageLightbox({
  images,
  activeIndex,
  onSelect,
  onClose
}: {
  images: GalleryEntry[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const safeIndex = Math.max(0, Math.min(activeIndex, images.length - 1));
  const activeEntry = images[safeIndex]!;

  const selectPrevious = useCallback(() => {
    onSelect((safeIndex - 1 + images.length) % images.length);
  }, [images.length, onSelect, safeIndex]);

  const selectNext = useCallback(() => {
    onSelect((safeIndex + 1) % images.length);
  }, [images.length, onSelect, safeIndex]);

  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (images.length > 1 && event.key === 'ArrowLeft') {
        event.preventDefault();
        selectPrevious();
      }

      if (images.length > 1 && event.key === 'ArrowRight') {
        event.preventDefault();
        selectNext();
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
  }, [images.length, onClose, selectNext, selectPrevious]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-size label image viewer"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/80 px-6 py-6 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-[min(1080px,94vw)] flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-ambient"
      >
        <header className="flex items-start gap-4 border-b border-outline-variant/15 bg-surface-container-low px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              {activeEntry.label}
              {images.length > 1 ? ` · ${safeIndex + 1} of ${images.length}` : ''}
            </p>
            <h2 className="truncate font-mono text-sm font-semibold text-on-surface">
              {activeEntry.image.file.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {images.length > 1 ? (
              <>
                <LightboxNavButton label="Previous image" icon="chevron_left" onClick={selectPrevious} />
                <LightboxNavButton label="Next image" icon="chevron_right" onClick={selectNext} />
              </>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-label font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              Close
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-surface-container-low p-6">
          <LabelImageCanvas
            image={activeEntry.image}
            alt={`Full-size preview of ${activeEntry.image.file.name}`}
            className="max-h-[68vh] min-h-[360px]"
          />
        </div>

        <footer className="flex flex-col gap-3 border-t border-outline-variant/15 bg-surface-container-low px-5 py-3">
          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((entry, index) => {
                const isActive = index === safeIndex;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelect(index)}
                    aria-pressed={isActive}
                    className={[
                      'flex min-w-[180px] items-center gap-3 rounded-lg border p-2 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary-container/15'
                        : 'border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-high'
                    ].join(' ')}
                  >
                    <LabelImageThumb
                      image={entry.image}
                      label={entry.label}
                      className="h-14"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-on-surface">
                        {entry.label}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-on-surface-variant">
                        {entry.image.file.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className="text-[11px] font-label text-on-surface-variant">
            Press <kbd className="font-mono font-bold text-on-surface">Esc</kbd> to close.
            {images.length > 1 ? ' Use left and right arrows to switch images.' : ''}
          </p>
        </footer>
      </div>
    </div>
  );
}

function LightboxNavButton({
  label,
  icon,
  onClick
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-outline-variant/20 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
        {icon}
      </span>
    </button>
  );
}
