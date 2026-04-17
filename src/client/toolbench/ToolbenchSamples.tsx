import { useCallback, useEffect, useState } from 'react';

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

export function ToolbenchSamples({ onLoadSample }: ToolbenchSamplesProps) {
  const [samples, setSamples] = useState<SamplePreview[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Fetch the list once on mount so the panel can show what's available.
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
      } catch (err) {
        if (cancelled) return;
        setLastError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingList(false);
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
      } catch (err) {
        setLastError((err as Error).message);
      } finally {
        setLoadingSampleId(null);
      }
    },
    [onLoadSample]
  );

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
