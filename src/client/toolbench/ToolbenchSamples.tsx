import { useCallback, useEffect, useState } from 'react';
import {
  syntheticLabelGenerateResponseSchema,
  type SyntheticLabelExpected
} from '../../shared/contracts/review';
import { BUILTIN_SAMPLES } from './builtin-sample-packs';
import {
  deriveImageMime,
  fetchSampleFiles,
  guessMimeFromFilename,
  prettifyLabel,
  resolveBuiltinSample,
  type SampleFields,
  type SamplePreview
} from './toolbenchSampleSupport';

export type { SampleFields } from './toolbenchSampleSupport';

/**
 * Loads one real COLA Cloud label — image + matching application fields —
 * into the intake form with a single click. Replaces the older hand-
 * curated "scenarios" panel which was useful for story-packet demos
 * but drifted away from the actual eval corpus.
 *
 * The server's /api/eval/sample endpoint joins the 28-label cola-cloud
 * batch CSV to the manifest to return { image: {url, filename, ...},
 * fields: {...} }. We then fetch the image bytes, turn them into a
 * File, and hand both up to the App so single-label intake fires
 * through the normal selection paths — no parallel codepath.
 */
interface ToolbenchSamplesProps {
  onLoadSample: (files: File[], fields: SampleFields, imageId: string) => void;
  /**
   * Load a batch of sample labels + their CSV into the batch intake.
   * Used by the "Load test batch" button so assessors can evaluate the
   * batch review flow without having to prepare their own fixtures.
   */
  onLoadBatch: (images: File[], csv: File) => void;
  /**
   * Like `onLoadSample`, but does NOT close the toolbench after the
   * intake is populated. The synthetic-label flow needs the toolbench
   * to stay open so the dev can see the "expected verdict" chip
   * before clicking Verify. Falls back to `onLoadSample` if not
   * supplied.
   */
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
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  // Synthetic-label generator (Imagen 4) state. `synthAvailable` is
  // null until the status probe lands, then true/false. The chip after
  // a successful generation tells the dev what verdict the pipeline
  // should produce — useful for sanity-checking reject/review paths.
  const [synthAvailable, setSynthAvailable] = useState<boolean | null>(null);
  const [loadingSynth, setLoadingSynth] = useState(false);
  const [lastSynthExpected, setLastSynthExpected] =
    useState<SyntheticLabelExpected | null>(null);

