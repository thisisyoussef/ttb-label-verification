import { useState } from 'react';
import { InfoAnchor } from './InfoAnchor';
import type {
  BatchAmbiguousItem,
  BatchCsvRow,
  BatchLabelImage,
  BatchMatchingState,
  BatchUnmatchedImage,
  BatchUnmatchedRow
} from './batchTypes';

interface MatchingReviewProps {
  matching: BatchMatchingState;
  hasCsv: boolean;
  hasImages: boolean;
  csvError: string | null;
  onPickAmbiguous: (imageId: string, rowId: string) => void;
  onDropAmbiguous: (imageId: string) => void;
  onPairUnmatchedImage: (imageId: string, rowId: string) => void;
  onDropUnmatchedImage: (imageId: string) => void;
  onPairUnmatchedRow: (rowId: string, imageId: string) => void;
  onDropUnmatchedRow: (rowId: string) => void;
  onPreviewImage: (image: BatchLabelImage) => void;
}

export function MatchingReview(props: MatchingReviewProps) {
  const { matching, hasCsv, hasImages, csvError } = props;

  if (csvError !== null) {
    return (
      <EmptyPanel
        icon="block"
        heading="We can't match yet — the CSV needs a fix."
        body={csvError}
        tone="error"
      />
    );
  }

  if (!hasImages && !hasCsv) {
    return (
      <EmptyPanel
        icon="hourglass_empty"
        heading="Waiting for a batch."
        body="Drop label images and an application CSV to see how the system matched them."
        tone="neutral"
      />
    );
  }

  if (hasImages && !hasCsv) {
    return (
      <EmptyPanel
        icon="description"
        heading="Drop a CSV to match these labels to application data."
        body="Matching starts as soon as the CSV arrives."
        tone="neutral"
      />
    );
  }

  if (!hasImages && hasCsv) {
    return (
      <EmptyPanel
        icon="image"
        heading="Drop label images to match this CSV."
        body="Matching starts as soon as images arrive."
        tone="neutral"
      />
    );
  }

  const { ambiguous, unmatchedImages, unmatchedRows, matched } = matching;

  return (
    <div className="flex flex-col gap-4">
      <MatchingExplanation />
      <AmbiguousGroup
        items={ambiguous}
        onPick={props.onPickAmbiguous}
        onDrop={props.onDropAmbiguous}
        onPreviewImage={props.onPreviewImage}
      />
      <UnmatchedImagesGroup
        items={unmatchedImages}
        rows={allCsvRows(matching)}
        onPair={props.onPairUnmatchedImage}
        onDrop={props.onDropUnmatchedImage}
        onPreviewImage={props.onPreviewImage}
      />
      <UnmatchedRowsGroup
        items={unmatchedRows}
        images={allImages(matching)}
        onPair={props.onPairUnmatchedRow}
        onDrop={props.onDropUnmatchedRow}
      />
      <MatchedGroup
        matched={matched.filter((pair) => !isMatchDropped(pair.image.id, matching))}
        onPreviewImage={props.onPreviewImage}
      />
    </div>
  );
}

function MatchingExplanation() {
  return (
    <p className="text-sm text-on-surface-variant font-body leading-relaxed flex items-center gap-2 flex-wrap">
      <span>
        We match each image to a CSV row by the filename column first, then fall back
        to row order.
      </span>
      <InfoAnchor anchorKey="batch-matching-logic" />
    </p>
  );
}

