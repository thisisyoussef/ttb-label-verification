import { useCallback, useState } from 'react';
import { batchDashboardResponseSchema } from '../shared/contracts/review';
import { DEFAULT_DASHBOARD_SEED_ID, findDashboardSeed } from './batchDashboardScenarios';
import { buildDashboardSeedFromResponse } from './batch-runtime';
import { fetchBatchDashboard, fetchBatchReport, parseApiError } from './appReviewApi';
import type { View } from './appTypes';
import type {
  BatchDashboardFilter,
  BatchDashboardRow,
  BatchDashboardSeed,
  BatchLabelImage
} from './batchTypes';
import type { ExportState } from './BatchDashboard';
import type { UIVerificationReport } from './types';

export interface BatchDashboardFlow {
  dashboardSeedId: string;
  dashboardSeed: BatchDashboardSeed;
  reviewedRowIds: Set<string>;
  retryingRowIds: Set<string>;
  drillInRowId: string | null;
  drillInFilter: BatchDashboardFilter;
  drillInRows: BatchDashboardRow[];
  drillInReport: UIVerificationReport | null;
  exportState: ExportState;
  setExportState: (value: ExportState) => void;
  onBatchOpenDashboard: () => void;
  onSelectDashboardSeed: (id: string) => void;
  onOpenDashboardRow: (
    row: BatchDashboardRow,
    filter: BatchDashboardFilter,
    rowsInView: BatchDashboardRow[]
  ) => void;
  onDrillInPrevious: () => void;
  onDrillInNext: () => void;
  onRetryDashboardRow: (row: BatchDashboardRow) => void;
  onDashboardBack: () => void;
  onStartAnotherBatch: () => void;
  onBeginExport: () => void;
  onCancelExport: () => void;
  onRetryExport: () => void;
  onConfirmExport: () => void;
  resetDashboardSeed: () => void;
  reset: () => void;
}

