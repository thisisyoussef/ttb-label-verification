import { useCallback, useEffect, useState } from 'react';
import {
  syntheticLabelGenerateResponseSchema,
  type SyntheticLabelExpected
} from '../../shared/contracts/review';
import { loadEvalPackFiles } from '../evalDemoApi';
import { BUILTIN_SAMPLES } from './builtin-sample-packs';
import {
  resolveToolbenchSampleSectionIds,
  type CapabilityProbeState,
  type ToolbenchSampleSectionId
} from './toolbenchSamplePanelState';
import {
  fetchSampleFiles,
  guessMimeFromFilename,
  prettifyLabel,
  resolveBuiltinSample,
  type SampleFields,
  type SamplePreview
} from './toolbenchSampleSupport';
export type { SampleFields } from './toolbenchSampleSupport';

interface ToolbenchSamplesProps {
  onLoadSample: (files: File[], fields: SampleFields, imageId: string) => void;
  onLoadBatch: (images: File[], csv: File) => void;
  onLoadSyntheticSample?: (
    files: File[],
    fields: SampleFields,
    imageId: string
  ) => void;
}

export function ToolbenchSamples({
  onLoadSample,
  onLoadBatch,
  onLoadSyntheticSample
}: ToolbenchSamplesProps) {
  const [samples, setSamples] = useState<SamplePreview[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [liveAvailability, setLiveAvailability] =
    useState<CapabilityProbeState>('loading');
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  // Synthetic-label generator (Imagen 4) state. `synthAvailable` is
  // null until the status probe lands, then true/false. The chip after
  // a successful generation tells the dev what verdict the pipeline
  // should produce — useful for sanity-checking reject/review paths.
  const [synthAvailability, setSynthAvailability] =
    useState<CapabilityProbeState>('loading');
  const [loadingSynth, setLoadingSynth] = useState(false);
  const [lastSynthExpected, setLastSynthExpected] =
    useState<SyntheticLabelExpected | null>(null);
  const sectionIds = resolveToolbenchSampleSectionIds({
    liveAvailability,
    synthAvailability
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/eval/packs');
        if (!res.ok) throw new Error(`packs HTTP ${res.status}`);
        const data = (await res.json()) as {
          packs: Array<{
            id: string;
            images: Array<{
              id: string;
              beverageType: string;
              filename: string;
              isSecondary?: boolean;
            }>;
          }>;
        };
        if (cancelled) return;
        const pack = data.packs.find((p) => p.id === 'cola-cloud-all');
        if (!pack) throw new Error('cola-cloud-all pack missing');
        setSamples(
          pack.images
            .filter((img) => !img.isSecondary)
            .map((img) => ({
              id: img.id,
              beverageType: img.beverageType,
              filename: img.filename
            }))
        );
        setLastError(null);
      } catch {
        if (cancelled) return;
        setSamples(
          BUILTIN_SAMPLES.map((s) => ({
            id: s.id,
            beverageType: s.beverageType,
            filename: s.filename
          }))
        );
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/eval/cola-cloud/status');
        if (!res.ok) {
          if (!cancelled) setLiveAvailability('unavailable');
          return;
        }
        const data = (await res.json()) as { available: boolean };
        if (!cancelled) {
          setLiveAvailability(data.available ? 'available' : 'unavailable');
        }
      } catch {
        if (!cancelled) setLiveAvailability('unavailable');
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/eval/synthetic/status');
        if (!res.ok) {
          if (!cancelled) setSynthAvailability('unavailable');
          return;
        }
        const data = (await res.json()) as { available: boolean };
        if (!cancelled) {
          setSynthAvailability(data.available ? 'available' : 'unavailable');
        }
      } catch {
        if (!cancelled) setSynthAvailability('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadSample = useCallback(
    async (opts: { id?: string; random?: boolean }) => {
      setLoadingSampleId(opts.id ?? '__random__');
      setLastError(null);
      try {
        const url = opts.id
          ? `/api/eval/sample?id=${encodeURIComponent(opts.id)}`
          : '/api/eval/sample';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`sample HTTP ${res.status}`);
        const body = (await res.json()) as {
          image: { id: string; url: string; filename: string };
          images?: Array<{ id: string; url: string; filename: string }>;
          fields: SampleFields;
        };
        const files = await fetchSampleFiles(body.images ?? [body.image]);
        onLoadSample(files, body.fields, body.image.id);
      } catch {
        // Built-in fallback: server not available (or returned
        // non-2xx). Use the bundled sample metadata + `/toolbench/
        // labels/` image served by the Vite dev plugin. Images are
        // served blob-style so we hand the onLoadSample callback a
        // real File just like the server path.
        const builtin = resolveBuiltinSample(opts.id);
        if (!builtin) {
          setLastError(
            opts.id
              ? `Sample ${opts.id} is not bundled locally.`
              : 'No built-in samples available.'
          );
          setLoadingSampleId(null);
          return;
        }
        try {
          const files = await fetchSampleFiles(
            builtin.images.map((image) => ({
              ...image,
              url: image.url,
              filename: image.filename
            }))
          );

          // Keep the primary image MIME hint aligned with the filename
          // extension when the dev server reports a generic type.
          if (files[0]) {
            const primaryMime = guessMimeFromFilename(builtin.filename);
            if (primaryMime && files[0].type !== primaryMime) {
              files[0] = new File([files[0]], files[0].name, {
                type: primaryMime
              });
            }
          }

          onLoadSample(files, builtin.fields, builtin.id);
        } catch (err) {
          setLastError((err as Error).message);
        }
      } finally {
        setLoadingSampleId(null);
      }
    },
    [onLoadSample]
  );

  const loadLiveSample = useCallback(async () => {
    setLoadingLive(true);
    setLastError(null);
    try {
      const res = await fetch('/api/eval/cola-cloud/fresh');
      if (!res.ok) throw new Error(`live HTTP ${res.status}`);
      const body = (await res.json()) as {
        image: { id: string; url: string; filename: string };
        images?: Array<{ id: string; url: string; filename: string }>;
        fields: SampleFields;
      };
      const files = await fetchSampleFiles(body.images ?? [body.image]);
      onLoadSample(files, body.fields, body.image.id);
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setLoadingLive(false);
    }
  }, [onLoadSample]);

  const loadSyntheticSample = useCallback(async () => {
    setLoadingSynth(true);
    setLastError(null);
    setLastSynthExpected(null);
    try {
      const res = await fetch('/api/eval/synthetic/generate', {
        method: 'POST'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          (body as { message?: string })?.message ?? `synthetic HTTP ${res.status}`;
        throw new Error(message);
      }
      const parsed = syntheticLabelGenerateResponseSchema.parse(await res.json());
      const images = parsed.images ?? [parsed.image];
      const files = await fetchSampleFiles(images);
      const fill = onLoadSyntheticSample ?? onLoadSample;
      fill(files, parsed.fields, parsed.image.id);
      setLastSynthExpected(parsed.expected);
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setLoadingSynth(false);
    }
  }, [onLoadSample, onLoadSyntheticSample]);

  const loadBatchPack = useCallback(async () => {
    setLoadingBatch(true);
    setLastError(null);
    try {
      const { csvFile, imageFiles } = await loadEvalPackFiles('cola-cloud-all');
      onLoadBatch(imageFiles, csvFile);
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setLoadingBatch(false);
    }
  }, [onLoadBatch]);

  return (
    <div className="flex flex-col gap-3 p-3">
      {sectionIds.map((sectionId) => renderSection(sectionId))}

      {lastError ? (
        <p className="text-xs text-error">Couldn't load sample — {lastError}</p>
      ) : null}
    </div>
  );

  function renderSection(sectionId: ToolbenchSampleSectionId) {
    switch (sectionId) {
      case 'random-sample':
        return (
          <section key={sectionId} className="flex flex-col gap-2">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Load a real COLA sample
            </p>
            <button
              type="button"
              onClick={() => void loadSample({ random: true })}
              disabled={loadingSampleId !== null || loadingList || samples.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-on-primary px-3 py-2 text-sm font-label font-semibold transition-colors hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">shuffle</span>
              {loadingSampleId === '__random__' ? 'Loading…' : 'Load random sample'}
            </button>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Populates both the label image and the application form fields from a real
              TTB-approved COLA record. Some live samples include both front and back labels.
            </p>
          </section>
        );
      case 'capabilities-placeholder':
        return (
          <section
            key={sectionId}
            className="rounded-md border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-3"
            aria-label="Loading sample actions"
          >
            <div className="flex flex-col gap-2">
              <span className="block h-3 w-36 rounded bg-outline-variant/20 animate-pulse" />
              <span className="block h-9 w-full rounded bg-outline-variant/20 animate-pulse" />
              <span className="block h-9 w-full rounded bg-outline-variant/20 animate-pulse" />
            </div>
          </section>
        );
      case 'live-sample':
        return (
          <section key={sectionId} className="flex flex-col gap-2 rounded-md border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-3">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Live COLA Cloud (fresh data)
            </p>
            <button
              type="button"
              onClick={() => void loadLiveSample()}
              disabled={loadingLive}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary text-on-secondary px-3 py-2 text-sm font-label font-semibold transition-colors hover:bg-secondary/90 disabled:bg-secondary/40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">cloud_download</span>
              {loadingLive ? 'Connecting to COLA Cloud…' : 'Fetch live sample'}
            </button>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Hits the COLA Cloud REST API using our server-side key. Pulls a
              fresh random approved label each click.
            </p>
          </section>
        );
      case 'synthetic-sample':
        return (
          <section key={sectionId} className="flex flex-col gap-2 rounded-md border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-3">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Generate with Gemini
            </p>
            <button
              type="button"
              onClick={() => void loadSyntheticSample()}
              disabled={loadingSynth}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-on-primary px-3 py-2 text-sm font-label font-semibold transition-colors hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              {loadingSynth ? 'Generating with Imagen… (~10s)' : 'Generate sample with Gemini'}
            </button>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Imagen 4 builds a fresh label image + matching declared fields.
              Sometimes a defect is baked in so the reject / review paths get exercised.
            </p>
            {lastSynthExpected ? (
              <div
                className={[
                  'mt-1 rounded border px-2 py-1.5 text-[11px] font-body leading-snug',
                  lastSynthExpected.verdict === 'approve'
                    ? 'border-success/40 bg-success/10 text-on-surface'
                    : lastSynthExpected.verdict === 'reject'
                      ? 'border-error/40 bg-error/10 text-on-surface'
                      : 'border-caution/40 bg-caution/10 text-on-surface'
                ].join(' ')}
              >
                <span className="font-label text-[10px] font-bold uppercase tracking-widest">
                  Expected verdict: {lastSynthExpected.verdict}
                </span>
                <span className="block text-on-surface-variant mt-0.5">
                  {lastSynthExpected.description}
                </span>
                <span className="block text-on-surface-variant/70 mt-0.5 font-mono text-[10px]">
                  defect: {lastSynthExpected.defectKind}
                </span>
              </div>
            ) : null}
          </section>
        );
      case 'batch-sample':
        return (
          <section key={sectionId} className="flex flex-col gap-2 rounded-md border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-3">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Batch testing
            </p>
            <button
              type="button"
              onClick={() => void loadBatchPack()}
              disabled={loadingBatch}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-tertiary text-on-tertiary px-3 py-2 text-sm font-label font-semibold transition-colors hover:bg-tertiary/90 disabled:bg-tertiary/40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
              {loadingBatch ? 'Loading pack…' : 'Load test batch'}
            </button>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Populates the batch intake with 10 real COLA labels + their matching CSV.
            </p>
          </section>
        );
      case 'sample-catalog':
        return (
          <section key={sectionId} className="flex flex-col gap-1.5">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Pick a specific label ({samples.length})
            </p>
            {loadingList ? (
              <p className="text-xs text-on-surface-variant">Loading catalog…</p>
            ) : samples.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No samples available.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {samples.map((sample) => {
                  const isLoading = loadingSampleId === sample.id;
                  return (
                    <li key={sample.id}>
                      <button
                        type="button"
                        onClick={() => void loadSample({ id: sample.id })}
                        disabled={loadingSampleId !== null}
                        className="w-full text-left rounded px-2 py-1.5 text-xs text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                      >
                        <span className="font-mono truncate block">
                          {isLoading ? '↻ ' : ''}
                          {prettifyLabel(sample.id)}
                        </span>
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                          {sample.beverageType.replace(/-/g, ' ')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
    }
  }
}
