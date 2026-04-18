import { useCallback, useEffect, useState } from 'react';
import {
  BUILTIN_SAMPLES,
  BUILTIN_SAMPLE_BY_ID
} from './builtin-sample-packs';

/**
 * Vite's toolbenchLabelsPlugin serves everything with Content-Type
 * `image/png`. That trips our server-side Multer check when the file
 * is actually a .webp — it rejects non-matching MIMEs. Override the
 * blob MIME from the filename extension so the File handed to
 * onLoadSample carries the truthful type.
 */
function guessMimeFromFilename(filename: string): string | undefined {
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext) return undefined;
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'pdf') return 'application/pdf';
  return undefined;
}

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
  onLoadSample: (file: File, fields: SampleFields, imageId: string) => void;
  /**
   * Load a batch of sample labels + their CSV into the batch intake.
   * Used by the "Load test batch" button so assessors can evaluate the
   * batch review flow without having to prepare their own fixtures.
   */
  onLoadBatch: (images: File[], csv: File) => void;
}

export type SampleFields = {
  brandName: string;
  fancifulName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  applicantAddress: string;
  origin: string;
  country: string;
  formulaId: string;
  appellation: string;
  vintage: string;
};

type SamplePreview = {
  id: string;
  beverageType: string;
  filename: string;
};

export function ToolbenchSamples({ onLoadSample, onLoadBatch }: ToolbenchSamplesProps) {
  const [samples, setSamples] = useState<SamplePreview[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);

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
          fields: SampleFields;
        };
        const imgRes = await fetch(body.image.url);
        if (!imgRes.ok) throw new Error(`image HTTP ${imgRes.status}`);
        const blob = await imgRes.blob();
        const file = new File([blob], body.image.filename, { type: blob.type });
        onLoadSample(file, body.fields, body.image.id);
      } catch {
        // Built-in fallback: server not available (or returned
        // non-2xx). Use the bundled sample metadata + `/toolbench/
        // labels/` image served by the Vite dev plugin. Images are
        // served blob-style so we hand the onLoadSample callback a
        // real File just like the server path.
        const builtin = opts.id
          ? BUILTIN_SAMPLE_BY_ID.get(opts.id)
          : BUILTIN_SAMPLES[Math.floor(Math.random() * BUILTIN_SAMPLES.length)];
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
          onLoadSample(file, builtin.fields, builtin.id);
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
        fields: SampleFields;
      };
      const imgRes = await fetch(body.image.url);
      if (!imgRes.ok) throw new Error(`image HTTP ${imgRes.status}`);
      const blob = await imgRes.blob();
      // COLA Cloud's CDN sometimes returns generic octet-stream; fall
      // back to the filename extension so multer accepts the upload.
      const file = new File([blob], body.image.filename, {
        type: deriveImageMime(blob.type, body.image.filename)
      });
      onLoadSample(file, body.fields, body.image.id);
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setLoadingLive(false);
    }
  }, [onLoadSample]);

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
          TTB-approved COLA record.
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

/**
 * Some upstream CDNs (notably COLA Cloud's CloudFront) return a generic
 * `binary/octet-stream` content-type for images. Multer on our server
 * rejects uploads without a recognized image MIME, so fall back to the
 * filename extension when the blob's own type isn't useful.
 */
function deriveImageMime(blobType: string, filename: string): string {
  if (blobType && blobType.startsWith('image/')) return blobType;
  if (blobType === 'application/pdf') return blobType;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

// Turn "persian-empire-arak-distilled-spirits" into "Persian Empire — Arak"
// for the pick-list. Best-effort; falls back to the raw id.
function prettifyLabel(id: string): string {
  const stripped = id
    .replace(/-distilled-spirits$/i, '')
    .replace(/-malt-beverage$/i, '')
    .replace(/-wine$/i, '');
  return stripped
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
