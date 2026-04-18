import type { ReactNode } from 'react';
import { InfoAnchor } from './InfoAnchor';
import type {
  BatchCsvRow,
  BatchLabelImage,
  BatchMatchingState
} from './batchTypes';

export function MatchingExplanation() {
  return (
    <p className="text-sm text-on-surface-variant font-body leading-relaxed flex items-center gap-2 flex-wrap">
      <span>
        Images are matched to CSV rows by the primary filename first, then by row order if no
        filename match is found. Add `secondary_filename` when a row has an optional second label.
      </span>
      <InfoAnchor anchorKey="batch-matching-logic" />
    </p>
  );
}

export function GroupShell({
  label,
  count,
  subtitle,
  tone,
  children,
  collapsible,
  expanded,
  onToggle
}: {
  label: string;
  count: number;
  subtitle: string | null;
  tone: 'tertiary' | 'caution' | 'error';
  children?: ReactNode;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const toneClass =
    tone === 'caution'
      ? 'border-caution text-on-caution-container'
      : tone === 'error'
        ? 'border-error text-on-error-container'
        : 'border-tertiary text-on-tertiary-container';

  return (
    <section
      className="bg-surface-container-low rounded-lg border border-outline-variant/15"
      aria-label={`${label}: ${count}`}
    >
      <header
        className={[
          'flex items-center justify-between px-4 py-3 border-l-4',
          toneClass
        ].join(' ')}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface">
            {label}
          </span>
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-mono font-semibold">
            {count}
          </span>
          {subtitle ? (
            <span className="text-xs text-on-surface-variant font-body truncate">
              {subtitle}
            </span>
          ) : null}
        </div>
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {expanded ? 'Collapse' : 'Expand'}
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[18px]"
            >
              {expanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        ) : null}
      </header>
      {children ? <div className="px-4 py-4">{children}</div> : null}
    </section>
  );
}

export function ItemHeader({
  image,
  onPreview
}: {
  image: BatchLabelImage;
  onPreview: (image: BatchLabelImage) => void;
}) {
  return (
    <div className="flex items-center gap-4 min-w-0">
      <LabelThumb image={image} size="md" onPreview={() => onPreview(image)} />
      <div className="min-w-0 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onPreview(image)}
          className="font-mono text-sm text-on-surface truncate hover:underline text-left"
        >
          {image.filename}
        </button>
        <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
          {image.sizeLabel}
          {image.isPdf ? ' · PDF' : ''}
        </p>
        <button
          type="button"
          onClick={() => onPreview(image)}
          className="inline-flex items-center gap-1 text-[11px] font-label font-bold uppercase tracking-widest text-primary hover:underline self-start mt-0.5"
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[14px]"
          >
            zoom_in
          </span>
          View larger
        </button>
      </div>
    </div>
  );
}

export function RowHeader({ row }: { row: BatchCsvRow }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <RowIndexChip rowIndex={row.rowIndex} size="md" />
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-on-surface truncate">
          {row.brandName}
        </p>
        <p className="text-xs text-on-surface-variant font-body truncate">
          {row.classType}
        </p>
        {row.filenameHint ? (
          <p className="text-[10px] font-mono text-on-surface-variant/80 truncate">
            filename hint: {row.filenameHint}
          </p>
        ) : null}
        {row.secondaryFilenameHint ? (
          <p className="text-[10px] font-mono text-on-surface-variant/80 truncate">
            secondary hint: {row.secondaryFilenameHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function LabelThumb({
  image,
  size,
  onPreview
}: {
  image: BatchLabelImage;
  size: 'sm' | 'md';
  onPreview?: () => void;
}) {
  const boxClass = size === 'md' ? 'w-16 h-[88px]' : 'w-12 h-16';
  const clickable = Boolean(onPreview);
  const interactiveClass = clickable
    ? 'cursor-zoom-in transition-transform hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
    : '';
  const baseClass = [
    boxClass,
    'rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0 border border-outline-variant/20',
    interactiveClass
  ].join(' ');

  const body = image.isPdf ? (
    <span
      aria-hidden="true"
      className="material-symbols-outlined text-on-surface-variant"
    >
      picture_as_pdf
    </span>
  ) : image.previewUrl ? (
    <img
      alt={`Preview of ${image.filename}`}
      src={image.previewUrl}
      className={[boxClass, 'object-cover rounded-lg flex-shrink-0'].join(' ')}
    />
  ) : (
    <span
      aria-hidden="true"
      className="material-symbols-outlined text-on-surface-variant"
    >
      image
    </span>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onPreview}
        aria-label={`View larger preview of ${image.filename}`}
        className={baseClass + ' overflow-hidden'}
      >
        {body}
      </button>
    );
  }

  return <div className={baseClass}>{body}</div>;
}

export function RowIndexChip({
  rowIndex,
  size = 'sm'
}: {
  rowIndex: number;
  size?: 'sm' | 'md';
}) {
  const wrapClass =
    size === 'md'
      ? 'w-16 h-[88px] rounded-lg flex-col gap-1 text-sm'
      : 'w-[52px] h-10 rounded-lg flex-row gap-1 text-xs';
  return (
    <div
      className={[
        wrapClass,
        'flex items-center justify-center flex-shrink-0 bg-surface-container-highest border border-outline-variant/20'
      ].join(' ')}
    >
      <span className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant">
        Row
      </span>
      <span className="font-mono font-bold text-on-surface leading-none">{rowIndex}</span>
    </div>
  );
}

export function DropFromBatchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-error hover:underline inline-flex items-center gap-1"
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-[18px]"
      >
        close
      </span>
      Drop from batch
    </button>
  );
}

export function DroppedState() {
  return (
    <p className="text-sm text-on-surface-variant font-body italic">
      Dropped from batch.
    </p>
  );
}

export function EmptyPanel({
  icon,
  heading,
  body,
  tone
}: {
  icon: string;
  heading: string;
  body: string;
  tone: 'neutral' | 'error';
}) {
  const toneClass =
    tone === 'error'
      ? 'border-error bg-error-container/10 text-on-error-container'
      : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant';
  return (
    <section
      className={[
        'rounded-lg border border-dashed px-6 py-10 flex flex-col items-center text-center gap-2',
        toneClass
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-3xl opacity-80"
      >
        {icon}
      </span>
      <h3 className="font-headline text-base font-bold text-on-surface">{heading}</h3>
      <p className="text-sm max-w-md">{body}</p>
    </section>
  );
}

export function allCsvRows(matching: BatchMatchingState): BatchCsvRow[] {
  const rows: BatchCsvRow[] = [];
  for (const pair of matching.matched) rows.push(pair.row);
  for (const ambiguous of matching.ambiguous) {
    for (const row of ambiguous.candidates) {
      rows.push(row);
    }
  }
  for (const item of matching.unmatchedRows) rows.push(item.row);
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function allImages(matching: BatchMatchingState): BatchLabelImage[] {
  const images: BatchLabelImage[] = [];
  for (const pair of matching.matched) {
    images.push(pair.image);
    if (pair.secondaryImage) {
      images.push(pair.secondaryImage);
    }
  }
  for (const ambiguous of matching.ambiguous) images.push(ambiguous.image);
  for (const item of matching.unmatchedImages) images.push(item.image);
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.id)) return false;
    seen.add(image.id);
    return true;
  });
}

export function isMatchDropped(imageId: string, matching: BatchMatchingState): boolean {
  void imageId;
  void matching;
  return false;
}
