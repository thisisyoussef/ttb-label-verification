import type { BatchResolution } from '../shared/contracts/review';
import { createReviewExtractionFailure } from './review-extraction';
import type {
  BatchSession,
  StoredBatchAssignment
} from './batch-session-types';

export function resolveBatchAssignments(
  session: BatchSession,
  resolutions: BatchResolution[]
): StoredBatchAssignment[] {
  const rowsById = new Map(session.rows.map((row) => [row.id, row]));
  const assignedRowIds = new Set<string>();
  const assignments: StoredBatchAssignment[] = [];

  for (const matched of session.preflight.matching.matched) {
    const image = session.images.get(matched.imageId);
    const row = rowsById.get(matched.row.id);
    if (!image || !row) {
      continue;
    }

    assignedRowIds.add(row.id);
    assignments.push({ image, row });
  }

  const resolutionByImageId = new Map(
    resolutions.map((resolution) => [resolution.imageId, resolution])
  );
  const unresolvedImageIds = new Set([
    ...session.preflight.matching.ambiguous.map((entry) => entry.imageId),
    ...session.preflight.matching.unmatchedImageIds
  ]);

  for (const imageId of unresolvedImageIds) {
    const resolution = resolutionByImageId.get(imageId);
    if (!resolution) {
      throw createReviewExtractionFailure({
        status: 400,
        kind: 'validation',
        message:
          'Resolve every ambiguous or unmatched image before starting the batch.',
        retryable: false
      });
    }

    if (resolution.action.kind === 'dropped') {
      continue;
    }

    const image = session.images.get(imageId);
    const row = rowsById.get(resolution.action.rowId);
    if (!image || !row) {
      throw createReviewExtractionFailure({
        status: 400,
        kind: 'validation',
        message: 'One of the selected row matches was not available.',
        retryable: false
      });
    }

    if (assignedRowIds.has(row.id)) {
      throw createReviewExtractionFailure({
        status: 400,
        kind: 'validation',
        message: 'A CSV row was assigned to more than one image.',
        retryable: false
      });
    }

    assignedRowIds.add(row.id);
    assignments.push({ image, row });
  }

  return assignments;
}
