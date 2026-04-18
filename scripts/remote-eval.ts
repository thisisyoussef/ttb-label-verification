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
  /**
   * Number of HTTP attempts (1 = first call succeeded; 2 = one retry
   * fired). Populated whenever runOne's retry loop runs more than one
   * attempt. Used to split the headline latency stat from the one-off
   * retry tail so optimization judgments aren't polluted by proxy
   * flakiness or rate-limit retries.
   */
  attempts?: number;
  /**
   * Option C refine-pass fields. Populated when REFINE=on and the
   * baseline review had any identifier row in 'review' status, so
   * we fired a second /api/review/refine call. `refinedVerdict`
   * carries the post-refine top-line disposition; `refinedLatencyMs`
   * is the refine call's wall clock on its own (not stacked).
   * `refinedMatch` compares the refined verdict against `expected`.
   */
  refineFired?: boolean;
  refinedVerdict?: string;
  refinedLatencyMs?: number;
  refinedMatch?: boolean;
};

// RunPod's Cloudflare proxy occasionally returns 502/504 transients when the
// upstream takes slightly longer than the proxy's internal tolerance, or
// during Ollama model swaps. A single re-send almost always succeeds
// because the model is hot by then. Limited to 1 retry to avoid compounding
// flakiness into a DDoS on the pod.
const RETRY_STATUS_CODES = new Set([502, 503, 504, 521, 522, 524]);
const RETRY_DELAY_MS = 2000;

/**
 * REFINE=on enables the Option C second pass. After the baseline
 * /api/review lands, any row with status='review' that matches an
 * identifier field triggers a /api/review/refine call so the eval
 * can A/B "baseline alone" vs "baseline + refine".
 */
const REFINE_ENABLED = (process.env.REFINE ?? '')
  .trim()
  .toLowerCase() === 'on';

/** Identifier fields that the refine pass targets. Keep in sync with
 *  IDENTIFIER_FIELD_IDS in src/client/useRefineReview.ts. */
const IDENTIFIER_FIELD_IDS = new Set([
  'brand-name',
  'class-type',
  'country-of-origin',
  'applicant-address'
]);

/**
 * Build a fresh FormData for a review/refine call. FormData can only
 * be consumed once by fetch, so we rebuild it for each call instead
 * of trying to reuse the original — cheaper than the alternative
 * (stream cloning) and the image read is ~2 KB from the local disk.
 */
