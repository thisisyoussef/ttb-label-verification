import { CSV_REQUIRED_HEADERS, type BatchLabelImage } from './batchTypes';
import { useFileDropInput } from './useFileDropInput';

export function ImagesDropZone({
  images,
  overCap,
  interactive,
  onSelectImages,
  onPreviewImage
}: {
  images: BatchLabelImage[];
  overCap: boolean;
  interactive: boolean;
  onSelectImages?: (files: File[]) => void;
  onPreviewImage: (image: BatchLabelImage) => void;
}) {
  const empty = images.length === 0;
  const { inputRef, openPicker, onInputChange, onDragOver, onDrop, onKeyDown } =
    useFileDropInput({
      interactive,
      multiple: true,
      filterFiles: (files) =>
        files.filter((file) =>
          /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)
        ),
      onSelect: onSelectImages
    });

  return (
    <section
      aria-label="Label images"
      className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-5 flex flex-col gap-4 shadow-ambient"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Label images</h2>
          <span className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
            JPEG · PNG · WEBP · PDF
          </span>
        </div>
        <p className="text-sm text-on-surface-variant font-body">
          Up to 50 labels per batch. Files stay local until you start processing.
        </p>
      </header>

      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : -1}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={[
          'rounded-lg border border-dashed px-5 py-6 transition-colors',
          interactive
            ? 'cursor-pointer hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            : '',
          empty
            ? 'border-outline-variant/40 bg-surface-container-low'
            : 'border-outline-variant/25 bg-surface-container'
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onChange={onInputChange}
          className="hidden"
        />

        {empty ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant">
              upload_file
            </span>
            <p className="font-body text-sm text-on-surface-variant">
              Drag label images here or click to browse.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Stat label="Images" value={String(images.length)} />
                {overCap ? (
                  <span className="text-xs font-label font-bold uppercase tracking-widest text-error">
                    Over cap
                  </span>
                ) : null}
              </div>
              {interactive ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                  className="text-xs font-label font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Add more
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPreviewImage(image);
                  }}
                  className="bg-surface-container rounded-lg border border-outline-variant/20 p-3 flex gap-3 text-left hover:border-primary/40 transition-colors"
                >
                  <ImageChipThumb image={image} />
                  <div className="min-w-0 flex flex-col gap-1">
                    <p className="font-mono text-xs text-on-surface truncate">{image.filename}</p>
                    <p className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
                      {image.sizeLabel}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function CsvDropZone({
  csv,
  csvError,
  interactive,
  onSelectCsv
}: {
  csv: {
    filename: string;
    sizeLabel: string;
    rowCount: number;
    headers: string[];
    rows: Array<{
      id: string;
      rowIndex: number;
      filenameHint: string;
      brandName: string;
      classType: string;
    }>;
  } | null;
  csvError: string | null;
  interactive: boolean;
  onSelectCsv?: (file: File) => void;
}) {
  const hasError = csvError !== null;
  const { inputRef, openPicker, onInputChange, onDragOver, onDrop, onKeyDown } =
    useFileDropInput({
      interactive,
      filterFiles: (files) =>
        files.filter(
          (candidate) =>
            candidate.type === 'text/csv' ||
            candidate.name.toLowerCase().endsWith('.csv')
        ),
      onSelect: ([file]) => {
        if (file) {
          onSelectCsv?.(file);
        }
      }
    });

  return (
    <section
      aria-label="Application CSV"
      className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-5 flex flex-col gap-4 shadow-ambient"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Application CSV</h2>
          <span className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
            one file
          </span>
        </div>
        <p className="text-sm text-on-surface-variant font-body">
          Include one row per label. Required headers stay fixed for the review contract.
        </p>
      </header>

      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : -1}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={[
          'rounded-lg border border-dashed px-5 py-6 transition-colors',
          interactive
            ? 'cursor-pointer hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            : '',
          csv || hasError
            ? 'border-outline-variant/25 bg-surface-container'
            : 'border-outline-variant/40 bg-surface-container-low'
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onInputChange}
          className="hidden"
        />

        {!csv && !hasError ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant">
              table_upload
            </span>
            <p className="font-body text-sm text-on-surface-variant">
              Drag a CSV here or click to browse.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <p className="font-mono text-sm text-on-surface truncate">
                  {csv?.filename ?? 'CSV import failed'}
                </p>
                <p className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
                  {csv ? `${csv.rowCount} rows · ${csv.sizeLabel}` : 'Fix the headers and try again'}
                </p>
              </div>
              {interactive ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                  className="text-xs font-label font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Replace
                </button>
              ) : null}
            </div>

            {hasError ? (
              <div className="rounded-lg border border-error/30 bg-error-container/15 px-4 py-3">
                <p className="text-sm font-body text-on-surface">{csvError}</p>
              </div>
            ) : (
              <>
                <HeadersChipList headers={csv?.headers ?? []} />
                <CsvRowsPreview rows={csv?.rows ?? []} />
              </>
            )}
          </div>
        )}
      </div>

      <ExpectedHeadersPanel />
    </section>
  );
}

