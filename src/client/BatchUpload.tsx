import { useMemo } from 'react';

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
