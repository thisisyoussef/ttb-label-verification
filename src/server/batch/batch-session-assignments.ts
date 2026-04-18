import type { BatchResolution } from '../../shared/contracts/review';
import { createReviewExtractionFailure } from '../review-extraction';
import type {
  BatchSession,
  StoredBatchAssignment
} from './batch-session-types';

export function resolveBatchAssignments(
  session: BatchSession,
  resolutions: BatchResolution[]
): StoredBatchAssignment[] {
  const rowsById = new Map(session.rows.map((row) => [row.id, row]));
  const assignmentsByRowId = new Map<string, StoredBatchAssignment>();
  const assignments: StoredBatchAssignment[] = [];
  const assignedImageIds = new Set<string>();

  for (const matched of session.preflight.matching.matched) {
    const primaryImage = session.images.get(matched.imageId);
    const row = rowsById.get(matched.row.id);
    if (!primaryImage || !row) {
      continue;
    }

    const secondaryImage = matched.secondaryImageId
      ? session.images.get(matched.secondaryImageId) ?? null
      : null;

    assignments.push({
      primaryImage,
      secondaryImage,
      row
    });
    assignmentsByRowId.set(row.id, assignments[assignments.length - 1]!);
    assignedImageIds.add(primaryImage.id);
    if (secondaryImage) {
      assignedImageIds.add(secondaryImage.id);
    }
  }

  const resolutionByImageId = new Map(
    resolutions.map((resolution) => [resolution.imageId, resolution])
  );
  const unresolvedImageIds = new Set([
    ...session.preflight.matching.ambiguous.map((entry) => entry.imageId),
    ...session.preflight.matching.unmatchedImageIds
  ]);

  for (const imageId of unresolvedImageIds) {
    if (assignedImageIds.has(imageId)) {
      continue;
    }

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

    const existingAssignment = assignmentsByRowId.get(row.id);
    if (!existingAssignment) {
      const assignment: StoredBatchAssignment = {
        primaryImage: image,
        secondaryImage: null,
        row
      };
      assignments.push(assignment);
      assignmentsByRowId.set(row.id, assignment);
      assignedImageIds.add(image.id);
      continue;
    }

    if (existingAssignment.secondaryImage) {
      throw createReviewExtractionFailure({
        status: 400,
        kind: 'validation',
        message: 'A CSV row was assigned to more than two images.',
        retryable: false
      });
    }

    existingAssignment.secondaryImage = image;
    assignedImageIds.add(image.id);
  }

  return assignments;
}
