/**
 * Built-in sample packs bundled with the client. Loaded as a
 * fallback when `/api/eval/packs` fails — e.g. when the user is
 * running only Vite (`npm run dev:web`) without the API process, or
 * when the API endpoint returns non-2xx. Ensures the toolbench
 * always has something to pick from locally.
 *
 * How it works:
 *   - The canonical CSV in `evals/batch/cola-cloud/cola-cloud-all.csv`
 *     is imported at build time via Vite's `?raw` loader. No HTTP
 *     round-trip, no server dependency — the sample metadata is
 *     part of the JS bundle.
 *   - Image assets are resolved to `/toolbench/labels/{filename}`.
 *     The Vite dev server's `toolbenchLabelsPlugin` middleware
 *     (see vite.config.ts) serves those paths from
 *     `evals/labels/assets/*`.
 *   - Production builds don't include the image assets unless
 *     they're also copied into `public/`. This is DEV-ONLY fallback
 *     scope — matches the user's "only locally" intent.
 */

import colaCloudAllCsv from '../../../evals/batch/cola-cloud/cola-cloud-all.csv?raw';
import type { SampleFields } from './ToolbenchSamples';

export interface BuiltinSample {
  id: string;
  filename: string;
  beverageType: string;
  fields: SampleFields;
  /** URL the client can fetch the image bytes from. Dev-only. */
  imageUrl: string;
}

export interface BuiltinPack {
  id: string;
  title: string;
  description: string;
  imageCount: number;
  images: Array<{ id: string; beverageType: string; filename: string }>;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvRow(lines[0]!);
  return lines.slice(1).map((line) => {
    const cols = splitCsvRow(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cols[i] ?? '';
    });
    return row;
  });
}

/**
 * Minimal CSV row splitter. Handles quoted cells and embedded commas.
 * Our fixture CSVs don't use escaped quotes or newlines inside cells,
 * so we skip that complexity.
 */
function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === ',' && !inQuote) {
      out.push(cell);
      cell = '';
      continue;
    }
    cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

function deriveIdFromFilename(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, '');
}

function buildSample(row: Record<string, string>): BuiltinSample | null {
  const filename = row.filename;
  if (!filename) return null;
  return {
    id: deriveIdFromFilename(filename),
    filename,
    beverageType: row.beverage_type || 'auto',
    fields: {
      brandName: row.brand_name ?? '',
      fancifulName: row.fanciful_name ?? '',
      classType: row.class_type ?? '',
      alcoholContent: row.alcohol_content ?? '',
      netContents: row.net_contents ?? '',
      applicantAddress: row.applicant_address ?? '',
      origin: row.origin ?? '',
      country: row.country ?? '',
      formulaId: row.formula_id ?? '',
      appellation: row.appellation ?? '',
      vintage: row.vintage ?? ''
    },
    imageUrl: `/toolbench/labels/cola-cloud/${filename}`
  };
}

const COLA_CLOUD_ALL_ROWS = parseCsv(colaCloudAllCsv);

export const BUILTIN_SAMPLES: BuiltinSample[] = COLA_CLOUD_ALL_ROWS.map(
  buildSample
).filter((s): s is BuiltinSample => s !== null);

export const BUILTIN_SAMPLE_BY_ID = new Map(
  BUILTIN_SAMPLES.map((s) => [s.id, s])
);

export const BUILTIN_PACKS: BuiltinPack[] = [
  {
    id: 'cola-cloud-all',
    title: 'COLA Cloud All',
    description: 'All real approved labels, bundled offline.',
    imageCount: BUILTIN_SAMPLES.length,
    images: BUILTIN_SAMPLES.map((s) => ({
      id: s.id,
      beverageType: s.beverageType,
      filename: s.filename
    }))
  }
];
