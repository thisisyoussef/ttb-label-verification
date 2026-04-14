import {
  allCsvRows,
  EmptyPanel,
  isMatchDropped,
  MatchingExplanation
} from './MatchingReviewPrimitives';
import {
  AmbiguousGroup,
  MatchedGroup,
  UnmatchedImagesGroup,
  UnmatchedRowsGroup,
  unmatchedRowImages
} from './MatchingReviewGroups';
import type { BatchLabelImage, BatchMatchingState } from './batchTypes';

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

  return (
    <div className="flex flex-col gap-4">
      <MatchingExplanation />
      <AmbiguousGroup
        items={matching.ambiguous}
        onPick={props.onPickAmbiguous}
        onDrop={props.onDropAmbiguous}
        onPreviewImage={props.onPreviewImage}
      />
      <UnmatchedImagesGroup
        items={matching.unmatchedImages}
        rows={allCsvRows(matching)}
        onPair={props.onPairUnmatchedImage}
        onDrop={props.onDropUnmatchedImage}
        onPreviewImage={props.onPreviewImage}
      />
      <UnmatchedRowsGroup
        items={matching.unmatchedRows}
        images={unmatchedRowImages(matching)}
        onPair={props.onPairUnmatchedRow}
        onDrop={props.onDropUnmatchedRow}
      />
      <MatchedGroup
        matched={matching.matched.filter((pair) => !isMatchDropped(pair.image.id, matching))}
        onPreviewImage={props.onPreviewImage}
      />
    </div>
  );
}