  // Fetch the list once on mount so the panel can show what's available.
  // Falls back to the built-in sample list (bundled from the
  // checked-in CSV via `?raw` import) when /api/eval/packs is
  // unreachable — typical when the user is running only Vite and not
  // the API process. Ensures the toolbench always has something to
  // pick from locally.
  //
  // Also probes the COLA Cloud live status so we only render the
  // "Fetch live" button when an API key is wired up server-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/eval/packs');
        if (!res.ok) throw new Error(`packs HTTP ${res.status}`);
        const data = (await res.json()) as {
          packs: Array<{
            id: string;
            images: Array<{ id: string; beverageType: string; filename: string }>;
          }>;
        };
        if (cancelled) return;
        const pack = data.packs.find((p) => p.id === 'cola-cloud-all');
        if (!pack) throw new Error('cola-cloud-all pack missing');
        setSamples(
          pack.images.map((img) => ({
            id: img.id,
            beverageType: img.beverageType,
            filename: img.filename
          }))
        );
        setLastError(null);
      } catch {
        if (cancelled) return;
        // Silent fallback to built-ins. Surfacing the fetch error here
        // would hide the (working) built-in list behind a scary
        // "Failed to fetch" message.
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

    // COLA Cloud live availability probe — non-blocking.
    (async () => {
      try {
        const res = await fetch('/api/eval/cola-cloud/status');
        if (!res.ok) return;
        const data = (await res.json()) as { available: boolean };
        if (!cancelled && data.available) setLiveAvailable(true);
      } catch {
        /* ignore — button just stays hidden */
      }
    })();

    // Synthetic generator availability probe — non-blocking. The
    // section hides entirely when the server has no GEMINI_API_KEY.
    (async () => {
      try {
        const res = await fetch('/api/eval/synthetic/status');
        if (!res.ok) {
          if (!cancelled) setSynthAvailable(false);
          return;
        }
        const data = (await res.json()) as { available: boolean };
        if (!cancelled) setSynthAvailable(Boolean(data.available));
      } catch {
        if (!cancelled) setSynthAvailable(false);
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
          const imgRes = await fetch(builtin.imageUrl);
          if (!imgRes.ok) throw new Error(`offline image HTTP ${imgRes.status}`);
          const blob = await imgRes.blob();
          // The Vite middleware sets content-type to image/png even
          // for .webp, so rely on the filename extension to hint
          // Multer correctly when the file lands on the server.
          const mime = guessMimeFromFilename(builtin.filename) ?? blob.type;
          const file = new File([blob], builtin.filename, { type: mime });
          onLoadSample([file], builtin.fields, builtin.id);
        } catch (err) {
          setLastError((err as Error).message);
        }
      } finally {
        setLoadingSampleId(null);
      }
    },
    [onLoadSample]
  );

  // Live COLA Cloud fetch — hits the federal API server-side (the key
  // lives on the server), returns a fresh record each click.
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

  // Synthetic loader — generates a fresh label end-to-end via Imagen 4
  // (image bytes + matching declared fields). Sometimes the server
  // bakes in a defect (ABV mismatch, missing warning, brand swap, etc.)
  // so the verification pipeline's reject/review paths get exercised.
  // The expected verdict is shown as an inline chip after load.
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
      const imgRes = await fetch(parsed.image.url);
      if (!imgRes.ok) throw new Error(`synthetic image HTTP ${imgRes.status}`);
      const blob = await imgRes.blob();
      const mime = deriveImageMime(blob.type, parsed.image.filename);
      const file = new File([blob], parsed.image.filename, { type: mime });
      // Use the synthetic-specific callback if provided so the
      // toolbench stays open and the expected-verdict chip remains
      // visible. Falls back to the regular onLoadSample (which closes
      // the drawer) if a parent didn't wire the synthetic variant.
      const fill = onLoadSyntheticSample ?? onLoadSample;
      fill([file], parsed.fields, parsed.image.id);
      setLastSynthExpected(parsed.expected);
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setLoadingSynth(false);
    }
  }, [onLoadSample, onLoadSyntheticSample]);

  // Batch loader — pulls 10 images + the CSV from the local pack and
  // populates batch intake. Local only for now; live batch would hit
  // the COLA Cloud rate limit hard (7s per call × 10 = 70s).
  const loadBatchPack = useCallback(async () => {
    setLoadingBatch(true);
    setLastError(null);
    try {
      const packsRes = await fetch('/api/eval/packs');
      if (!packsRes.ok) throw new Error(`packs HTTP ${packsRes.status}`);
      const packsData = (await packsRes.json()) as {
        packs: Array<{
          id: string;
          csvFile: string;
          images: Array<{ id: string; filename: string; assetPath: string; beverageType: string }>;
        }>;
      };
      const pack = packsData.packs.find((p) => p.id === 'cola-cloud-all');
      if (!pack) throw new Error('cola-cloud-all pack missing');

      const csvRes = await fetch(`/api/eval/pack/${encodeURIComponent(pack.id)}/csv`);
      if (!csvRes.ok) throw new Error(`csv HTTP ${csvRes.status}`);
      const csvBlob = await csvRes.blob();
      const csvFile = new File([csvBlob], pack.csvFile, { type: 'text/csv' });

      // Pull ALL images in the pack so the CSV row count matches the
      // image count — otherwise the batch-intake "unmatched rows"
      // section fills up with every CSV row we didn't upload an image
      // for, and the user has to match them manually.
      const imageFiles: File[] = [];
      for (const img of pack.images) {
        const source = img.assetPath.split('/')[3] ?? 'cola-cloud';
        const url = `/api/eval/label-image/${encodeURIComponent(source)}/${encodeURIComponent(img.filename)}`;
        const imgRes = await fetch(url);
        if (!imgRes.ok) continue;
        const blob = await imgRes.blob();
        imageFiles.push(new File([blob], img.filename, { type: blob.type || 'image/webp' }));
      }
      if (imageFiles.length === 0) throw new Error('No images could be fetched from the pack.');
      onLoadBatch(imageFiles, csvFile);
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setLoadingBatch(false);
    }
  }, [onLoadBatch]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <section className="flex flex-col gap-2">
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

      {liveAvailable ? (
        <section className="flex flex-col gap-2 rounded-md border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-3">
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
      ) : null}

      {synthAvailable ? (
        <section className="flex flex-col gap-2 rounded-md border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-3">
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
      ) : null}

      <section className="flex flex-col gap-2 rounded-md border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-3">
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

      <section className="flex flex-col gap-1.5">
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

      {lastError ? (
        <p className="text-xs text-error">Couldn't load sample — {lastError}</p>
      ) : null}
    </div>
  );
}
