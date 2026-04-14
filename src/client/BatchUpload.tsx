import { useMemo, useRef } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import type { SeedBatch } from './batchScenarios';
import { MatchingReview } from './MatchingReview';
import {
  CSV_EXPECTED_HEADERS,
  CSV_REQUIRED_HEADERS,
  type BatchAmbiguousItem,
  type BatchFileError,
  type BatchLabelImage,
  type BatchUnmatchedImage,
  type BatchUnmatchedRow
} from './batchTypes';

interface BatchUploadProps {
  seed: SeedBatch;
  interactive?: boolean;
  onReturnToSingle: () => void;
  onStartBatch: () => void;
  onSelectImages?: (files: File[]) => void;
  onSelectCsv?: (file: File) => void;
  onPickAmbiguous: (imageId: string, rowId: string) => void;
  onDropAmbiguous: (imageId: string) => void;
  onPairUnmatchedImage: (imageId: string, rowId: string) => void;
  onDropUnmatchedImage: (imageId: string) => void;
  onPairUnmatchedRow: (rowId: string, imageId: string) => void;
  onDropUnmatchedRow: (rowId: string) => void;
  onPreviewImage: (image: BatchLabelImage) => void;
}

export function BatchUpload(props: BatchUploadProps) {
  const { seed } = props;
  const {
    ambiguousUnresolved,
    unmatchedUnresolved,
    startDisabled,
    counts
  } = useMemo(() => summarize(seed), [seed]);

  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 py-10">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            Batch Upload
          </h1>
          <p className="text-on-surface-variant font-body">
            Upload many label images and one CSV of application data. Nothing is stored.
          </p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ImagesDropZone
            images={seed.images}
            overCap={seed.overCap}
            interactive={props.interactive === true}
            onSelectImages={props.onSelectImages}
            onPreviewImage={props.onPreviewImage}
          />
          <CsvDropZone
            csv={seed.csv}
            csvError={seed.csvError}
            interactive={props.interactive === true}
            onSelectCsv={props.onSelectCsv}
          />
        </section>

        <CountStrip counts={counts} />

        <FileErrorList errors={seed.fileErrors} />

        <section aria-label="Matching review" className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between">
            <h2 className="font-headline text-xl font-bold text-on-surface">
              Matching review
            </h2>
            <p className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
              {counts.matched} matched · {counts.ambiguous} ambiguous · {counts.unmatched} unmatched
            </p>
          </header>

          <MatchingReview
            matching={seed.matching}
            hasCsv={seed.csv !== null}
            hasImages={seed.images.length > 0}
            csvError={seed.csvError}
            onPickAmbiguous={props.onPickAmbiguous}
            onDropAmbiguous={props.onDropAmbiguous}
            onPairUnmatchedImage={props.onPairUnmatchedImage}
            onDropUnmatchedImage={props.onDropUnmatchedImage}
            onPairUnmatchedRow={props.onPairUnmatchedRow}
            onDropUnmatchedRow={props.onDropUnmatchedRow}
            onPreviewImage={props.onPreviewImage}
          />
        </section>

        <PrivacyActionBar
          onReturn={props.onReturnToSingle}
          onStart={props.onStartBatch}
          disabled={startDisabled}
          ambiguous={ambiguousUnresolved}
          unmatched={unmatchedUnresolved}
        />
      </div>
    </div>
  );
}

interface Counts {
  images: number;
  csvRows: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
}

function summarize(seed: SeedBatch): {
  ambiguousUnresolved: number;
  unmatchedUnresolved: number;
  startDisabled: boolean;
  counts: Counts;
} {
  const ambiguousActive = seed.matching.ambiguous.filter(
    (item) => !item.dropped && item.chosenRowId === null
  );
  const unmatchedImagesActive = seed.matching.unmatchedImages.filter(
    (item) => !item.dropped && item.pairedRowId === null
  );
  const unmatchedRowsActive = seed.matching.unmatchedRows.filter(
    (item) => !item.dropped && item.pairedImageId === null
  );
  const ambiguousUnresolved = ambiguousActive.length;
  const unmatchedUnresolved = unmatchedImagesActive.length + unmatchedRowsActive.length;
  const startDisabled =
    seed.images.length === 0 ||
    seed.csv === null ||
    seed.csvError !== null ||
    ambiguousUnresolved > 0 ||
    unmatchedUnresolved > 0;
  const counts: Counts = {
    images: seed.images.length,
    csvRows: seed.csv?.rowCount ?? 0,
    matched: seed.matching.matched.length,
    ambiguous: seed.matching.ambiguous.length,
    unmatched:
      seed.matching.unmatchedImages.length + seed.matching.unmatchedRows.length
  };
  return { ambiguousUnresolved, unmatchedUnresolved, startDisabled, counts };
}

