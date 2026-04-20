/**
 * Experiment runner for extraction pipeline optimization.
 * Runs the fast eval with different configurations and records results.
 *
 * Usage: OCR_PREPASS=enabled REGION_DETECTION=disabled npx tsx scripts/experiment-runner.ts --name "baseline"
 */

import { createServer } from 'http';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

// Types
interface ExperimentConfig {
  name: string;
  env: Record<string, string>;
  description: string;
}

interface LabelResult {
  label: string;
  expected: string;
  actual: string;
  correct: boolean;
  checks: { id: string; status: string; appValue?: string; extValue?: string }[];
  latencyMs: number;
}

interface ExperimentResult {
  name: string;
  description: string;
  timestamp: string;
  env: Record<string, string>;
  labels: LabelResult[];
  summary: {
    total: number;
    correct: number;
    approved: number;
    reviewed: number;
    rejected: number;
    errors: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    successRate: string;
    approveRate: string;
    falseRejectRate: string;
  };
}

// Core six test labels with expected outcomes
const TEST_LABELS = [
  { id: 'simply-elegant', expected: 'approve', file: 'simply-elegant-spirits.png' },
  { id: 'persian-empire', expected: 'approve', file: 'persian-empire-spirits.webp' },
  { id: 'leitz-rottland', expected: 'approve', file: 'leitz-rottland-wine.webp' },
  { id: 'stormwood', expected: 'approve', file: 'stormwood-semillon-wine.webp' },
  { id: 'lake-placid', expected: 'approve', file: 'lake-placid-shredder-malt.webp' },
  { id: 'harpoon', expected: 'approve', file: 'harpoon-ale-malt.webp' },
  { id: 'negative-abv', expected: 'reject', file: 'lake-placid-shredder-abv-negative.webp' },
];

// Application data for each label
const APP_DATA: Record<string, Record<string, string>> = {
  'simply-elegant': {
    brandName: 'Simply Elegant', classType: 'Straight Bourbon Whiskey',
    alcoholContent: '67% Alc./Vol.', netContents: '750 mL',
    beverageType: 'distilled-spirits', fancifulName: '', applicantAddress: '',
    country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: ''
  },
  'persian-empire': {
    brandName: 'Persian Empire', classType: 'Other Specialties & Proprietaries',
    alcoholContent: '40% Alc./Vol.', netContents: '750 mL',
    beverageType: 'distilled-spirits', fancifulName: 'Arak Saggi', applicantAddress: '',
    country: 'Canada', formulaId: '', appellation: '', vintage: '', varietals: ''
  },
  'leitz-rottland': {
    brandName: 'Leitz', classType: 'Table White Wine',
    alcoholContent: '12.5% Alc./Vol.', netContents: '750 mL',
    beverageType: 'wine', fancifulName: 'Rottland', applicantAddress: '',
    country: 'Germany', formulaId: '', appellation: 'Rheingau', vintage: '2020', varietals: 'Riesling'
  },
  'stormwood': {
    brandName: 'Stormwood Wines', classType: 'Table White Wine',
    alcoholContent: '13% Alc./Vol.', netContents: '750 mL',
    beverageType: 'wine', fancifulName: '', applicantAddress: '',
    country: 'Australia', formulaId: '', appellation: '', vintage: '2022', varietals: 'Semillon'
  },
  'lake-placid': {
    brandName: 'Lake Placid Craft Brewing', classType: 'Beer',
    alcoholContent: '4% Alc./Vol.', netContents: '12 FL OZ',
    beverageType: 'malt-beverage', fancifulName: 'Shredder', applicantAddress: '',
    country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: ''
  },
  'harpoon': {
    brandName: 'Harpoon', classType: 'Ale',
    alcoholContent: '5.0% Alc./Vol.', netContents: '1 PINT (16 FL OZ)',
    beverageType: 'malt-beverage', fancifulName: '', applicantAddress: '',
    country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: ''
  },
  'negative-abv': {
    brandName: 'Lake Placid Craft Brewing', classType: 'Beer',
    alcoholContent: '9.8% Alc./Vol.', netContents: '12 FL OZ',
    beverageType: 'malt-beverage', fancifulName: 'Shredder', applicantAddress: '',
    country: 'USA', formulaId: '', appellation: '', vintage: '', varietals: ''
  },
};