function AmbiguousGroup({
  items,
  onPick,
  onDrop,
  onPreviewImage
}: {
  items: BatchAmbiguousItem[];
  onPick: (imageId: string, rowId: string) => void;
  onDrop: (imageId: string) => void;
  onPreviewImage: (image: BatchLabelImage) => void;
}) {
  if (items.length === 0) return null;
  const unresolved = items.filter((it) => !it.dropped && it.chosenRowId === null).length;
  return (
    <GroupShell
      label="Ambiguous"
      count={items.length}
      subtitle={
        unresolved > 0
          ? 'Two rows look like a match. Pick the right one.'
          : 'All ambiguous items resolved.'
      }
      tone="caution"
    >
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.image.id}
            className="bg-surface-container-lowest rounded-lg border border-outline-variant/15 p-4 flex flex-col gap-3"
          >
            <ItemHeader image={item.image} onPreview={onPreviewImage} />
            {item.dropped ? (
              <DroppedState />
            ) : (
              <div className="flex flex-col gap-2">
                <div
                  role="radiogroup"
                  aria-label={`Choose a row for ${item.image.filename}`}
                  className="grid grid-cols-1 md:grid-cols-2 gap-2"
                >
                  {item.candidates.map((candidate) => {
                    const isSelected = item.chosenRowId === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onPick(item.image.id, candidate.id)}
                        className={[
                          'text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-2',
                          isSelected
                            ? 'border-primary bg-primary-container/30'
                            : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container'
                        ].join(' ')}
                      >
                        <RowIndexChip rowIndex={candidate.rowIndex} />
                        <span className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-on-surface truncate">
                            {candidate.brandName}
                          </span>
                          <span className="text-xs text-on-surface-variant font-body truncate">
                            {candidate.classType}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-end pt-1">
                  <DropFromBatchButton onClick={() => onDrop(item.image.id)} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </GroupShell>
  );
}

function UnmatchedImagesGroup({
  items,
  rows,
  onPair,
  onDrop,
  onPreviewImage
}: {
  items: BatchUnmatchedImage[];
  rows: BatchCsvRow[];
  onPair: (imageId: string, rowId: string) => void;
  onDrop: (imageId: string) => void;
  onPreviewImage: (image: BatchLabelImage) => void;
}) {
  if (items.length === 0) return null;
  return (
    <GroupShell
      label="Unmatched images"
      count={items.length}
      subtitle="No row matched this image. Pair it with a row, or drop it from the batch."
      tone="error"
    >
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.image.id}
            className="bg-surface-container-lowest rounded-lg border border-outline-variant/15 p-4 flex flex-col gap-3"
          >
            <ItemHeader image={item.image} onPreview={onPreviewImage} />
            {item.dropped ? (
              <DroppedState />
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
                  Pair with a row
                </label>
                <select
                  value={item.pairedRowId ?? ''}
                  onChange={(event) => onPair(item.image.id, event.target.value)}
                  className="bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm text-on-surface px-3 py-2 focus:border-primary focus:ring-0 outline-none min-w-[320px]"
                >
                  <option value="">Select target row…</option>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      Row {row.rowIndex} — {row.brandName} · {row.classType}
                    </option>
                  ))}
                </select>
                <DropFromBatchButton onClick={() => onDrop(item.image.id)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </GroupShell>
  );
}

function UnmatchedRowsGroup({
  items,
  images,
  onPair,
  onDrop
}: {
  items: BatchUnmatchedRow[];
  images: BatchLabelImage[];
  onPair: (rowId: string, imageId: string) => void;
  onDrop: (rowId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <GroupShell
      label="Unmatched rows"
      count={items.length}
      subtitle="No image matched this row. Pair it with an image, or drop it from the batch."
      tone="error"
    >
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.row.id}
            className="bg-surface-container-lowest rounded-lg border border-outline-variant/15 p-4 flex flex-col gap-3"
          >
            <RowHeader row={item.row} />
            {item.dropped ? (
              <DroppedState />
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
                  Pair with an image
                </label>
                <select
                  value={item.pairedImageId ?? ''}
                  onChange={(event) => onPair(item.row.id, event.target.value)}
                  className="bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm text-on-surface px-3 py-2 focus:border-primary focus:ring-0 outline-none min-w-[320px]"
                >
                  <option value="">Select image…</option>
                  {images.map((image) => (
                    <option key={image.id} value={image.id}>
                      {image.filename}
                    </option>
                  ))}
                </select>
                <DropFromBatchButton onClick={() => onDrop(item.row.id)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </GroupShell>
  );
}

function MatchedGroup({
  matched,
  onPreviewImage
}: {
  matched: BatchMatchingState['matched'];
  onPreviewImage: (image: BatchLabelImage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (matched.length === 0) return null;
  return (
    <GroupShell
      label="Matched"
      count={matched.length}
      subtitle={expanded ? null : 'Matched pairs collapsed. Expand to inspect.'}
      tone="tertiary"
      collapsible
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      {expanded ? (
        <ul className="flex flex-col divide-y divide-outline-variant/10">
          {matched.map((pair) => (
            <li
              key={pair.image.id}
              className="py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
            >
              <div className="md:col-span-5 flex items-center gap-3 min-w-0">
                <LabelThumb
                  image={pair.image}
                  size="sm"
                  onPreview={() => onPreviewImage(pair.image)}
                />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onPreviewImage(pair.image)}
                    className="font-mono text-sm text-on-surface truncate hover:underline text-left"
                  >
                    {pair.image.filename}
                  </button>
                  <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                    {pair.image.sizeLabel}
                  </p>
                </div>
              </div>
              <div className="md:col-span-6 min-w-0 flex items-center gap-3">
                <RowIndexChip rowIndex={pair.row.rowIndex} />
                <div className="min-w-0">
                  <p className="text-sm text-on-surface font-semibold truncate">
                    {pair.row.brandName}
                  </p>
                  <p className="text-xs text-on-surface-variant font-body truncate">
                    {pair.row.classType}
                  </p>
                </div>
              </div>
              <div className="md:col-span-1 flex md:justify-end">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-tertiary-container/40 text-on-tertiary-container text-[10px] font-label font-bold uppercase tracking-wider">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Matched
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </GroupShell>
  );
}

function GroupShell({
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
  children?: React.ReactNode;
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

function ItemHeader({
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

function RowHeader({ row }: { row: BatchCsvRow }) {
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
      </div>
    </div>
  );
}

function LabelThumb({
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

function RowIndexChip({
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

function DropFromBatchButton({ onClick }: { onClick: () => void }) {
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

function DroppedState() {
  return (
    <p className="text-sm text-on-surface-variant font-body italic">
      Dropped from batch.
    </p>
  );
}

function EmptyPanel({
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

function allCsvRows(matching: BatchMatchingState): BatchCsvRow[] {
  const rows: BatchCsvRow[] = [];
  for (const pair of matching.matched) rows.push(pair.row);
  for (const amb of matching.ambiguous) for (const row of amb.candidates) rows.push(row);
  for (const un of matching.unmatchedRows) rows.push(un.row);
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function allImages(matching: BatchMatchingState): BatchLabelImage[] {
  const images: BatchLabelImage[] = [];
  for (const pair of matching.matched) images.push(pair.image);
  for (const amb of matching.ambiguous) images.push(amb.image);
  for (const un of matching.unmatchedImages) images.push(un.image);
  const seen = new Set<string>();
  return images.filter((img) => {
    if (seen.has(img.id)) return false;
    seen.add(img.id);
    return true;
  });
}

function isMatchDropped(imageId: string, _matching: BatchMatchingState): boolean {
  void _matching;
  void imageId;
  return false;
}