function buildReviewForm(c: Case, repoRoot: string, mime: string): FormData {
  const form = new FormData();
  const imgBuffer = readFileSync(path.join(repoRoot, c.path));
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
  return form;
}

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

  // Two attempts max: first request + one retry on transient 5xx. We
  // re-create the FormData on each attempt because FormData can only be
  // consumed once by fetch.
  let res: Response | undefined;
  let responseText = '';
  const attempts = 2;
  let attempt = 0;
  while (attempt < attempts) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const body = attempt === 1 ? form : (() => {
      const f = new FormData();
      const imgPath2 = path.join(repoRoot, c.path);
      f.append(
        'label',
        new Blob([readFileSync(imgPath2)], { type: mime }),
        path.basename(c.path)
      );
      f.append('fields', JSON.stringify({
        beverageType: c.beverageType, brandName: c.brand,
        fancifulName: c.fancifulName ?? '', classType: c.classType,
        alcoholContent: c.abv, netContents: c.net,
        applicantAddress: c.applicantAddress ?? '', origin: c.origin ?? 'domestic',
        country: c.country ?? '', formulaId: c.formulaId ?? '',
        appellation: c.appellation ?? '', vintage: c.vintage ?? '', varietals: []
      }));
      return f;
    })();
    try {
      res = await fetch(`${BASE_URL}/api/review`, {
        method: 'POST',
        body,
        headers,
        signal: controller.signal
      });
      responseText = await res.text();
      clearTimeout(timer);
      // Retry on 5xx transient; break on 2xx/4xx.
      if (res.ok || !RETRY_STATUS_CODES.has(res.status) || attempt >= attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } catch (error) {
      clearTimeout(timer);
      if (attempt >= attempts) {
        return {
          id: c.id,
          expected: c.expected,
          actual: 'error',
          latencyMs: Date.now() - started,
          match: false,
          failSummary: String((error as Error).message ?? error)
        };
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  const elapsed = Date.now() - started;

  if (!res || !res.ok) {
    return {
      id: c.id,
      expected: c.expected,
      actual: 'error',
      latencyMs: elapsed,
      match: false,
      failSummary: `HTTP ${res?.status ?? 'n/a'}${attempt > 1 ? ` (after ${attempt} attempts)` : ''}: ${responseText.slice(0, 160)}`,
      attempts: attempt
    };
  }

  const text = responseText;

  try {
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

    // Option C second pass. Matches the client's Results flow: if any
    // identifier row is in 'review' status after the baseline /api/
    // review lands, fire /api/review/refine (same inputs, server
    // flips VERIFICATION_MODE=on for just this call) to see if the
    // verification-mode prompt resolves the ambiguity. This gives the
    // eval a real head-to-head: "baseline" vs "baseline + refine".
    let refineFired = false;
    let refinedVerdict: string | undefined;
    let refinedLatencyMs: number | undefined;
    let refinedMatch: boolean | undefined;
    if (REFINE_ENABLED) {
      const hasRefinableRow = (data.checks ?? []).some(
        (ch) =>
          ch.status === 'review' && IDENTIFIER_FIELD_IDS.has(ch.id)
      );
      if (hasRefinableRow) {
        refineFired = true;
        const refineStarted = Date.now();
        try {
          const refineForm = buildReviewForm(c, repoRoot, mime);
          const refineController = new AbortController();
          const refineTimer = setTimeout(
            () => refineController.abort(),
            TIMEOUT_MS
          );
          const refineRes = await fetch(`${BASE_URL}/api/review/refine`, {
            method: 'POST',
            body: refineForm,
            headers,
            signal: refineController.signal
          });
          clearTimeout(refineTimer);
          if (refineRes.ok) {
            const refineText = await refineRes.text();
            const refineData = JSON.parse(refineText) as {
              verdict?: string;
            };
            refinedVerdict = refineData.verdict ?? 'error';
            refinedMatch =
              (c.expected === 'approve' &&
                (refinedVerdict === 'approve' || refinedVerdict === 'review')) ||
              (c.expected === 'reject' && refinedVerdict === 'reject');
          }
        } catch {
          // Refine failures don't fail the eval row — baseline verdict
          // is still authoritative. Mark refinedVerdict as 'error' so
          // the summary can count unsuccessful refines.
          refinedVerdict = 'error';
          refinedMatch = false;
        }
        refinedLatencyMs = Date.now() - refineStarted;
      }
    }

    return {
      id: c.id,
      expected: c.expected,
      actual: verdict,
      latencyMs: elapsed,
      verdict,
      match,
      failSummary: fails || undefined,
      attempts: attempt,
      refineFired,
      refinedVerdict,
      refinedLatencyMs,
      refinedMatch
    };
  } catch (error) {
    return {
      id: c.id,
      expected: c.expected,
      actual: 'error',
      latencyMs: elapsed,
      match: false,
      failSummary: `parse-failure: ${String((error as Error).message ?? error)}`,
      attempts: attempt
    };
  }
}

async function main() {
  const providerOverride = process.env.PROVIDER_OVERRIDE as 'cloud' | 'local' | undefined;
  console.log(`Remote eval against: ${BASE_URL}`);
  console.log(`Slice: ${SLICE}`);
  if (providerOverride) console.log(`Provider override: ${providerOverride}`);
  if (REFINE_ENABLED) console.log('Refine pass: enabled (REFINE=on)');
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
    // When refine ran, show baseline → refined inline so the reviewer
    // can see what the second pass changed at a glance.
    let refineSuffix = '';
    if (row.refineFired && row.refinedVerdict) {
      const refineIcon = row.refinedMatch ? '✓' : '✗';
      const refineSecs = ((row.refinedLatencyMs ?? 0) / 1000).toFixed(1);
      refineSuffix = ` → refine ${refineIcon} ${row.refinedVerdict} +${refineSecs}s`;
    }
    console.log(`${icon} ${row.actual.padEnd(8)} ${secs.padStart(5)}s${row.failSummary ? ` [${row.failSummary}]` : ''}${refineSuffix}`);
    rows.push(row);
  }

  console.log('─'.repeat(80));
  const correct = rows.filter((r) => r.match).length;
  const approved = rows.filter((r) => r.actual === 'approve').length;
  const reviewed = rows.filter((r) => r.actual === 'review').length;
  const failed = rows.filter((r) => r.actual === 'reject').length;
  const errored = rows.filter((r) => r.actual === 'error').length;
  const percentiles = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    const q = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
    return {
      avg: sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0,
      p50: q(0.5),
      p95: q(0.95),
      max: sorted.length ? sorted[sorted.length - 1] : 0
    };
  };
  const allRowsLatencies = rows
    .filter((r) => r.actual !== 'error')
    .map((r) => r.latencyMs);
  const cleanRowsLatencies = rows
    .filter((r) => r.actual !== 'error' && (r.attempts ?? 1) === 1)
    .map((r) => r.latencyMs);
  const allStats = percentiles(allRowsLatencies);
  const cleanStats = percentiles(cleanRowsLatencies);
  const retriedRows = rows.filter((r) => (r.attempts ?? 1) > 1);

  console.log(`Result:   ${correct}/${rows.length} correct (${((correct / rows.length) * 100).toFixed(0)}%)`);
  console.log(`Verdicts: ${approved} approve · ${reviewed} review · ${failed} reject · ${errored} error`);
  console.log(
    `Latency:  avg=${(allStats.avg / 1000).toFixed(1)}s  p50=${(allStats.p50 / 1000).toFixed(1)}s  p95=${(allStats.p95 / 1000).toFixed(1)}s  max=${(allStats.max / 1000).toFixed(1)}s`
  );
  if (retriedRows.length > 0) {
    console.log(
      `          (excl ${retriedRows.length} retry${retriedRows.length === 1 ? '' : 's'}: avg=${(cleanStats.avg / 1000).toFixed(1)}s  p50=${(cleanStats.p50 / 1000).toFixed(1)}s  p95=${(cleanStats.p95 / 1000).toFixed(1)}s  max=${(cleanStats.max / 1000).toFixed(1)}s)`
    );
  }

  // Option C refine A/B summary: report what the second pass changed.
  // `baselineCorrect` is the headline `correct` above (refined doesn't
  // overwrite it). `refinedCorrect` replaces the baseline verdict with
  // the refined verdict wherever refine fired, then re-scores.
  const refineRows = rows.filter((r) => r.refineFired);
  const refineSummary =
    REFINE_ENABLED && refineRows.length > 0
      ? (() => {
          let flipsReview2Approve = 0;
          let flipsApprove2Review = 0;
          let flipsToReject = 0;
          let refinedCorrect = 0;
          let refineTotalLatencyMs = 0;
          for (const r of rows) {
            // Default: row's verdict is unchanged.
            let finalVerdict = r.verdict ?? r.actual;
            let finalMatch = r.match;
            if (r.refineFired && r.refinedVerdict) {
              finalVerdict = r.refinedVerdict;
              finalMatch = r.refinedMatch ?? false;
              refineTotalLatencyMs += r.refinedLatencyMs ?? 0;
              if (r.verdict === 'review' && finalVerdict === 'approve') flipsReview2Approve += 1;
              if (r.verdict === 'approve' && finalVerdict === 'review') flipsApprove2Review += 1;
              if (r.verdict !== 'reject' && finalVerdict === 'reject') flipsToReject += 1;
            }
            if (finalMatch) refinedCorrect += 1;
          }
          return {
            fired: refineRows.length,
            refinedCorrect,
            flipsReview2Approve,
            flipsApprove2Review,
            flipsToReject,
            avgLatencyMs: refineRows.length
              ? Math.round(refineTotalLatencyMs / refineRows.length)
              : 0
          };
        })()
      : null;
  if (refineSummary) {
    console.log('');
    console.log('Refine pass A/B:');
    console.log(
      `  Baseline: ${correct}/${rows.length} · Baseline+refine: ${refineSummary.refinedCorrect}/${rows.length} (Δ ${refineSummary.refinedCorrect - correct >= 0 ? '+' : ''}${refineSummary.refinedCorrect - correct})`
    );
    console.log(
      `  Refine fired on ${refineSummary.fired} label${refineSummary.fired === 1 ? '' : 's'} (avg +${(refineSummary.avgLatencyMs / 1000).toFixed(1)}s per refine)`
    );
    console.log(
      `  Flips: review→approve ${refineSummary.flipsReview2Approve}, approve→review ${refineSummary.flipsApprove2Review}, →reject ${refineSummary.flipsToReject}`
    );
  }

  // Pre-summary variables reused when serializing the JSON artifact below.
  const avg = allStats.avg;
  const p50 = allStats.p50;
  const p95 = allStats.p95;
  const max = allStats.max;

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
        summary: {
          correct,
          total: rows.length,
          approved,
          reviewed,
          failed,
          errored,
          latencyMs: { avg, p50, p95, max },
          // Latency with retried requests excluded — see runOne retry
          // loop. Helps A/B optimization work that's otherwise polluted
          // by one-off proxy retries.
          latencyMsExcludingRetries: cleanStats,
          retriedCount: retriedRows.length,
          refine: refineSummary
        },
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
