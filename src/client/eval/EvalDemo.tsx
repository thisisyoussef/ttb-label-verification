import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { EvalDemoControls } from './EvalDemoControls';
import { EvalDemoProgress } from './EvalDemoProgress';
import { EvalDemoResults } from './EvalDemoResults';
import {
  fetchEvalExport,
  fetchEvalPacks,
  fetchReport,
  prepareEvalRun,
  streamEvalRun,
  type EvalPack
} from './evalDemoApi';
import { evalRunReducer } from './evalDemoReducer';
import { INITIAL_RUN_STATE, type EvalRunConfig } from './evalDemoTypes';

const DEFAULT_CONFIG: EvalRunConfig = {
  packId: 'cola-cloud-mixed',
  provider: 'cloud',
  enableJudgment: true,
  enableOcrPrepass: true
};

export function EvalDemo() {
  const [packs, setPacks] = useState<EvalPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [config, setConfig] = useState<EvalRunConfig>(DEFAULT_CONFIG);
  const [state, dispatch] = useReducer(evalRunReducer, INITIAL_RUN_STATE);
  const [prepareProgress, setPrepareProgress] = useState<{ done: number; total: number } | null>(null);
  const [, forceTick] = useState(0);

  const [activeReport, setActiveReport] = useState<{ id: string; body: unknown } | null>(null);
  const [activeReportLoading, setActiveReportLoading] = useState(false);
  const [activeReportError, setActiveReportError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const imageMapRef = useRef<Map<string, import('./evalDemoApi').EvalPackImage>>(new Map());

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === config.packId) ?? null,
    [packs, config.packId]
  );

  const isRunning = state.phase === 'preparing' || state.phase === 'running';

  // Tick once per second while running so the elapsed clock updates.
  useEffect(() => {
    if (!isRunning && state.phase !== 'complete') return;
    const handle = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(handle);
  }, [isRunning, state.phase]);

  // Load packs from the server on mount.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPacksLoading(true);
      try {
        const result = await fetchEvalPacks(controller.signal);
        setPacks(result);
        setPacksError(null);
        // If default pack isn't available, pick the first one.
        if (result.length > 0 && !result.some((pack) => pack.id === config.packId)) {
          setConfig((previous) => ({ ...previous, packId: result[0]!.id }));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setPacksError(
          error instanceof Error ? error.message : 'Failed to load eval packs.'
        );
      } finally {
        setPacksLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = useCallback(async () => {
    if (!selectedPack) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'reset' });
    dispatch({ type: 'start-prepare', packId: selectedPack.id });
    setPrepareProgress({ done: 0, total: selectedPack.imageCount + 1 });

    try {
      const prepared = await prepareEvalRun({
        pack: selectedPack,
        onProgress: (done, total) => setPrepareProgress({ done, total })
      });
      imageMapRef.current = prepared.imageIdToPackImage;

      dispatch({
        type: 'start-run',
        batchSessionId: prepared.batchSessionId,
        total: prepared.preflight.matching.matched.length +
          prepared.preflight.matching.ambiguous.length
      });
      setPrepareProgress(null);

      await streamEvalRun({
        batchSessionId: prepared.batchSessionId,
        preflight: prepared.preflight,
        signal: controller.signal,
        onFrame: (frame) => {
          dispatch({
            type: 'stream-frame',
            frame,
            imageIdToPackImage: imageMapRef.current,
            nowMs: Date.now()
          });
        }
      });

      dispatch({ type: 'run-complete', nowMs: Date.now() });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      dispatch({
        type: 'run-error',
        message: error instanceof Error ? error.message : 'Run failed.'
      });
    } finally {
      setPrepareProgress(null);
    }
  }, [selectedPack]);

  const onCancel = useCallback(() => {
    abortRef.current?.abort();
    if (state.batchSessionId) {
      // Best-effort server-side cancel; ignore failures.
      void fetch(`/api/batch/${state.batchSessionId}/cancel`, {
        method: 'POST'
      });
    }
    dispatch({
      type: 'run-error',
      message: 'Run cancelled by user.'
    });
  }, [state.batchSessionId]);

  const onReset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'reset' });
    setActiveReport(null);
    setActiveReportError(null);
    setActiveReportLoading(false);
    setPrepareProgress(null);
  }, []);

  const onDownloadJson = useCallback(async () => {
    if (!state.batchSessionId) return;
    try {
      const payload = await fetchEvalExport(state.batchSessionId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ttb-eval-${state.packId ?? 'run'}-${state.batchSessionId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Download failed', error);
    }
  }, [state.batchSessionId, state.packId]);

  const onLoadReport = useCallback(
    async (reportId: string) => {
      // Always open the drawer so the user gets feedback, even when the
      // session has been reset. Previously the click silently no-op'd if
      // batchSessionId was null, making the button appear broken.
      setActiveReport({ id: reportId, body: null });
      setActiveReportLoading(true);
      setActiveReportError(null);
      if (!state.batchSessionId) {
        setActiveReportLoading(false);
        setActiveReportError(
          'Batch session has been reset. Re-run the eval to view this report.'
        );
        return;
      }
      try {
        const report = await fetchReport(state.batchSessionId, reportId);
        setActiveReport({ id: reportId, body: report });
      } catch (error) {
        setActiveReportError(
          error instanceof Error ? error.message : 'Failed to load report.'
        );
      } finally {
        setActiveReportLoading(false);
      }
    },
    [state.batchSessionId]
  );

  const onCloseDrawer = useCallback(() => {
    setActiveReport(null);
    setActiveReportError(null);
    setActiveReportLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-headline text-xl text-on-surface">TTB Eval Demo</h1>
            <p className="text-sm text-on-surface-variant">
              Stakeholder / QA demo — run a golden set pack and watch results stream in.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs uppercase tracking-wide text-on-surface-variant">
              Model
            </div>
            <div className="font-medium text-on-surface">
              {config.provider === 'cloud' ? 'Gemini (cloud)' : 'Qwen2.5-VL-3B (local)'}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {packsError ? (
          <div className="rounded-lg border border-error bg-error-container p-3 text-sm text-on-error-container">
            Failed to load packs: {packsError}
          </div>
        ) : null}

        <EvalDemoControls
          packs={packs}
          config={config}
          onChange={setConfig}
          disabled={isRunning || packsLoading}
          onStart={onStart}
          onCancel={onCancel}
          onReset={onReset}
          isRunning={isRunning}
          canRun={Boolean(selectedPack) && !isRunning && !packsLoading}
        />

        {prepareProgress ? (
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-ambient">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-on-surface">Loading fixtures…</span>
              <span className="font-mono text-xs text-on-surface-variant">
                {prepareProgress.done} / {prepareProgress.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{
                  width: `${Math.min(100, Math.round((prepareProgress.done / prepareProgress.total) * 100))}%`
                }}
              />
            </div>
          </section>
        ) : null}

        {state.phase !== 'idle' ? (
          <EvalDemoProgress state={state} pack={selectedPack} />
        ) : null}

        {state.items.length > 0 ? (
          <EvalDemoResults
            state={state}
            onDownloadJson={onDownloadJson}
            onLoadReport={onLoadReport}
            activeReport={activeReport}
            activeReportError={activeReportError}
            activeReportLoading={activeReportLoading}
            onCloseDrawer={onCloseDrawer}
          />
        ) : null}

        <footer className="pt-4 text-center text-xs text-on-surface-variant">
          Eval demo — ephemeral, no persistence. Session ID:{' '}
          <code className="font-mono">{state.batchSessionId ?? '—'}</code>
        </footer>
      </main>
    </div>
  );
}
