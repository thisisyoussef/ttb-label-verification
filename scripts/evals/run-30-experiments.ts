/**
 * Systematic experiment runner — 30+ configurations tested automatically.
 *
 * Modifies scoring/judgment parameters between runs, records results,
 * and produces a comparison table at the end.
 *
 * Usage: npx tsx scripts/run-30-experiments.ts
 */

import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createServer, type Server } from 'http';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LabelResult {
  label: string;
  expected: string;
  actual: string;
  correct: boolean;
  latencyMs: number;
  checks: string[];
}

interface ExperimentResult {
  id: number;
  name: string;
  description: string;
  approved: number;
  reviewed: number;
  rejected: number;
  errors: number;
  correct: number;
  total: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: string;
  approveRate: string;
  falseRejectRate: string;
  labels: LabelResult[];
}

// ─── Test labels ────────────────────────────────────────────────────────────

const TEST_LABELS = [
  { id: 'simply-elegant', expected: 'approve', file: 'simply-elegant-spirits.png' },
  { id: 'persian-empire', expected: 'approve', file: 'persian-empire-spirits.webp' },
  { id: 'leitz-rottland', expected: 'approve', file: 'leitz-rottland-wine.webp' },
  { id: 'stormwood', expected: 'approve', file: 'stormwood-semillon-wine.webp' },
  { id: 'lake-placid', expected: 'approve', file: 'lake-placid-shredder-malt.webp' },
  { id: 'harpoon', expected: 'approve', file: 'harpoon-ale-malt.webp' },
  { id: 'negative-abv', expected: 'reject', file: 'lake-placid-shredder-abv-negative.webp' },
];

const APP_DATA: Record<string, Record<string, string>> = {
  'simply-elegant': { brandName: 'Simply Elegant', classType: 'Straight Bourbon Whiskey', alcoholContent: '67% Alc./Vol.', netContents: '750 mL', beverageType: 'distilled-spirits', fancifulName: '', applicantAddress: '', country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: '' },
  'persian-empire': { brandName: 'Persian Empire', classType: 'Other Specialties & Proprietaries', alcoholContent: '40% Alc./Vol.', netContents: '750 mL', beverageType: 'distilled-spirits', fancifulName: 'Arak Saggi', applicantAddress: '', country: 'Canada', formulaId: '', appellation: '', vintage: '', varietals: '' },
  'leitz-rottland': { brandName: 'Leitz', classType: 'Table White Wine', alcoholContent: '12.5% Alc./Vol.', netContents: '750 mL', beverageType: 'wine', fancifulName: 'Rottland', applicantAddress: '', country: 'Germany', formulaId: '', appellation: 'Rheingau', vintage: '2020', varietals: 'Riesling' },
  'stormwood': { brandName: 'Stormwood Wines', classType: 'Table White Wine', alcoholContent: '13% Alc./Vol.', netContents: '750 mL', beverageType: 'wine', fancifulName: '', applicantAddress: '', country: 'Australia', formulaId: '', appellation: '', vintage: '2022', varietals: 'Semillon' },
  'lake-placid': { brandName: 'Lake Placid Craft Brewing', classType: 'Beer', alcoholContent: '4% Alc./Vol.', netContents: '12 FL OZ', beverageType: 'malt-beverage', fancifulName: 'Shredder', applicantAddress: '', country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: '' },
  'harpoon': { brandName: 'Harpoon', classType: 'Ale', alcoholContent: '5.0% Alc./Vol.', netContents: '1 PINT (16 FL OZ)', beverageType: 'malt-beverage', fancifulName: '', applicantAddress: '', country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: '' },
  'negative-abv': { brandName: 'Lake Placid Craft Brewing', classType: 'Beer', alcoholContent: '9.8% Alc./Vol.', netContents: '12 FL OZ', beverageType: 'malt-beverage', fancifulName: 'Shredder', applicantAddress: '', country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: '' },
};

// ─── Experiment definitions ─────────────────────────────────────────────────

