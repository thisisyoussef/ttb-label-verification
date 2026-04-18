import { useCallback, useRef, useState } from 'react';

import type { DropZoneError, LabelImage } from './types';
import { useFileDropInput } from './useFileDropInput';

const ACCEPTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const ACCEPTED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

type PickerTarget = 'bulk' | 'primary' | 'secondary';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  }

  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function buildLabelImage(file: File): LabelImage {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    sizeLabel: formatSize(file.size)
  };
}

function classifyError(file: File): DropZoneError | null {
  const isAccepted =
    ACCEPTED_MIME.has(file.type) ||
    ACCEPTED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext));

  if (!isAccepted) {
    return {
      kind: 'unsupported',
      message:
        "We couldn't use that file. Try a different image — we accept JPEG, PNG, WEBP, and PDF up to 10 MB."
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      kind: 'oversized',
      message: `That file is ${formatSize(file.size)}. Try a different image — the limit is 10 MB.`
    };
  }

  return null;
}

function validateFiles(files: File[]): DropZoneError | null {
  if (files.length > 2) {
    return {
      kind: 'unsupported',
      message:
        'Choose up to two label images at a time. The first image is primary and the second is optional.'
    };
  }

  for (const file of files) {
    const validationError = classifyError(file);
    if (validationError) {
      return validationError;
    }
  }

  return null;
}

export function resolveNextImages(input: {
  target: PickerTarget;
  nextImages: LabelImage[];
  primaryImage: LabelImage | null;
  secondaryImage: LabelImage | null;
}): {
  primaryImage: LabelImage | null;
  secondaryImage: LabelImage | null;
} {
  const [firstImage, secondImage] = input.nextImages;

  if (input.target === 'bulk') {
    return {
      primaryImage: firstImage ?? null,
      secondaryImage: secondImage ?? null
    };
  }

  if (input.target === 'primary') {
    return {
      primaryImage: firstImage ?? input.primaryImage,
      secondaryImage: secondImage ?? input.secondaryImage
    };
  }

  if (!input.primaryImage) {
    return {
      primaryImage: firstImage ?? null,
      secondaryImage: secondImage ?? null
    };
  }

  return {
    primaryImage: input.primaryImage,
    secondaryImage: firstImage ?? input.secondaryImage
  };
}

interface DropZoneProps {
  primaryImage: LabelImage | null;
  secondaryImage: LabelImage | null;
  disabled?: boolean;
  onChange: (
    primaryImage: LabelImage | null,
    secondaryImage: LabelImage | null
  ) => void;
  tourTarget?: string;
  secondaryTourTarget?: string;
}

