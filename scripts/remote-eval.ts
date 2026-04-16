/**
 * Remote eval runner — hits a DEPLOYED app at an HTTP URL with the same
 * 28-label cola-cloud-all corpus used by scripts/run-cola-cloud-batch-fixtures.ts.
 *
 * Why separate from the in-process batch runner:
 *   - run-cola-cloud-batch-fixtures.ts calls `app.listen(0)` and routes locally
 *   - This script targets a remote URL (e.g. a RunPod pod)
 *   - Also captures per-label wall-clock latency so we can see where time goes
 *
 * Usage:
 *   BASE_URL="https://<pod-id>-8787.proxy.runpod.net" \
 *     npx tsx scripts/remote-eval.ts [--slice=cola-cloud-all|negatives|fast]
 *
 * Slices:
 *   cola-cloud-all   (28 labels) — real TTB-approved labels, full corpus
 *   negatives        (7 labels)  — supplemental-negative intentional defects
 *   fast             (7 labels)  — representative smoke sample
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 120_000);
const SLICE = (process.argv.find((a) => a.startsWith('--slice='))?.split('=')[1] ??
  'cola-cloud-all') as 'cola-cloud-all' | 'negatives' | 'fast';

type Case = {
  id: string;
  path: string;
  expected: 'approve' | 'reject' | 'review';
  brand: string;
  classType: string;
  abv: string;
  net: string;
  beverageType: 'auto' | 'distilled-spirits' | 'wine' | 'malt-beverage';
  applicantAddress?: string;
  origin?: 'domestic' | 'imported';
  country?: string;
  fancifulName?: string;
  formulaId?: string;
  appellation?: string;
  vintage?: string;
};

function loadCases(slice: typeof SLICE): Case[] {
  if (slice === 'fast') {
    return fastSlice();
  }
  if (slice === 'negatives') {
    return negativeSlice();
  }
  // cola-cloud-all: load from the batch fixture CSV
  const repoRoot = process.cwd();
  const csvPath = path.join(repoRoot, 'evals/batch/cola-cloud/cola-cloud-all.csv');
  return loadFromCsv(csvPath);
}

function loadFromCsv(csvPath: string): Case[] {
  const text = readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCsvRow(lines[0]);
  const cases: Case[] = [];
  // The batch CSVs store a bare filename; images live at
  // evals/labels/assets/cola-cloud/{filename} (or ../supplemental-generated/).
  const imageRoots = [
    'evals/labels/assets/cola-cloud',
    'evals/labels/assets/supplemental-generated'
  ];
  const repoRoot = process.cwd();

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvRow(lines[i]);
    const pick = (h: string) => row[headers.indexOf(h)] ?? '';
    const filename = pick('filename') || pick('label_image_path');
    if (!filename) continue;

    // Resolve relative image path
    let relImg = filename;
    if (!relImg.includes('/')) {
      for (const root of imageRoots) {
        const candidate = path.join(repoRoot, root, filename);
        if (existsSync(candidate)) {
          relImg = path.join(root, filename);
          break;
        }
      }
    }

    cases.push({
      id: path.basename(filename, path.extname(filename)),
      path: relImg,
      expected: filename.includes('-negative') ? 'reject' : 'approve',
      brand: pick('brand_name'),
      classType: pick('class_type'),
      abv: pick('alcohol_content'),
      net: pick('net_contents'),
      beverageType: (pick('beverage_type') as Case['beverageType']) || 'auto',
      applicantAddress: pick('applicant_address') || undefined,
      origin: (pick('origin') as 'domestic' | 'imported') || undefined,
      country: pick('country') || undefined,
      fancifulName: pick('fanciful_name') || undefined,
      formulaId: pick('formula_id') || undefined,
      appellation: pick('appellation') || undefined,
      vintage: pick('vintage') || undefined
    });
  }
  return cases;
}

function parseCsvRow(line: string): string[] {
  // Minimal CSV: supports quoted fields with escaped quotes.
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Fast slice mirrors the full cola-cloud-all field set (including country +
// fancifulName + appellation + vintage) so the LLM judgment layer actually
// has targets to resolve. Leaving these blank meant the judgment path was
// a no-op on the fast slice — reviews and approvals looked identical to
// a non-judgment run. Values come from evals/batch/cola-cloud/cola-cloud-all.csv.
function fastSlice(): Case[] {
  return [
    { id: 'simply-elegant', path: 'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp', expected: 'approve', brand: 'Simply Elegant', fancifulName: 'Simply Elegant Spirits', classType: 'straight bourbon whisky', abv: '67% Alc./Vol.', net: '', origin: 'domestic', country: '', beverageType: 'distilled-spirits' },
    { id: 'persian-empire', path: 'evals/labels/assets/cola-cloud/persian-empire-black-widow-distilled-spirits.webp', expected: 'approve', brand: 'Persian Empire', fancifulName: 'Black Widow', classType: 'other specialties & proprietaries', abv: '40% Alc./Vol.', net: '', origin: 'imported', country: 'canada', beverageType: 'distilled-spirits' },
    { id: 'leitz-rottland', path: 'evals/labels/assets/cola-cloud/leitz-rottland-wine.webp', expected: 'approve', brand: 'Leitz', fancifulName: 'Rottland', classType: 'table white wine', abv: '12.5% Alc./Vol.', net: '', origin: 'imported', country: 'germany', appellation: 'Rheingau', vintage: '2023', beverageType: 'wine' },
    { id: 'stormwood', path: 'evals/labels/assets/cola-cloud/stormwood-wines-semillon-wine.webp', expected: 'approve', brand: 'Stormwood Wines', fancifulName: 'Semillon', classType: 'table white wine', abv: '13% Alc./Vol.', net: '', origin: 'imported', country: 'new zealand', appellation: 'Waiheke Island', vintage: '2025', beverageType: 'wine' },
    { id: 'lake-placid', path: 'evals/labels/assets/cola-cloud/lake-placid-shredder-malt-beverage.webp', expected: 'approve', brand: 'Lake Placid', fancifulName: 'Shredder', classType: 'ale', abv: '', net: '', origin: 'domestic', country: '', beverageType: 'malt-beverage' },
    { id: 'harpoon', path: 'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp', expected: 'approve', brand: 'Harpoon', fancifulName: 'Ale', classType: 'ale', abv: '5% Alc./Vol.', net: '', origin: 'domestic', country: '', beverageType: 'malt-beverage' },
    { id: 'negative-abv', path: 'evals/labels/assets/supplemental-generated/lake-placid-shredder-abv-negative.webp', expected: 'reject', brand: 'Lake Placid', fancifulName: 'Shredder', classType: 'ale', abv: '5% Alc./Vol.', net: '', origin: 'domestic', country: '', beverageType: 'malt-beverage' }
  ];
}

function negativeSlice(): Case[] {
  return loadFromCsv(path.join(process.cwd(), 'evals/labels/fixtures/supplemental-negative-reject.csv'));
}

type Row = {
  id: string;
  expected: string;
  actual: string;
  latencyMs: number;
  verdict?: string;
  match: boolean;
  failSummary?: string;
};

async function runOne(c: Case, providerOverride?: 'cloud' | 'local'): Promise<Row> {
  const repoRoot = process.cwd();
  const imgPath = path.join(repoRoot, c.path);
  const imgBuffer = readFileSync(imgPath);
  const ext = path.extname(c.path).slice(1);
  const mime =
    ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();
  form.append(
    'label',
    new Blob([imgBuffer], { type: mime }),
    path.basename(c.path)
  );
  form.append(
    'fields',
    JSON.stringify({
      beverageType: c.beverageType,
      brandName: c.brand,
      fancifulName: c.fancifulName ?? '',
      classType: c.classType,
      alcoholContent: c.abv,
      netContents: c.net,
      applicantAddress: c.applicantAddress ?? '',
      origin: c.origin ?? 'domestic',
      country: c.country ?? '',
      formulaId: c.formulaId ?? '',
      appellation: c.appellation ?? '',
      vintage: c.vintage ?? '',
      varietals: []
    })
  );

  const started = Date.now();
  const headers: Record<string, string> = {};
  if (providerOverride) headers['X-Provider-Override'] = providerOverride;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/api/review`, {
      method: 'POST',
      body: form,
      headers,
      signal: controller.signal
    });
    const elapsed = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      return {
        id: c.id,
        expected: c.expected,
        actual: 'error',
        latencyMs: elapsed,
        match: false,
        failSummary: `HTTP ${res.status}: ${text.slice(0, 160)}`
      };
    }

    const data = JSON.parse(text) as {
      verdict?: string;
      checks?: Array<{ id: string; status: string; applicationValue?: string; extractedValue?: string }>;
    };
    const verdict = data.verdict ?? 'error';
    const match =
      (c.expected === 'approve' && (verdict === 'approve' || verdict === 'review')) ||
      (c.expected === 'reject' && verdict === 'reject');
    const fails = (data.checks ?? [])
      .filter((ch) => ch.status === 'fail' || ch.status === 'review')
      .map((ch) => `${ch.id}:${ch.status}`)
      .slice(0, 5)
      .join(', ');
    return {
      id: c.id,
      expected: c.expected,
      actual: verdict,
      latencyMs: elapsed,
      verdict,
      match,
      failSummary: fails || undefined
    };
  } catch (error) {
    return {
      id: c.id,
      expected: c.expected,
      actual: 'error',
      latencyMs: Date.now() - started,
      match: false,
      failSummary: String((error as Error).message ?? error)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const providerOverride = process.env.PROVIDER_OVERRIDE as 'cloud' | 'local' | undefined;
  console.log(`Remote eval against: ${BASE_URL}`);
  console.log(`Slice: ${SLICE}`);
  if (providerOverride) console.log(`Provider override: ${providerOverride}`);
  console.log('─'.repeat(80));

  // Quick health probe first
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    const hb = await health.json();
    console.log('Server reports:', JSON.stringify(hb));
  } catch (e) {
    console.error('Health probe failed:', (e as Error).message);
    process.exit(2);
  }

  const cases = loadCases(SLICE);
  console.log(`Loaded ${cases.length} cases`);
  console.log();

  const rows: Row[] = [];
  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${cases.length}] ${c.id.padEnd(45)} `);
    const row = await runOne(c, providerOverride);
    const icon = row.match ? '✓' : '✗';
    const secs = (row.latencyMs / 1000).toFixed(1);
    console.log(`${icon} ${row.actual.padEnd(8)} ${secs.padStart(5)}s${row.failSummary ? ` [${row.failSummary}]` : ''}`);
    rows.push(row);
  }

  console.log('─'.repeat(80));
  const correct = rows.filter((r) => r.match).length;
  const approved = rows.filter((r) => r.actual === 'approve').length;
  const reviewed = rows.filter((r) => r.actual === 'review').length;
  const failed = rows.filter((r) => r.actual === 'reject').length;
  const errored = rows.filter((r) => r.actual === 'error').length;
  const latencies = rows.filter((r) => r.actual !== 'error').map((r) => r.latencyMs).sort((a, b) => a - b);
  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const max = latencies.length ? latencies[latencies.length - 1] : 0;

  console.log(`Result:   ${correct}/${rows.length} correct (${((correct / rows.length) * 100).toFixed(0)}%)`);
  console.log(`Verdicts: ${approved} approve · ${reviewed} review · ${failed} reject · ${errored} error`);
  console.log(`Latency:  avg=${(avg / 1000).toFixed(1)}s  p50=${(p50 / 1000).toFixed(1)}s  p95=${(p95 / 1000).toFixed(1)}s  max=${(max / 1000).toFixed(1)}s`);

  // Save to evals/results/
  const timestamp = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19);
  const outPath = path.join(process.cwd(), 'evals/results', `${timestamp}-remote-${SLICE}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        slice: SLICE,
        providerOverride: providerOverride ?? null,
        summary: { correct, total: rows.length, approved, reviewed, failed, errored, latencyMs: { avg, p50, p95, max } },
        rows
      },
      null,
      2
    )
  );
  console.log(`\nSaved: ${outPath}`);
  process.exit(errored > 0 ? 2 : correct === rows.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