function ImagesDropZone({
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
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (!interactive) return;
    inputRef.current?.click();
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) {
      onSelectImages?.(files);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!interactive) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) {
      onSelectImages?.(files);
    }
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !empty) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      aria-label="Label images drop zone"
      role={interactive && empty ? 'button' : undefined}
      tabIndex={interactive && empty ? 0 : undefined}
      onClick={interactive && empty ? openPicker : undefined}
      onKeyDown={interactive && empty ? onKeyDown : undefined}
      onDrop={interactive ? onDrop : undefined}
      onDragOver={interactive ? onDragOver : undefined}
      className={[
        'rounded-lg border-2 border-dashed px-6 py-6 flex flex-col gap-4 min-h-[220px]',
        empty
          ? 'border-outline-variant/50 bg-surface-container-low'
          : 'border-outline-variant/20 bg-surface-container-lowest'
      ].join(' ')}
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-2xl"
          >
            photo_library
          </span>
        </div>
        <div className="min-w-0 flex-grow">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            {empty
              ? 'Drop label images or click to browse'
              : `${images.length} label image${images.length === 1 ? '' : 's'} ready`}
          </h3>
          <p className="text-sm text-on-surface-variant">
            JPEG, PNG, WEBP, or PDF. Up to 10 MB each. Up to 50 labels per batch.
          </p>
        </div>
      </div>

        {!empty ? (
        <ul className="flex flex-wrap gap-3">
          {images.slice(0, 12).map((image) => (
            <li
              key={image.id}
              className="flex flex-col items-center gap-1 max-w-[96px]"
            >
              <button
                type="button"
                onClick={() => onPreviewImage(image)}
                aria-label={`View larger preview of ${image.filename}`}
                className="rounded cursor-zoom-in transition-transform hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ImageChipThumb image={image} />
              </button>
              <button
                type="button"
                onClick={() => onPreviewImage(image)}
                title={image.filename}
                className="font-mono text-[10px] text-on-surface-variant truncate w-full text-center hover:underline"
              >
                {image.filename}
              </button>
            </li>
          ))}
          {images.length > 12 ? (
            <li className="flex items-center px-2.5 py-1.5 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">
              +{images.length - 12} more
            </li>
          ) : null}
        </ul>
        ) : null}

      {interactive ? (
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          onChange={onInputChange}
          className="sr-only"
          tabIndex={-1}
        />
      ) : null}

      {overCap ? (
        <p className="text-sm text-error font-medium flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            error
          </span>
          This proof of concept accepts up to 50 labels per batch. Remove some to
          continue.
        </p>
      ) : null}
    </div>
  );
}

function CsvDropZone({
  csv,
  csvError,
  interactive,
  onSelectCsv
}: {
  csv: SeedBatch['csv'];
  csvError: string | null;
  interactive: boolean;
  onSelectCsv?: (file: File) => void;
}) {
  const empty = csv === null;
  const hasError = csvError !== null;
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (!interactive) return;
    inputRef.current?.click();
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      onSelectCsv?.(file);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!interactive) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onSelectCsv?.(file);
    }
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !empty) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      aria-label="Application CSV drop zone"
      role={interactive && empty ? 'button' : undefined}
      tabIndex={interactive && empty ? 0 : undefined}
      onClick={interactive && empty ? openPicker : undefined}
      onKeyDown={interactive && empty ? onKeyDown : undefined}
      onDrop={interactive ? onDrop : undefined}
      onDragOver={interactive ? onDragOver : undefined}
      className={[
        'rounded-lg border-2 border-dashed px-6 py-6 flex flex-col gap-4 min-h-[220px]',
        hasError
          ? 'border-error bg-error-container/10'
          : empty
            ? 'border-outline-variant/50 bg-surface-container-low'
            : 'border-outline-variant/20 bg-surface-container-lowest'
      ].join(' ')}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0',
            hasError
              ? 'bg-error-container/30 text-on-error-container'
              : 'bg-surface-container-highest text-primary'
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-2xl"
          >
            description
          </span>
        </div>
        <div className="min-w-0 flex-grow">
          <h3 className="font-headline text-lg font-bold text-on-surface">
            {empty
              ? 'Drop an application CSV or click to browse'
              : csv!.filename}
          </h3>
          <p className="text-sm text-on-surface-variant">
            One CSV file. The first row must be a header row with the columns
            listed below.
          </p>
        </div>
      </div>

      {empty ? <ExpectedHeadersPanel /> : null}

      {!empty && !hasError ? (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Rows" value={String(csv!.rowCount)} />
            <Stat label="Size" value={csv!.sizeLabel} />
          </dl>

          {csv!.headers.length > 0 ? (
            <HeadersChipList
              headers={csv!.headers}
              missing={missingRequired(csv!.headers)}
            />
          ) : null}

          {csv!.rows.length > 0 ? (
            <CsvRowsPreview rows={csv!.rows} />
          ) : null}
        </>
      ) : null}

      {hasError ? (
        <>
          <p role="alert" className="text-sm text-error font-medium flex items-center gap-2">
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              error
            </span>
            {csvError}
          </p>
          <ExpectedHeadersPanel />
        </>
      ) : null}

      {interactive ? (
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onInputChange}
          className="sr-only"
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}

