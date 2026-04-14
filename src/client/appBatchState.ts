import { DEFAULT_DASHBOARD_SEED_ID, findDashboardSeed } from './batchDashboardScenarios';
import { type SeedBatch } from './batchScenarios';
import type {
  BatchMatchingState,
  BatchStreamItem,
  BatchTerminalSummary
} from './batchTypes';

export function emptyBatchSeedState(): SeedBatch {
  return {
    id: 'live-batch',
    label: 'Live batch',
    description: 'Live batch review session',
    images: [],
    csv: null,
    csvError: null,
    fileErrors: [],
    overCap: false,
    matching: {
      matched: [],
      ambiguous: [],
      unmatchedImages: [],
      unmatchedRows: []
    }
  };
}

export function defaultDashboardSeed() {
  return findDashboardSeed(DEFAULT_DASHBOARD_SEED_ID);
}

export function cloneSeed(seed: SeedBatch): SeedBatch {
  return {
    ...seed,
    images: seed.images.map((image) => ({ ...image })),
    csv: seed.csv
      ? { ...seed.csv, rows: seed.csv.rows.map((row) => ({ ...row })) }
      : null,
    fileErrors: seed.fileErrors.map((entry) => ({ ...entry })),
    matching: {
      matched: seed.matching.matched.map((entry) => ({ ...entry })),
      ambiguous: seed.matching.ambiguous.map((entry) => ({
        ...entry,
        candidates: entry.candidates.map((candidate) => ({ ...candidate }))
      })),
      unmatchedImages: seed.matching.unmatchedImages.map((entry) => ({ ...entry })),
      unmatchedRows: seed.matching.unmatchedRows.map((entry) => ({ ...entry }))
    }
  };
}

type MatchingAction =
  | { type: 'pick-ambiguous'; imageId: string; rowId: string }
  | { type: 'drop-ambiguous'; imageId: string }
  | { type: 'pair-unmatched-image'; imageId: string; rowId: string }
  | { type: 'drop-unmatched-image'; imageId: string }
  | { type: 'pair-unmatched-row'; rowId: string; imageId: string }
  | { type: 'drop-unmatched-row'; rowId: string };

export function updateMatching(seed: SeedBatch, action: MatchingAction): SeedBatch {
  const matching: BatchMatchingState = {
    matched: seed.matching.matched.map((entry) => ({ ...entry })),
    ambiguous: seed.matching.ambiguous.map((entry) => ({
      ...entry,
      candidates: entry.candidates.map((candidate) => ({ ...candidate }))
    })),
    unmatchedImages: seed.matching.unmatchedImages.map((entry) => ({ ...entry })),
    unmatchedRows: seed.matching.unmatchedRows.map((entry) => ({ ...entry }))
  };

  switch (action.type) {
    case 'pick-ambiguous':
      matching.ambiguous = matching.ambiguous.map((item) =>
        item.image.id === action.imageId
          ? { ...item, chosenRowId: action.rowId, dropped: false }
          : item
      );
      break;
    case 'drop-ambiguous':
      matching.ambiguous = matching.ambiguous.map((item) =>
        item.image.id === action.imageId
          ? { ...item, dropped: true, chosenRowId: null }
          : item
      );
      break;
    case 'pair-unmatched-image':
      matching.unmatchedImages = matching.unmatchedImages.map((item) =>
        item.image.id === action.imageId
          ? { ...item, pairedRowId: action.rowId, dropped: false }
          : item
      );
      break;
    case 'drop-unmatched-image':
      matching.unmatchedImages = matching.unmatchedImages.map((item) =>
        item.image.id === action.imageId
          ? { ...item, dropped: true, pairedRowId: null }
          : item
      );
      break;
    case 'pair-unmatched-row':
      matching.unmatchedRows = matching.unmatchedRows.map((item) =>
        item.row.id === action.rowId
          ? { ...item, pairedImageId: action.imageId, dropped: false }
          : item
      );
      break;
    case 'drop-unmatched-row':
      matching.unmatchedRows = matching.unmatchedRows.map((item) =>
        item.row.id === action.rowId
          ? { ...item, dropped: true, pairedImageId: null }
          : item
      );
      break;
  }

  return { ...seed, matching };
}

export function summarizeItems(
  items: BatchStreamItem[],
  total: number
): BatchTerminalSummary {
  const summary: BatchTerminalSummary = {
    total,
    pass: 0,
    review: 0,
    fail: 0,
    error: 0
  };

  for (const item of items) {
    switch (item.status) {
      case 'pass':
        summary.pass += 1;
        break;
      case 'review':
        summary.review += 1;
        break;
      case 'fail':
        summary.fail += 1;
        break;
      case 'error':
        summary.error += 1;
        break;
    }
  }

  return summary;
}

export function countRunnableBatchItems(matching: BatchMatchingState) {
  return (
    matching.matched.length +
    matching.ambiguous.filter((item) => !item.dropped && item.chosenRowId !== null).length +
    matching.unmatchedImages.filter(
      (item) => !item.dropped && item.pairedRowId !== null
    ).length
  );
}
