import { useState } from 'react';
import {
  allImages,
  DropFromBatchButton,
  DroppedState,
  GroupShell,
  ItemHeader,
  LabelThumb,
  RowHeader,
  RowIndexChip
} from './MatchingReviewPrimitives';
import type {
  BatchAmbiguousItem,
  BatchCsvRow,
  BatchLabelImage,
  BatchMatchingState,
  BatchUnmatchedImage,
  BatchUnmatchedRow
} from './batchTypes';

export function AmbiguousGroup({
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
  const unresolved = items.filter((item) => !item.dropped && item.chosenRowId === null).length;
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

export function UnmatchedImagesGroup({
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

export function UnmatchedRowsGroup({
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

export function MatchedGroup({
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
      onToggle={() => setExpanded((value) => !value)}
    >
      {expanded ? (
        <ul className="flex flex-col divide-y divide-outline-variant/10">
          {matched.map((pair) => (
            <li
              key={pair.image.id}
              className="py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
            >
              <div className="md:col-span-5 flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2">
                  <LabelThumb
                    image={pair.image}
                    size="sm"
                    onPreview={() => onPreviewImage(pair.image)}
                  />
                  {pair.secondaryImage ? (
                    <LabelThumb
                      image={pair.secondaryImage}
                      size="sm"
                      onPreview={() => onPreviewImage(pair.secondaryImage!)}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex flex-col gap-0.5">
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
                  {pair.secondaryImage ? (
                    <button
                      type="button"
                      onClick={() => onPreviewImage(pair.secondaryImage!)}
                      className="font-mono text-xs text-on-surface-variant truncate hover:underline text-left"
                    >
                      {pair.secondaryImage.filename}
                    </button>
                  ) : null}
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

export function unmatchedRowImages(matching: BatchMatchingState) {
  return allImages(matching);
}