export function DropZone({
  primaryImage,
  secondaryImage,
  disabled,
  onChange,
  tourTarget = 'tour-drop-zone',
  secondaryTourTarget = 'tour-secondary-drop-zone'
}: DropZoneProps) {
  const [error, setError] = useState<DropZoneError | null>(null);
  const [uploading, setUploading] = useState(false);
  const pickerTargetRef = useRef<PickerTarget>('bulk');

  const handleFiles = useCallback(
    (files: File[], target: PickerTarget) => {
      const validationError = validateFiles(files);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      const isLarge = files.some((file) => file.size > 2 * 1024 * 1024);
      if (isLarge) {
        setUploading(true);
      }

      const nextImages = files.map(buildLabelImage);
      requestAnimationFrame(() => {
        setUploading(false);
        const nextState = resolveNextImages({
          target,
          nextImages,
          primaryImage,
          secondaryImage
        });
        onChange(nextState.primaryImage, nextState.secondaryImage);
      });
    },
    [onChange, primaryImage, secondaryImage]
  );

  const {
    inputRef,
    isDragOver,
    openPicker,
    onInputChange,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop
  } = useFileDropInput({
    interactive: !disabled,
    multiple: true,
    trackDragState: true,
    onSelect: (files) => {
      handleFiles(files, pickerTargetRef.current);
    }
  });

  const openForTarget = useCallback(
    (target: PickerTarget) => {
      pickerTargetRef.current = target;
      setError(null);
      openPicker();
    },
    [openPicker]
  );

  const clearErrorOnDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      pickerTargetRef.current = 'bulk';
      setError(null);
      onDragEnter(event);
    },
    [onDragEnter]
  );

  const clearErrorOnDrag = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      pickerTargetRef.current = 'bulk';
      setError(null);
      onDragOver(event);
    },
    [onDragOver]
  );

  const onPrimaryRemove = useCallback(() => {
    onChange(secondaryImage, null);
    setError(null);
  }, [onChange, secondaryImage]);

  const onSecondaryRemove = useCallback(() => {
    onChange(primaryImage, null);
    setError(null);
  }, [onChange, primaryImage]);

  if (uploading) {
    return (
      <div className="flex flex-col gap-3">
        <div
          aria-label="Processing files"
          data-tour-target={tourTarget}
          className="relative flex flex-col items-center justify-center rounded-lg border-2 border-primary bg-primary-container/20 px-8 py-12 text-center"
        >
          <div className="mb-3 h-1 w-8 overflow-hidden rounded-full bg-primary/30">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="font-body text-sm text-on-surface-variant">
            Preparing image files...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-label="Label image picker"
        data-tour-target={tourTarget}
        onDragEnter={clearErrorOnDragEnter}
        onDragOver={clearErrorOnDrag}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'rounded-lg border-2 border-dashed p-4 transition-colors',
          disabled
            ? 'cursor-not-allowed border-outline-variant/30 bg-surface-container-low/60'
            : 'cursor-pointer',
          isDragOver
            ? 'border-primary bg-primary-container/20'
            : error
              ? 'border-error bg-error-container/10'
              : 'border-outline-variant/50 bg-surface-container-low hover:bg-surface-container/80'
        ].join(' ')}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-highest text-primary">
                <span className="material-symbols-outlined text-[28px]">
                  {isDragOver ? 'file_upload' : 'upload_file'}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-headline text-lg font-bold text-on-surface">
                  {isDragOver
                    ? 'Drop up to two label images'
                    : 'Drop one or two label images or click to browse'}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Primary first. Add a back label or side panel as the optional second image.
                  JPEG, PNG, WEBP, or PDF. Up to 10 MB each.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openForTarget('bulk');
              }}
              disabled={disabled}
              className="inline-flex items-center gap-2 self-start rounded-md border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              Select files
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ImageSlot
              title="Primary image"
              required
              image={primaryImage}
              emptyLabel="Choose the main label image"
              emptyIcon="image"
              tourTarget={null}
              onSelect={(event) => {
                event.stopPropagation();
                openForTarget('primary');
              }}
              onRemove={(event) => {
                event.stopPropagation();
                onPrimaryRemove();
              }}
            />
            <ImageSlot
              title="Second image"
              image={secondaryImage}
              emptyLabel="Add second image"
              emptyHint="Optional back label or side panel"
              emptyIcon="add"
              tourTarget={secondaryTourTarget}
              onSelect={(event) => {
                event.stopPropagation();
                openForTarget('secondary');
              }}
              onRemove={(event) => {
                event.stopPropagation();
                onSecondaryRemove();
              }}
            />
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={onInputChange}
            className="sr-only"
            tabIndex={-1}
          />
        </div>
      </section>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium text-error">
          <span className="material-symbols-outlined text-base">error</span>
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function ImageSlot(input: {
  title: string;
  required?: boolean;
  image: LabelImage | null;
  emptyLabel: string;
  emptyHint?: string;
  emptyIcon: string;
  tourTarget?: string | null;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      data-tour-target={input.tourTarget ?? undefined}
      className="flex min-h-[220px] flex-col rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-ambient"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-on-surface">{input.title}</p>
        <span className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
          {input.required ? 'required' : 'optional'}
        </span>
      </div>

      {input.image ? (
        <>
          <div className="flex min-h-0 flex-1 items-start gap-4">
            {input.image.file.type === 'application/pdf' ? (
              <div className="flex h-28 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-highest">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                  picture_as_pdf
                </span>
              </div>
            ) : (
              <img
                alt={`${input.title} thumbnail`}
                src={input.image.previewUrl}
                className="h-28 w-24 flex-shrink-0 rounded-lg bg-surface-container-highest object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="break-all font-mono text-sm font-semibold text-on-surface">
                {input.image.file.name}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {input.image.sizeLabel}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={input.onSelect}
              className="inline-flex items-center gap-1 rounded-md border border-outline-variant/40 px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Replace
            </button>
            <button
              type="button"
              onClick={input.onRemove}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-error hover:bg-error-container/15"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              Remove
            </button>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/35 bg-surface-container-low px-4 py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-highest text-primary">
            <span className="material-symbols-outlined text-[26px]">{input.emptyIcon}</span>
          </div>
          <p className="text-sm font-semibold text-on-surface">{input.emptyLabel}</p>
          {input.emptyHint ? (
            <p className="mt-1 text-xs text-on-surface-variant">{input.emptyHint}</p>
          ) : null}
          <button
            type="button"
            onClick={input.onSelect}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-outline-variant/40 px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">upload</span>
            {input.required ? 'Choose image' : 'Add image'}
          </button>
        </div>
      )}
    </div>
  );
}