function ExpectedHeadersPanel() {
  return (
    <section
      aria-label="Expected CSV headers"
      className="bg-surface-container-low border border-outline-variant/20 rounded px-4 py-3 flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          Expected headers
        </h4>
        <p className="text-[11px] font-label text-on-surface-variant">
          Required columns are bold.
        </p>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {CSV_EXPECTED_HEADERS.map((header) => {
          const required = CSV_REQUIRED_HEADERS.includes(header);
          return (
            <li
              key={header}
              className={[
                'font-mono text-xs px-2 py-1 rounded border',
                required
                  ? 'bg-surface-container-lowest border-outline-variant/40 text-on-surface font-bold'
                  : 'bg-transparent border-outline-variant/25 text-on-surface-variant'
              ].join(' ')}
            >
              {header}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HeadersChipList({
  headers,
  missing
}: {
  headers: string[];
  missing: string[];
}) {
  return (
    <section
      aria-label="Header row"
      className="bg-surface-container-low border border-outline-variant/15 rounded px-3 py-2 flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          Header row
        </h4>
        {missing.length > 0 ? (
          <p className="text-[11px] font-label text-error">
            Missing required: {missing.join(', ')}
          </p>
        ) : (
          <p className="text-[11px] font-label text-on-surface-variant">
            All required columns present.
          </p>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {headers.map((header) => {
          const required = CSV_REQUIRED_HEADERS.includes(header);
          return (
            <li
              key={header}
              className={[
                'font-mono text-[11px] px-2 py-0.5 rounded border',
                required
                  ? 'bg-surface-container-lowest border-outline-variant/40 text-on-surface font-bold'
                  : 'bg-transparent border-outline-variant/25 text-on-surface-variant'
              ].join(' ')}
            >
              {header}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CsvRowsPreview({
  rows
}: {
  rows: NonNullable<SeedBatch['csv']>['rows'];
}) {
  return (
    <section
      aria-label="CSV rows preview"
      className="border border-outline-variant/15 rounded bg-surface-container-low"
    >
      <header className="px-3 py-2 border-b border-outline-variant/15 flex items-center justify-between">
        <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          First rows
        </h4>
        <span className="font-mono text-[10px] text-on-surface-variant/80">
          brand_name · class_type
        </span>
      </header>
      <ul className="flex flex-col divide-y divide-outline-variant/15">
        {rows.slice(0, 4).map((row) => (
          <li
            key={row.id}
            className="px-3 py-2 flex items-center gap-3 min-w-0"
          >
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold flex-shrink-0 w-12">
              Row {row.rowIndex}
            </span>
            <span className="text-sm text-on-surface font-semibold truncate flex-shrink-0 max-w-[50%]">
              {row.brandName}
            </span>
            <span className="text-xs text-on-surface-variant font-body truncate">
              {row.classType}
            </span>
          </li>
        ))}
        {rows.length > 4 ? (
          <li className="px-3 py-2 text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
            +{rows.length - 4} more rows
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function missingRequired(headers: string[]): string[] {
  const set = new Set(headers);
  return CSV_REQUIRED_HEADERS.filter((header) => !set.has(header));
}

function ImageChipThumb({ image }: { image: BatchLabelImage }) {
  const base =
    'w-[72px] h-[96px] rounded border border-outline-variant/20 bg-surface-container-highest flex items-center justify-center flex-shrink-0';
  if (image.isPdf) {
    return (
      <div className={base}>
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-on-surface-variant"
        >
          picture_as_pdf
        </span>
      </div>
    );
  }
  if (image.previewUrl) {
    return (
      <img
        alt={`Preview of ${image.filename}`}
        src={image.previewUrl}
        className="w-[72px] h-[96px] rounded border border-outline-variant/20 object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className={base}>
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-on-surface-variant"
      >
        image
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </dt>
      <dd className="font-mono text-sm font-semibold text-on-surface">{value}</dd>
    </div>
  );
}

function CountStrip({ counts }: { counts: Counts }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-5 py-3 flex flex-wrap gap-x-4 gap-y-1 items-center">
      <CountCell label="Images" value={counts.images} />
      <Dot />
      <CountCell label="CSV rows" value={counts.csvRows} />
      <Dot />
      <CountCell label="Matched" value={counts.matched} tone="tertiary" />
      <Dot />
      <CountCell
        label="Ambiguous"
        value={counts.ambiguous}
        tone={counts.ambiguous > 0 ? 'caution' : 'neutral'}
      />
      <Dot />
      <CountCell
        label="Unmatched"
        value={counts.unmatched}
        tone={counts.unmatched > 0 ? 'error' : 'neutral'}
      />
    </div>
  );
}

function CountCell({
  label,
  value,
  tone = 'neutral'
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'tertiary' | 'caution' | 'error';
}) {
  const valueClass =
    tone === 'tertiary'
      ? 'text-on-tertiary-container'
      : tone === 'caution'
        ? 'text-on-caution-container'
        : tone === 'error'
          ? 'text-on-error-container'
          : 'text-on-surface';
  return (
    <div className="flex items-baseline gap-2">
      <span className={`font-mono text-base font-bold ${valueClass}`}>{value}</span>
      <span className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-on-surface-variant/50">
      ·
    </span>
  );
}

function FileErrorList({ errors }: { errors: BatchFileError[] }) {
  if (errors.length === 0) return null;
  return (
    <section
      aria-label="File errors"
      className="bg-error-container/10 border border-error/30 rounded-lg px-4 py-3 flex flex-col gap-2"
    >
      <header className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-error"
        >
          error
        </span>
        <h3 className="font-label text-xs font-bold uppercase tracking-widest text-on-error-container">
          {errors.length} file{errors.length === 1 ? '' : 's'} not added
        </h3>
      </header>
      <ul className="flex flex-col gap-1">
        {errors.map((err) => (
          <li
            key={`${err.filename}-${err.reason}`}
            className="flex items-center gap-2 text-sm text-on-error-container"
          >
            <span className="font-mono text-xs">{err.filename}</span>
            <span aria-hidden="true" className="text-on-surface-variant/50">·</span>
            <span>{err.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrivacyActionBar({
  onReturn,
  onStart,
  disabled,
  ambiguous,
  unmatched
}: {
  onReturn: () => void;
  onStart: () => void;
  disabled: boolean;
  ambiguous: number;
  unmatched: number;
}) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-6 py-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between shadow-ambient">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-lg"
        >
          shield
        </span>
        <p className="text-sm font-label">
          Nothing is stored. Inputs and results are discarded when you leave.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReturn}
          className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Cancel and return to Single
        </button>
        <div className="relative group">
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            aria-describedby={disabled ? 'start-disabled-hint' : undefined}
            className={[
              'px-8 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all',
              disabled
                ? 'bg-surface-container-highest text-outline-variant/70 cursor-not-allowed'
                : 'bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]'
            ].join(' ')}
          >
            Start Batch Review
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-base"
            >
              arrow_forward
            </span>
          </button>
          {disabled ? (
            <div
              id="start-disabled-hint"
              role="tooltip"
              className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap bg-on-surface text-surface text-xs font-label px-3 py-1.5 rounded shadow-ambient opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
            >
              {disabledTooltip(ambiguous, unmatched)}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function disabledTooltip(ambiguous: number, unmatched: number): string {
  if (ambiguous === 0 && unmatched === 0) {
    return 'Drop label images and an application CSV to continue.';
  }
  return `Resolve the ${ambiguous} ambiguous and ${unmatched} unmatched items first.`;
}

// satisfy the un-used type import at call sites that never dereference individual items
export type { BatchAmbiguousItem, BatchUnmatchedImage, BatchUnmatchedRow };