function ExpectedHeadersPanel() {
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 flex flex-col gap-2">
      <p className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
        Required CSV headers
      </p>
      <div className="flex flex-wrap gap-2">
        {CSV_REQUIRED_HEADERS.map((header) => (
          <span
            key={header}
            className="rounded-full bg-primary-container/50 px-3 py-1 text-[11px] font-label uppercase tracking-widest text-on-primary-container"
          >
            {header}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeadersChipList({ headers }: { headers: string[] }) {
  const missing = CSV_REQUIRED_HEADERS.filter((required) => !headers.includes(required));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {headers.map((header) => {
          const required = CSV_REQUIRED_HEADERS.includes(
            header as (typeof CSV_REQUIRED_HEADERS)[number]
          );
          return (
            <span
              key={header}
              className={[
                'rounded-full px-3 py-1 text-[11px] font-label uppercase tracking-widest',
                required
                  ? 'bg-tertiary-container/50 text-on-tertiary-container'
                  : 'bg-surface-container-high text-on-surface-variant'
              ].join(' ')}
            >
              {header}
            </span>
          );
        })}
      </div>
      {missing.length > 0 ? (
        <p className="text-xs font-body text-error">
          Missing required headers: {missing.join(', ')}
        </p>
      ) : null}
    </div>
  );
}

function CsvRowsPreview({
  rows
}: {
  rows: Array<{
    id: string;
    rowIndex: number;
    filenameHint: string;
    brandName: string;
    classType: string;
  }>;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-outline-variant/20 overflow-hidden">
      <div className="grid grid-cols-[72px_1fr_1fr] gap-3 bg-surface-container-high px-4 py-2 text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
        <span>Row</span>
        <span>Filename hint</span>
        <span>Brand / class</span>
      </div>
      <ul className="divide-y divide-outline-variant/15">
        {rows.slice(0, 6).map((row) => (
          <li key={row.id} className="grid grid-cols-[72px_1fr_1fr] gap-3 px-4 py-3 text-sm">
            <span className="font-mono text-on-surface-variant">#{row.rowIndex}</span>
            <span className="text-on-surface truncate">{row.filenameHint}</span>
            <span className="text-on-surface truncate">
              {row.brandName} · {row.classType}
            </span>
          </li>
        ))}
      </ul>
      {rows.length > 6 ? (
        <div className="px-4 py-2 text-xs text-on-surface-variant bg-surface-container-low">
          Previewing 6 of {rows.length} rows.
        </div>
      ) : null}
    </div>
  );
}

function ImageChipThumb({ image }: { image: BatchLabelImage }) {
  return (
    <div className="w-12 h-16 rounded border border-outline-variant/20 bg-surface-container-highest flex items-center justify-center overflow-hidden flex-shrink-0">
      {image.isPdf ? (
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">
          picture_as_pdf
        </span>
      ) : image.previewUrl ? (
        <img
          src={image.previewUrl}
          alt={`Preview of ${image.filename}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">
          image
        </span>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-high px-3 py-2 flex flex-col">
      <span className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      <span className="text-base font-headline font-bold text-on-surface">{value}</span>
    </div>
  );
}