interface ExperimentDef {
  name: string;
  description: string;
  env: Record<string, string>;
}

const EXPERIMENTS: ExperimentDef[] = [
  // --- Group 1: Feature flags ---
  { name: 'vlm-only', description: 'VLM only, no OCR, no regions', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled' } },
  { name: 'ocr+vlm', description: 'OCR pre-pass + VLM, no regions', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'full-pipeline', description: 'OCR + VLM + region detection', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled' } },
  { name: 'ocr-only-no-vlm', description: 'OCR regex only, VLM disabled (pure deterministic)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled', VLM_EXTRACTION: 'disabled' } },

  // --- Group 2: Repeat best config 3x for consistency ---
  { name: 'ocr+vlm-run2', description: 'OCR pre-pass + VLM (repeat 2)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'ocr+vlm-run3', description: 'OCR pre-pass + VLM (repeat 3)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'vlm-only-run2', description: 'VLM only (repeat 2)', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled' } },

  // --- Group 3: Provider variations ---
  { name: 'gemini-only', description: 'Gemini as sole provider', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled', OPENAI_API_KEY: '' } },
  { name: 'openai-only', description: 'OpenAI as sole provider', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled', GEMINI_API_KEY: '' } },

  // --- Group 4: Repeat with regions for consistency ---
  { name: 'full-pipeline-run2', description: 'Full pipeline (repeat 2)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled' } },
  { name: 'full-pipeline-run3', description: 'Full pipeline (repeat 3)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled' } },

  // --- Group 5: More repeats of best config for statistical significance ---
  { name: 'ocr+vlm-run4', description: 'OCR + VLM (repeat 4)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'ocr+vlm-run5', description: 'OCR + VLM (repeat 5)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'vlm-only-run3', description: 'VLM only (repeat 3)', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled' } },
  { name: 'vlm-only-run4', description: 'VLM only (repeat 4)', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled' } },
  { name: 'vlm-only-run5', description: 'VLM only (repeat 5)', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled' } },

  // --- Group 6: Provider variations repeat ---
  { name: 'gemini-only-run2', description: 'Gemini only (repeat 2)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled', OPENAI_API_KEY: '' } },
  { name: 'openai-only-run2', description: 'OpenAI only (repeat 2)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled', GEMINI_API_KEY: '' } },

  // --- Group 7: Mixed configs ---
  { name: 'regions-no-ocr', description: 'Region detection without OCR pre-pass', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'enabled' } },
  { name: 'gemini-no-ocr', description: 'Gemini only, no OCR', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled', OPENAI_API_KEY: '' } },
  { name: 'openai-no-ocr', description: 'OpenAI only, no OCR', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled', GEMINI_API_KEY: '' } },

  // --- Group 8: More repeats for tail consistency ---
  { name: 'ocr+vlm-run6', description: 'OCR + VLM (repeat 6)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'ocr+vlm-run7', description: 'OCR + VLM (repeat 7)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'ocr+vlm-run8', description: 'OCR + VLM (repeat 8)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'ocr+vlm-run9', description: 'OCR + VLM (repeat 9)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  { name: 'ocr+vlm-run10', description: 'OCR + VLM (repeat 10)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },

  // --- Group 9: Full pipeline repeats ---
  { name: 'full-pipeline-run4', description: 'Full pipeline (repeat 4)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled' } },
  { name: 'full-pipeline-run5', description: 'Full pipeline (repeat 5)', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled' } },

  // --- Group 10: Provider + feature combos ---
  { name: 'gemini+regions', description: 'Gemini + region detection', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled', OPENAI_API_KEY: '' } },
  { name: 'openai+regions', description: 'OpenAI + region detection', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled', GEMINI_API_KEY: '' } },
];

// ─── Runner ─────────────────────────────────────────────────────────────────

async function runSingleExperiment(def: ExperimentDef, expId: number): Promise<ExperimentResult> {
  // Store original env
  const origEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(def.env)) {
    origEnv[k] = process.env[k];
    if (v === '') {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  // Start server (reimport each time for clean state)
  const mod = await import(`../src/server/index?t=${Date.now()}`);
  const app = mod.default;
  const server: Server = createServer(app);
  const port = await new Promise<number>((res) => {
    server.listen(0, () => {
      const addr = server.address();
      res(typeof addr === 'object' ? addr!.port : 0);
    });
  });

  const labels: LabelResult[] = [];

  for (const label of TEST_LABELS) {
    const start = performance.now();
    try {
      const filePath = resolve('evals/labels', label.file);
      if (!existsSync(filePath)) {
        labels.push({ label: label.id, expected: label.expected, actual: 'error', correct: false, latencyMs: 0, checks: [] });
        continue;
      }
      const fileBuffer = readFileSync(filePath);
      const ext = label.file.split('.').pop() || 'png';
      const mimeType = ext === 'webp' ? 'image/webp' : 'image/png';
      const form = new FormData();
      form.append('label', new Blob([fileBuffer], { type: mimeType }), label.file);
      form.append('fields', JSON.stringify(APP_DATA[label.id] || {}));

      const resp = await fetch(`http://127.0.0.1:${port}/api/review`, { method: 'POST', body: form });
      const elapsed = performance.now() - start;
      const data = await resp.json() as any;
      const verdict = data.verdict || 'error';
      const checks = (data.checks || []).map((ch: any) =>
        `${ch.id}:${ch.status}${ch.status !== 'pass' && ch.status !== 'info' ? `[${ch.applicationValue || '?'}→${ch.extractedValue || '?'}]` : ''}`
      );

      const correct = verdict === label.expected ||
        (label.expected === 'approve' && verdict === 'review');

      labels.push({ label: label.id, expected: label.expected, actual: verdict, correct, latencyMs: Math.round(elapsed), checks });
    } catch (err: any) {
      labels.push({ label: label.id, expected: label.expected, actual: 'error', correct: false, latencyMs: Math.round(performance.now() - start), checks: [`error:${err.message}`] });
    }
  }

  server.close();

  // Restore env
  for (const [k, v] of Object.entries(origEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  const latencies = labels.map(l => l.latencyMs).sort((a, b) => a - b);
  const approved = labels.filter(l => l.expected === 'approve');

  return {
    id: expId,
    name: def.name,
    description: def.description,
    approved: labels.filter(l => l.actual === 'approve').length,
    reviewed: labels.filter(l => l.actual === 'review').length,
    rejected: labels.filter(l => l.actual === 'reject').length,
    errors: labels.filter(l => l.actual === 'error').length,
    correct: labels.filter(l => l.correct).length,
    total: labels.length,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)] || 0,
    successRate: ((labels.filter(l => l.correct).length / labels.length) * 100).toFixed(1),
    approveRate: ((labels.filter(l => l.actual === 'approve' && l.expected === 'approve').length / approved.length) * 100).toFixed(1),
    falseRejectRate: ((approved.filter(l => l.actual === 'reject').length / approved.length) * 100).toFixed(1),
    labels,
  };
}

async function main() {
  console.log(`Running ${EXPERIMENTS.length} experiments...\n`);

  const resultsDir = resolve('evals/experiments');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });

  const allResults: ExperimentResult[] = [];

  for (let i = 0; i < EXPERIMENTS.length; i++) {
    const def = EXPERIMENTS[i];
    console.log(`\n[${'='.repeat(60)}]`);
    console.log(`[Exp ${i + 1}/${EXPERIMENTS.length}] ${def.name}: ${def.description}`);
    console.log(`[${'='.repeat(60)}]`);

    try {
      const result = await runSingleExperiment(def, i + 1);
      allResults.push(result);

      // Print per-label results
      for (const l of result.labels) {
        const icon = l.correct ? '✓' : '✗';
        console.log(`  ${icon} ${l.label.padEnd(20)} ${l.actual.padEnd(8)} ${l.latencyMs}ms`);
      }
      console.log(`  → Approve: ${result.approved}  Review: ${result.reviewed}  Reject: ${result.rejected}  Error: ${result.errors}  Avg: ${result.avgLatencyMs}ms`);

      // Save individual result
      writeFileSync(resolve(resultsDir, `exp-${String(i + 1).padStart(2, '0')}-${def.name}.json`), JSON.stringify(result, null, 2));
    } catch (err: any) {
      console.log(`  ✗ EXPERIMENT FAILED: ${err.message}`);
      allResults.push({
        id: i + 1, name: def.name, description: def.description,
        approved: 0, reviewed: 0, rejected: 0, errors: 7, correct: 0, total: 7,
        avgLatencyMs: 0, p95LatencyMs: 0,
        successRate: '0.0', approveRate: '0.0', falseRejectRate: '0.0',
        labels: [],
      });
    }
  }

  // ─── Final comparison table ─────────────────────────────────────────────

  console.log('\n' + '═'.repeat(120));
  console.log('EXPERIMENT COMPARISON TABLE');
  console.log('═'.repeat(120));
  console.log(
    '#'.padEnd(4) +
    'Name'.padEnd(25) +
    'Approve'.padEnd(9) +
    'Review'.padEnd(9) +
    'Reject'.padEnd(9) +
    'Error'.padEnd(8) +
    'Correct'.padEnd(9) +
    'Success%'.padEnd(10) +
    'Approve%'.padEnd(10) +
    'FalseRej%'.padEnd(11) +
    'AvgMs'.padEnd(8) +
    'P95Ms'
  );
  console.log('─'.repeat(120));

  for (const r of allResults) {
    console.log(
      String(r.id).padEnd(4) +
      r.name.padEnd(25) +
      String(r.approved).padEnd(9) +
      String(r.reviewed).padEnd(9) +
      String(r.rejected).padEnd(9) +
      String(r.errors).padEnd(8) +
      String(r.correct).padEnd(9) +
      r.successRate.padEnd(10) +
      r.approveRate.padEnd(10) +
      r.falseRejectRate.padEnd(11) +
      String(r.avgLatencyMs).padEnd(8) +
      String(r.p95LatencyMs)
    );
  }

  // ─── Summary statistics ─────────────────────────────────────────────────

  const grouped: Record<string, ExperimentResult[]> = {};
  for (const r of allResults) {
    const base = r.name.replace(/-run\d+$/, '');
    if (!grouped[base]) grouped[base] = [];
    grouped[base].push(r);
  }

  console.log('\n' + '═'.repeat(100));
  console.log('AGGREGATED BY CONFIG (mean ± std across repeats)');
  console.log('═'.repeat(100));
  console.log('Config'.padEnd(25) + 'Runs'.padEnd(6) + 'Approve%'.padEnd(12) + 'FalseRej%'.padEnd(12) + 'AvgMs'.padEnd(10) + 'P95Ms');
  console.log('─'.repeat(100));

  for (const [config, runs] of Object.entries(grouped)) {
    const approveRates = runs.map(r => parseFloat(r.approveRate));
    const falseRejRates = runs.map(r => parseFloat(r.falseRejectRate));
    const avgLatencies = runs.map(r => r.avgLatencyMs);
    const p95Latencies = runs.map(r => r.p95LatencyMs);

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = (arr: number[]) => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
    };

    console.log(
      config.padEnd(25) +
      String(runs.length).padEnd(6) +
      `${mean(approveRates).toFixed(1)}±${std(approveRates).toFixed(1)}`.padEnd(12) +
      `${mean(falseRejRates).toFixed(1)}±${std(falseRejRates).toFixed(1)}`.padEnd(12) +
      `${Math.round(mean(avgLatencies))}±${Math.round(std(avgLatencies))}`.padEnd(10) +
      `${Math.round(mean(p95Latencies))}±${Math.round(std(p95Latencies))}`
    );
  }

  // Save all results
  writeFileSync(resolve(resultsDir, 'all-experiments.json'), JSON.stringify(allResults, null, 2));
  console.log(`\nAll ${allResults.length} experiment results saved to evals/experiments/`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
