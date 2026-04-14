import { useCallback, useState } from 'react';
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

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function classifyError(file: File): DropZoneError | null {
  const isAccepted =
    ACCEPTED_MIME.has(file.type) ||
    ACCEPTED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext));

  if (!isAccepted) {
    return {
      kind: 'unsupported',
      message: "We couldn't use that file. Please upload a JPEG, PNG, WEBP, or PDF."
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      kind: 'oversized',
      message: `That file is ${formatSize(file.size)}. The limit is 10 MB.`
    };
  }

  return null;
}

interface DropZoneProps {
  image: LabelImage | null;
  disabled?: boolean;
  onAccept: (image: LabelImage) => void;
  onRemove: () => void;
}

export function DropZone({ image, disabled, onAccept, onRemove }: DropZoneProps) {
  const [error, setError] = useState<DropZoneError | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      const validationError = classifyError(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      const previewUrl = URL.createObjectURL(file);
      onAccept({ file, previewUrl, sizeLabel: formatSize(file.size) });
    },
    [onAccept]
  );

  const {
    inputRef,
    isDragOver,
    openPicker,
    onInputChange,
    onDragOver,
    onDragLeave,
    onDrop,
    onKeyDown
  } = useFileDropInput({
    interactive: !disabled,
    trackDragState: true,
    onSelect: ([file]) => {
      if (file) {
        handleFile(file);
      }
    }
  });

  if (image) {
    return (
      <section
        aria-label="Uploaded label image"
        data-tour-target="tour-drop-zone"
        className="bg-surface-container-lowest shadow-ambient rounded-lg p-6 flex flex-col gap-4 border border-outline-variant/20"
      >
        <div className="flex items-start gap-5">
          {image.file.type === 'application/pdf' ? (
            <div className="w-28 h-36 bg-surface-container-highest rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                picture_as_pdf
              </span>
            </div>
          ) : (
            <img
              alt="Uploaded label thumbnail"
              src={image.previewUrl}
              className="w-28 h-36 object-cover rounded-lg bg-surface-container-highest flex-shrink-0"
            />
          )}
          <div className="flex-grow min-w-0">
            <p className="font-mono text-base text-on-surface font-semibold break-all">
              {image.file.name}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">{image.sizeLabel}</p>
            <button
              type="button"
              onClick={() => {
                onRemove();
                setError(null);
              }}
              disabled={disabled}
              className="mt-4 text-error text-sm font-semibold flex items-center gap-1 hover:underline disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              Remove
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a label image or click to browse"
        data-tour-target="tour-drop-zone"
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'relative flex flex-col items-center justify-center text-center rounded-lg px-12 py-16 transition-colors cursor-pointer',
          'border-2 border-dashed',
          isDragOver
            ? 'border-primary bg-primary-container/40'
            : error
              ? 'border-error bg-error-container/10'
              : 'border-outline-variant/50 bg-surface-container-low hover:bg-surface-container/80'
        ].join(' ')}
      >
        <div className="mb-5 w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-4xl">upload_file</span>
        </div>
        <h2 className="font-headline font-bold text-xl text-on-surface mb-1">
          {isDragOver ? 'Drop to upload' : 'Drop a label image or click to browse'}
        </h2>
        <p className="text-sm text-on-surface-variant">
          JPEG, PNG, WEBP, or PDF. Up to 10 MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          onChange={onInputChange}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