async function runExperiment(config: ExperimentConfig): Promise<ExperimentResult> {
  // Set environment
  for (const [k, v] of Object.entries(config.env)) {
    process.env[k] = v;
  }
  process.env.NODE_ENV = 'test';

  // Start server
  const { createApp } = await import('../../src/server/index');
  const server = createServer(createApp());
  const port = await new Promise<number>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      resolve(typeof addr === 'object' ? addr!.port : 0);
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[${config.name}] Server on ${baseUrl}`);

  const labels: LabelResult[] = [];

  for (const label of TEST_LABELS) {
    const start = performance.now();
    try {
      const filePath = resolve('evals/labels', label.file);
      if (!existsSync(filePath)) {
        labels.push({ label: label.id, expected: label.expected, actual: 'error', correct: false, checks: [], latencyMs: 0 });
        continue;
      }

      const fileBuffer = readFileSync(filePath);
      const form = new FormData();
      const ext = label.file.split('.').pop() || 'png';
      const mimeType = ext === 'webp' ? 'image/webp' : 'image/png';
      form.append('label', new Blob([fileBuffer], { type: mimeType }), label.file);
      form.append('fields', JSON.stringify(APP_DATA[label.id] || {}));

      const resp = await fetch(`${baseUrl}/api/review`, {
        method: 'POST',
        body: form,
      });

      const elapsed = performance.now() - start;
      const data = await resp.json() as any;

      const verdict = data.verdict || 'error';
      const checks = (data.checks || []).map((ch: any) => ({
        id: ch.id,
        status: ch.status,
        appValue: ch.applicationValue,
        extValue: ch.extractedValue,
      }));

      const correct = verdict === label.expected ||
        (label.expected === 'approve' && (verdict === 'approve' || verdict === 'review'));

      labels.push({
        label: label.id,
        expected: label.expected,
        actual: verdict,
        correct,
        checks,
        latencyMs: Math.round(elapsed),
      });

      const icon = correct ? '✓' : '✗';
      console.log(`  ${icon} ${label.id}: ${verdict} (${Math.round(elapsed)}ms)`);
    } catch (err: any) {
      const elapsed = performance.now() - start;
      labels.push({ label: label.id, expected: label.expected, actual: 'error', correct: false, checks: [], latencyMs: Math.round(elapsed) });
      console.log(`  ✗ ${label.id}: error (${err.message})`);
    }
  }

  server.close();

  // Calculate summary
  const latencies = labels.map(l => l.latencyMs).sort((a, b) => a - b);
  const approved = labels.filter(l => l.expected === 'approve');
  const approvedCorrect = approved.filter(l => l.actual === 'approve');
  const falseRejects = approved.filter(l => l.actual === 'reject');

  const result: ExperimentResult = {
    name: config.name,
    description: config.description,
    timestamp: new Date().toISOString(),
    env: config.env,
    labels,
    summary: {
      total: labels.length,
      correct: labels.filter(l => l.correct).length,
      approved: labels.filter(l => l.actual === 'approve').length,
      reviewed: labels.filter(l => l.actual === 'review').length,
      rejected: labels.filter(l => l.actual === 'reject').length,
      errors: labels.filter(l => l.actual === 'error').length,
      avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p50LatencyMs: latencies[Math.floor(latencies.length / 2)],
      p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)],
      successRate: ((labels.filter(l => l.correct).length / labels.length) * 100).toFixed(1) + '%',
      approveRate: ((approvedCorrect.length / approved.length) * 100).toFixed(1) + '%',
      falseRejectRate: ((falseRejects.length / approved.length) * 100).toFixed(1) + '%',
    },
  };

  return result;
}

// Experiment definitions
const EXPERIMENTS: ExperimentConfig[] = [
  // Experiment 1: Baseline — no OCR, no regions, no judgment
  { name: 'exp-01-baseline-vlm-only', description: 'VLM-only extraction, no OCR pre-pass, no region detection', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled' } },
  // Experiment 2: OCR pre-pass only
  { name: 'exp-02-ocr-prepass-only', description: 'OCR pre-pass + VLM, no region detection', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'disabled' } },
  // Experiment 3: Full pipeline (OCR + regions)
  { name: 'exp-03-full-pipeline', description: 'OCR pre-pass + VLM + region detection', env: { OCR_PREPASS: 'enabled', REGION_DETECTION: 'enabled' } },
  // Experiment 4: VLM only, no OCR override
  { name: 'exp-04-vlm-no-override', description: 'VLM extraction without OCR field override', env: { OCR_PREPASS: 'disabled', REGION_DETECTION: 'disabled', OCR_OVERRIDE: 'disabled' } },
];

async function main() {
  const resultsDir = resolve('evals/experiments');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });

  const name = process.argv.find(a => a.startsWith('--name='))?.split('=')[1]
    || process.argv[process.argv.indexOf('--name') + 1];

  if (name) {
    // Run single experiment
    const config = EXPERIMENTS.find(e => e.name === name) || {
      name, description: `Custom experiment: ${name}`,
      env: Object.fromEntries(
        Object.entries(process.env)
          .filter(([k]) => ['OCR_PREPASS', 'REGION_DETECTION', 'SIMPLE_PIPELINE', 'OCR_OVERRIDE'].includes(k))
          .map(([k, v]) => [k, v ?? ''])
      ) as Record<string, string>,
    };
    const result = await runExperiment(config);
    writeFileSync(resolve(resultsDir, `${name}.json`), JSON.stringify(result, null, 2));
    console.log(`\n[${name}] Summary:`);
    console.log(JSON.stringify(result.summary, null, 2));
  } else {
    // Run all experiments
    const allResults: ExperimentResult[] = [];
    for (const config of EXPERIMENTS) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Experiment: ${config.name}`);
      console.log(`Description: ${config.description}`);
      console.log('='.repeat(60));
      const result = await runExperiment(config);
      allResults.push(result);
      writeFileSync(resolve(resultsDir, `${config.name}.json`), JSON.stringify(result, null, 2));
    }

    // Comparison table
    console.log('\n' + '='.repeat(80));
    console.log('EXPERIMENT COMPARISON');
    console.log('='.repeat(80));
    console.log('Name'.padEnd(30) + 'Approve'.padEnd(10) + 'Review'.padEnd(10) + 'Reject'.padEnd(10) + 'AvgMs'.padEnd(10) + 'P95Ms');
    for (const r of allResults) {
      console.log(
        r.name.padEnd(30) +
        String(r.summary.approved).padEnd(10) +
        String(r.summary.reviewed).padEnd(10) +
        String(r.summary.rejected).padEnd(10) +
        String(r.summary.avgLatencyMs).padEnd(10) +
        String(r.summary.p95LatencyMs)
      );
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
