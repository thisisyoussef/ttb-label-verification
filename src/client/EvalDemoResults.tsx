import { useMemo, useState } from 'react';

import type { BatchItemStatus } from '../shared/contracts/review';
import { imageUrlFor } from './evalDemoApi';
import type { EvalRunState } from './evalDemoTypes';

interface EvalDemoResultsProps {
  state: EvalRunState;
  onDownloadJson: () => void;
  onLoadReport: (reportId: string) => void;
  activeReport: { id: string; body: unknown } | null;
  activeReportError: string | null;
  activeReportLoading: boolean;
  onCloseDrawer: () => void;
}

function statusBadge(status: BatchItemStatus) {
  switch (status) {
    case 'pass':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container">
          pass
        </span>
      );
    case 'review':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-caution-container px-2 py-0.5 text-xs font-medium text-on-caution-container">
          review
        </span>
      );
    case 'fail':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-xs font-medium text-on-error-container">
          fail
        </span>
      );
    case 'error':
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface">
          error
        </span>
      );
  }
}

// We target consistent <5s per-label latency. The eval surfaces a warning
// indicator on any row that crossed this budget so slow labels are easy
// to spot at a glance.
const LATENCY_WARNING_THRESHOLD_MS = 5000;

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function LatencyCell({ ms }: { ms: number | null | undefined }) {
  if (ms == null) {
    return <span className="text-on-surface-variant">—</span>;
  }
  const overBudget = ms > LATENCY_WARNING_THRESHOLD_MS;
  return (
    <span
      className={
        overBudget
          ? 'inline-flex items-center gap-1 font-semibold text-error'
          : 'text-on-surface'
      }
      title={
        overBudget
          ? `Exceeded ${LATENCY_WARNING_THRESHOLD_MS / 1000}s target latency`
          : undefined
      }
    >
      {overBudget ? (
        <span aria-hidden="true" className="inline-block">
          ⚠
        </span>
      ) : null}
      {formatLatency(ms)}
    </span>
  );
}

export function EvalDemoResults(props: EvalDemoResultsProps) {
  const { state, onDownloadJson, onLoadReport, activeReport, activeReportError, activeReportLoading, onCloseDrawer } = props;
  const [filter, setFilter] = useState<'all' | BatchItemStatus>('all');

  const rows = useMemo(() => {
    const ordered = [...state.items].sort((a, b) => a.startedAtMs - b.startedAtMs);
    if (filter === 'all') return ordered;
    return ordered.filter((row) => row.status === filter);
  }, [state.items, filter]);

  if (state.items.length === 0 && state.phase !== 'complete') {
    return null;
  }

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-ambient">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-lg text-on-surface">Results</h2>
          <p className="text-sm text-on-surface-variant">
            {state.phase === 'complete'
              ? `Completed ${state.items.length} labels`
              : `${state.items.length} labels so far`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterPill label="All" active={filter === 'all'} count={state.items.length} onClick={() => setFilter('all')} />
          <FilterPill label="Pass" active={filter === 'pass'} count={state.counts.pass} onClick={() => setFilter('pass')} />
          <FilterPill label="Review" active={filter === 'review'} count={state.counts.review} onClick={() => setFilter('review')} />
          <FilterPill label="Fail" active={filter === 'fail'} count={state.counts.fail} onClick={() => setFilter('fail')} />
          <FilterPill label="Error" active={filter === 'error'} count={state.counts.error} onClick={() => setFilter('error')} />
          <button
            type="button"
            onClick={onDownloadJson}
            disabled={state.phase !== 'complete'}
            className="ml-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-1 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            Download JSON
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-outline-variant">
        <table className="min-w-full divide-y divide-outline-variant text-sm">
          <thead className="bg-surface-container text-on-surface">
            <tr>
              <th className="w-14 px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left font-medium">Filename</th>
              <th className="px-3 py-2 text-left font-medium">Identity</th>
              <th className="w-28 px-3 py-2 text-left font-medium">Verdict</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Latency</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
            {rows.map((row) => (
              <tr key={row.imageId} className="hover:bg-surface-container">
                <td className="px-3 py-2">
                  {row.packImage ? (
                    <img
                      src={imageUrlFor(row.packImage)}
                      alt={row.filename}
                      className="h-10 w-10 rounded object-cover ring-1 ring-outline-variant"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-surface-container-high" />
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-on-surface">
                  <div className="truncate" title={row.filename}>
                    {row.filename}
                  </div>
                  {row.errorMessage ? (
                    <div className="mt-1 text-xs text-error">{row.errorMessage}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-on-surface">
                  <div className="truncate" title={row.identity}>
                    {row.identity}
                  </div>
                  {row.packImage?.expectedRecommendation ? (
                    <div className="text-xs text-on-surface-variant">
                      expected:{' '}
                      {row.packImage.expectedRecommendation === 'approve'
                        ? 'approve or review'
                        : row.packImage.expectedRecommendation}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2">{statusBadge(row.status)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  <LatencyCell ms={row.latencyMs} />
                </td>
                <td className="px-3 py-2 text-right">
                  {row.reportId ? (
                    <button
                      type="button"
                      className="rounded border border-outline-variant bg-surface-container px-2 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-high"
                      onClick={() => onLoadReport(row.reportId!)}
                    >
                      View JSON
                    </button>
                  ) : (
                    <span className="text-xs text-on-surface-variant">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-on-surface-variant">
            No labels matching this filter yet.
          </div>
        ) : null}
      </div>

      {activeReport !== null || activeReportLoading || activeReportError ? (
        <ReportDrawer
          activeReport={activeReport}
          loading={activeReportLoading}
          error={activeReportError}
          onClose={onCloseDrawer}
        />
      ) : null}
    </section>
  );
}

function FilterPill(props: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        props.active
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
      }`}
    >
      {props.label} <span className="opacity-70">({props.count})</span>
    </button>
  );
}

function ReportDrawer(props: {
  activeReport: { id: string; body: unknown } | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close drawer"
        className="flex-1 bg-on-surface/40"
        onClick={props.onClose}
      />
      <div className="flex h-full w-full max-w-xl flex-col bg-surface-container-lowest shadow-ambient">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <div className="font-headline text-base text-on-surface">
            Report: {props.activeReport?.id ?? '—'}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg bg-surface-container px-3 py-1 text-sm font-medium text-on-surface hover:bg-surface-container-high"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {props.loading ? (
            <div className="text-sm text-on-surface-variant">Loading…</div>
          ) : props.error ? (
            <div className="rounded-lg border border-error bg-error-container p-3 text-sm text-on-error-container">
              {props.error}
            </div>
          ) : props.activeReport ? (
            <pre className="max-h-full whitespace-pre-wrap break-words font-mono text-xs text-on-surface">
              {JSON.stringify(props.activeReport.body, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