export function useBatchDashboardFlow(options: {
  fixtureControlsEnabled: boolean;
  fixtureModeActive: boolean;
  setView: (view: View) => void;
  batchSessionId: string | null;
  batchSeedImages: BatchLabelImage[];
  batchStreamSeedId: string;
  resetLiveBatch: () => void;
  setBatchSeedError: (message: string) => void;
}): BatchDashboardFlow {
  const [dashboardSeedId, setDashboardSeedId] = useState<string>(DEFAULT_DASHBOARD_SEED_ID);
  const [dashboardSeed, setDashboardSeed] = useState<BatchDashboardSeed>(() =>
    findDashboardSeed(DEFAULT_DASHBOARD_SEED_ID)
  );
  const [reviewedRowIds, setReviewedRowIds] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [retryingRowIds, setRetryingRowIds] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [drillInRowId, setDrillInRowId] = useState<string | null>(null);
  const [drillInFilter, setDrillInFilter] = useState<BatchDashboardFilter>('all');
  const [drillInRows, setDrillInRows] = useState<BatchDashboardRow[]>([]);
  const [drillInReport, setDrillInReport] = useState<UIVerificationReport | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' });

  const resetDashboardState = useCallback(() => {
    setReviewedRowIds(new Set<string>());
    setRetryingRowIds(new Set<string>());
    setDrillInRowId(null);
    setDrillInFilter('all');
    setDrillInRows([]);
    setDrillInReport(null);
    setExportState({ kind: 'idle' });
  }, []);

  const applyDashboardSeed = useCallback(
    (id: string, openDashboard: boolean) => {
      setDashboardSeedId(id);
      setDashboardSeed(findDashboardSeed(id));
      resetDashboardState();
      if (openDashboard) {
        options.setView('batch-dashboard');
      }
    },
    [options.setView, resetDashboardState]
  );

  const moveDrillIn = useCallback(
    async (rows: BatchDashboardRow[], currentRowId: string | null, offset: -1 | 1) => {
      if (currentRowId === null) {
        return;
      }

      const index = rows.findIndex((row) => row.rowId === currentRowId);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) {
        return;
      }

      const nextRow = rows[nextIndex]!;
      let nextReport: UIVerificationReport | null = null;
      try {
        if (!options.fixtureModeActive && options.batchSessionId && nextRow.reportId) {
          nextReport = await fetchBatchReport(options.batchSessionId, nextRow.reportId);
        }
      } catch {
        nextReport = null;
      }

      setReviewedRowIds((previous) => {
        const next = new Set(previous);
        next.add(nextRow.rowId);
        return next;
      });
      setDrillInReport(nextReport);
      setDrillInRowId(nextRow.rowId);
    },
    [options.batchSessionId, options.fixtureModeActive]
  );

  return {
    dashboardSeedId,
    dashboardSeed,
    reviewedRowIds,
    retryingRowIds,
    drillInRowId,
    drillInFilter,
    drillInRows,
    drillInReport,
    exportState,
    setExportState,
    onBatchOpenDashboard: () => {
      if (options.fixtureModeActive) {
        const matchingDashboardId = options.batchStreamSeedId.includes('all-pass')
          ? 'dash-terminal-all-pass'
          : options.batchStreamSeedId.includes('all-fail')
            ? 'dash-terminal-all-fail'
            : options.batchStreamSeedId.includes('cancelled')
              ? 'dash-cancelled-partial'
              : DEFAULT_DASHBOARD_SEED_ID;
        applyDashboardSeed(matchingDashboardId, true);
        return;
      }

      if (!options.batchSessionId) {
        return;
      }

      void (async () => {
        try {
          const response = await fetchBatchDashboard(options.batchSessionId as string);
          setDashboardSeed(
            buildDashboardSeedFromResponse({
              batchSessionId: options.batchSessionId as string,
              response,
              images: options.batchSeedImages
            })
          );
          resetDashboardState();
          options.setView('batch-dashboard');
        } catch {
          options.setBatchSeedError('We could not load this batch right now.');
        }
      })();
    },
    onSelectDashboardSeed: (id) => {
      if (!options.fixtureControlsEnabled) {
        return;
      }

      applyDashboardSeed(id, true);
    },
    onOpenDashboardRow: (row, filter, rowsInView) => {
      void (async () => {
        let nextReport: UIVerificationReport | null = null;
        try {
          if (!options.fixtureModeActive && options.batchSessionId && row.reportId) {
            nextReport = await fetchBatchReport(options.batchSessionId, row.reportId);
          }
        } catch {
          nextReport = null;
        }

        setDrillInReport(nextReport);
        setDrillInRowId(row.rowId);
        setDrillInFilter(filter);
        setDrillInRows(rowsInView);
        setReviewedRowIds((previous) => {
          const next = new Set(previous);
          next.add(row.rowId);
          return next;
        });
        options.setView('batch-result');
      })();
    },
    onDrillInPrevious: () => {
      void moveDrillIn(drillInRows, drillInRowId, -1);
    },
    onDrillInNext: () => {
      void moveDrillIn(drillInRows, drillInRowId, 1);
    },
    onRetryDashboardRow: (row) => {
      if (options.fixtureModeActive) {
        setDashboardSeed((previous) => {
          const nextRows = previous.rows.map((candidate) =>
            candidate.rowId === row.rowId && candidate.status === 'error'
              ? {
                  ...candidate,
                  status: 'review' as const,
                  errorMessage: null,
                  scenarioId: 'low-quality-image',
                  reportId: `retry-${candidate.rowId}`
                }
              : candidate
          );
          const summary = nextRows.reduce(
            (accumulator, candidate) => {
              if (candidate.status === 'pass') accumulator.pass += 1;
              else if (candidate.status === 'review') accumulator.review += 1;
              else if (candidate.status === 'fail') accumulator.fail += 1;
              else if (candidate.status === 'error') accumulator.error += 1;
              return accumulator;
            },
            { pass: 0, review: 0, fail: 0, error: 0 }
          );
          return { ...previous, rows: nextRows, summary };
        });
        return;
      }

      if (!options.batchSessionId) {
        return;
      }

      void (async () => {
        setRetryingRowIds((previous) => new Set(previous).add(row.rowId));
        try {
          const response = await fetch(
            `/api/batch/${options.batchSessionId}/retry/${row.imageId}`,
            {
              method: 'POST'
            }
          );
          if (!response.ok) {
            const message = await parseApiError(
              response,
              "We couldn't retry this item right now."
            );
            setDashboardSeed((previous) => ({
              ...previous,
              rows: previous.rows.map((candidate) =>
                candidate.rowId === row.rowId
                  ? {
                      ...candidate,
                      errorMessage: message
                    }
                  : candidate
              )
            }));
            return;
          }
          const dashboard = batchDashboardResponseSchema.parse(await response.json());
          setDashboardSeed(
            buildDashboardSeedFromResponse({
              batchSessionId: options.batchSessionId as string,
              response: dashboard,
              images: options.batchSeedImages
            })
          );
        } finally {
          setRetryingRowIds((previous) => {
            const next = new Set(previous);
            next.delete(row.rowId);
            return next;
          });
        }
      })();
    },
    onDashboardBack: () => {
      setDrillInRowId(null);
      setDrillInReport(null);
      options.setView('batch-dashboard');
    },
    onStartAnotherBatch: () => {
      resetDashboardState();
      options.resetLiveBatch();
      options.setView('batch-intake');
    },
    onBeginExport: () => setExportState({ kind: 'confirming' }),
    onCancelExport: () => setExportState({ kind: 'idle' }),
    onRetryExport: () => setExportState({ kind: 'confirming' }),
    onConfirmExport: () => {
      void (async () => {
        setExportState({ kind: 'in-progress' });
        try {
          if (!options.fixtureModeActive && options.batchSessionId) {
            const response = await fetch(`/api/batch/${options.batchSessionId}/export`);
            if (!response.ok) {
              throw new Error(await parseApiError(response, "Export didn't complete. Try again."));
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `ttb-batch-${options.batchSessionId}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            setExportState({ kind: 'idle' });
            return;
          }

          const payload = {
            generatedAt: new Date().toISOString(),
            phase: dashboardSeed.phase,
            totals: dashboardSeed.totals,
            summary: dashboardSeed.summary,
            rows: dashboardSeed.rows.map((row) => ({
              rowId: row.rowId,
              reportId: row.reportId,
              filename: row.filename,
              brandName: row.brandName,
              classType: row.classType,
              beverageType: row.beverageType,
              status: row.status,
              issues: row.issues,
              confidenceState: row.confidenceState,
              errorMessage: row.errorMessage,
              completedOrder: row.completedOrder
            })),
            noPersistence: true
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: 'application/json'
          });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `ttb-batch-${dashboardSeed.id}.json`;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
          setExportState({ kind: 'idle' });
        } catch (error) {
          setExportState({
            kind: 'error',
            message:
              error instanceof Error ? error.message : "Export didn't complete. Try again."
          });
        }
      })();
    },
    resetDashboardSeed: () => {
      applyDashboardSeed(DEFAULT_DASHBOARD_SEED_ID, false);
    },
    reset: () => {
      resetDashboardState();
    }
  };
}
