import { useMemo, useState } from 'react';

import type {
  BatchDashboardFilter,
  BatchDashboardRow,
  BatchDashboardSeed,
  BatchDashboardSort
} from './batchTypes';
import {
  ActionBar,
  countRowsByFilter,
  FILTER_EMPTY_LABEL,
  FILTER_LABELS,
  FILTER_ORDER,
  FilterPill,
  SORT_OPTIONS,
  sortRows,
  SummaryCards,
  filterRows
} from './BatchDashboardControls';
import { EmptyFilter, TriageTable } from './BatchDashboardTable';

interface BatchDashboardProps {
  seed: BatchDashboardSeed;
  reviewedIds: Set<string>;
  exportState: ExportState;
  onOpenRow: (
    row: BatchDashboardRow,
    filter: BatchDashboardFilter,
    rowsInView: BatchDashboardRow[]
  ) => void;
  onRetryRow: (row: BatchDashboardRow) => void;
  onStartAnotherBatch: () => void;
  onBeginExport: () => void;
  onConfirmExport: () => void;
  onCancelExport: () => void;
  onRetryExport: () => void;
}

export type ExportState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'in-progress' }
  | { kind: 'error'; message: string };

export function BatchDashboard(props: BatchDashboardProps) {
  const { seed, reviewedIds, exportState } = props;
  const [filter, setFilter] = useState<BatchDashboardFilter>('all');
  const [sort, setSort] = useState<BatchDashboardSort>('worst-first');

  const filterCounts = useMemo(() => countRowsByFilter(seed.rows), [seed.rows]);
  const visibleRows = useMemo(
    () => sortRows(filterRows(seed.rows, filter), sort),
    [seed.rows, filter, sort]
  );

  const intentLine = useMemo(() => {
    if (seed.phase === 'cancelled-partial') {
      return `${seed.totals.done} reviewed of ${seed.totals.started} started · Batch cancelled`;
    }
    if (seed.summary.pass === seed.totals.done && seed.totals.done > 0) {
      return 'Every label in this batch was approved.';
    }
    if (seed.summary.fail === seed.totals.done && seed.totals.done > 0) {
      return 'Every label in this batch was rejected.';
    }
    return `Reviewing outcomes for ${seed.totals.done} labels. Nothing is stored.`;
  }, [seed.phase, seed.summary, seed.totals]);

  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 py-6 xl:py-10">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            Batch Results
          </h1>
          <p className="text-on-surface-variant font-body">{intentLine}</p>
        </header>

        <SummaryCards
          pass={seed.summary.pass}
          review={seed.summary.review}
          fail={seed.summary.fail}
        />

        <section
          aria-label="Filter and sort controls"
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-surface-container-low rounded-lg px-4 py-3"
        >
          <div role="tablist" aria-label="Filter rows" className="flex items-center gap-1 flex-wrap">
            {FILTER_ORDER.map((key) => (
              <FilterPill
                key={key}
                label={FILTER_LABELS[key]}
                count={filterCounts[key]}
                active={filter === key}
                onClick={() => setFilter(key)}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as BatchDashboardSort)}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded px-2 py-1 text-sm font-body font-semibold text-on-surface focus:border-primary focus:ring-0 outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section aria-label="Triage table" className="flex flex-col">
          {visibleRows.length === 0 ? (
            <EmptyFilter label={FILTER_EMPTY_LABEL[filter]} onClear={() => setFilter('all')} />
          ) : (
            <TriageTable
              rows={visibleRows}
              reviewedIds={reviewedIds}
              onOpenRow={(row) => props.onOpenRow(row, filter, visibleRows)}
              onRetryRow={props.onRetryRow}
            />
          )}
        </section>

        <ActionBar
          exportState={exportState}
          onStartAnotherBatch={props.onStartAnotherBatch}
          onBeginExport={props.onBeginExport}
          onConfirmExport={props.onConfirmExport}
          onCancelExport={props.onCancelExport}
          onRetryExport={props.onRetryExport}
        />
      </div>
    </div>
  );
}
