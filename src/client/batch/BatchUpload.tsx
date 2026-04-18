import { useCallback, useMemo, useState } from 'react';

import type { SeedBatch } from './batchScenarios';
import { CsvDropZone, ImagesDropZone } from './BatchUploadDropZones';
import {
  CountStrip,
  FileErrorList,
  PrivacyActionBar,
  type BatchUploadCounts
} from './BatchUploadPanels';
import { MatchingReview } from './MatchingReview';
import type {
  BatchAmbiguousItem,
  BatchLabelImage,
  BatchUnmatchedImage,
  BatchUnmatchedRow
} from './batchTypes';

interface BatchUploadProps {
  seed: SeedBatch;
  interactive?: boolean;
  onReturnToSingle: () => void;
  onStartBatch: () => void;
  onSelectImages?: (files: File[]) => void;
  onRemoveImage?: (imageId: string) => void;
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
  const { ambiguousUnresolved, unmatchedUnresolved, startDisabled, counts } = useMemo(
    () => summarize(seed),
    [seed]
  );

  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const loadSamplePack = useCallback(async () => {
    if (!props.onSelectImages || !props.onSelectCsv) return;
    setSampleLoading(true);
    setSampleError(null);
    try {
      const packsRes = await fetch('/api/eval/packs');
      if (!packsRes.ok) throw new Error(`packs HTTP ${packsRes.status}`);
      const packsData = (await packsRes.json()) as {
        packs: Array<{
          id: string;
          csvFile: string;
          images: Array<{ id: string; filename: string; assetPath: string; beverageType: string }>;
        }>;
      };
      const pack = packsData.packs.find((p) => p.id === 'cola-cloud-all');
      if (!pack) throw new Error('cola-cloud-all pack missing');

      const csvRes = await fetch(`/api/eval/pack/${encodeURIComponent(pack.id)}/csv`);
      if (!csvRes.ok) throw new Error(`csv HTTP ${csvRes.status}`);
      const csvBlob = await csvRes.blob();
      const csvFile = new File([csvBlob], pack.csvFile, { type: 'text/csv' });

      // Pull the first N images from the pack. We cap the batch at 10 so
      // the first-run demo feels quick — users can hit the button again
      // or switch to a bigger pack if they want the full 28.
      const MAX_PACK_IMAGES = 10;
      const slice = pack.images.slice(0, MAX_PACK_IMAGES);
      const imageFiles: File[] = [];
      for (const img of slice) {
        const source = img.assetPath.split('/')[3] ?? 'cola-cloud';
        const url = `/api/eval/label-image/${encodeURIComponent(source)}/${encodeURIComponent(img.filename)}`;
        const imgRes = await fetch(url);
        if (!imgRes.ok) continue;
        const blob = await imgRes.blob();
        imageFiles.push(new File([blob], img.filename, { type: blob.type || 'image/webp' }));
      }

      if (imageFiles.length > 0) props.onSelectImages(imageFiles);
      props.onSelectCsv(csvFile);
    } catch (err) {
      setSampleError((err as Error).message);
    } finally {
      setSampleLoading(false);
    }
  }, [props]);

  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 py-6 xl:py-10">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            Batch Upload
          </h1>
          <p className="text-on-surface-variant font-body">
            Upload many label images and one CSV of application data. Nothing is stored.
          </p>
        </header>

        {props.interactive ? (
          <section
            aria-label="Quick-load sample pack"
            className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-outline-variant/60 bg-surface-container-lowest px-4 py-3"
          >
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[18px] text-on-surface-variant"
            >
              science
            </span>
            <div className="flex-1 min-w-[240px]">
              <p className="font-label text-xs font-semibold text-on-surface">
                Try it with real TTB-approved COLA labels
              </p>
              <p className="text-xs text-on-surface-variant leading-snug">
                One click populates 10 sample labels + their matching application CSV.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSamplePack()}
              disabled={sampleLoading}
              className="rounded-md bg-primary text-on-primary px-3 py-1.5 text-sm font-label font-semibold transition-colors hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed"
            >
              {sampleLoading ? 'Loading…' : 'Load COLA sample pack'}
            </button>
            {sampleError ? (
              <span className="text-xs text-error basis-full">Couldn't load — {sampleError}</span>
            ) : null}
          </section>
        ) : null}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ImagesDropZone
            images={seed.images}
            overCap={seed.overCap}
            interactive={props.interactive === true}
            onSelectImages={props.onSelectImages}
            onRemoveImage={props.onRemoveImage}
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
              {counts.matched} matched · {counts.ambiguous} ambiguous · {counts.unmatched}{' '}
              unmatched
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

function summarize(seed: SeedBatch): {
  ambiguousUnresolved: number;
  unmatchedUnresolved: number;
  startDisabled: boolean;
  counts: BatchUploadCounts;
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

  const counts: BatchUploadCounts = {
    images: seed.images.length,
    csvRows: seed.csv?.rowCount ?? 0,
    matched: seed.matching.matched.length,
    ambiguous: seed.matching.ambiguous.length,
    unmatched: seed.matching.unmatchedImages.length + seed.matching.unmatchedRows.length
  };

  return { ambiguousUnresolved, unmatchedUnresolved, startDisabled, counts };
}

export type { BatchAmbiguousItem, BatchUnmatchedImage, BatchUnmatchedRow };
