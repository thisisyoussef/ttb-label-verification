/**
 * Proof-of-concept eval runner for the fully-local LLM pipeline.
 *
 * Pipeline for each label:
 *   1. Read image buffer from disk
 *   2. Run Tesseract OCR pre-pass
 *   3. Ask local LLM (Qwen2.5-1.5B via node-llama-cpp) to structure the OCR text
 *   4. Build a full VerificationReport using the existing review-report pipeline
 *   5. Record verdict + latency for comparison
 *
 * Run with:
 *   nvm use 20
 *   npx tsx scripts/run-local-llm-eval.ts
 *
 * Output: evals/results/2026-04-16-local-llm-poc.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import type {
  VerificationReport
} from '../src/shared/contracts/review';
import {
  createLocalLlmReviewExtractor,
  readLocalLlmReviewExtractionConfig
} from '../src/server/local-llm-review-extractor';
import {
  createLocalLlmInferenceFn,
  disposeLocalLlmCache
} from '../src/server/local-llm-inference';
import { runOcrPrepass } from '../src/server/ocr-prepass';
import type { NormalizedReviewIntake, NormalizedReviewFields } from '../src/server/review-intake';
import { buildGovernmentWarningCheck } from '../src/server/government-warning-validator';
import { buildVerificationReport } from '../src/server/review-report';

interface ImageCase {
  id: string;
  assetPath: string;
  beverageType: string;
  expectedRecommendation: string;
  source: string;
}

interface BatchSet {
  id: string;
  title: string;
  csvFile: string;
  imageCases: ImageCase[];
}

interface BatchManifest {
  sets: BatchSet[];
}

interface CsvRow {
  filename: string;
  beverage_type: string;
  brand_name: string;
  fanciful_name: string;
  class_type: string;
  alcohol_content: string;
  net_contents: string;
  applicant_address: string;
  origin: string;
  country: string;
  formula_id: string;
  appellation: string;
  vintage: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (const [i, name] of header.entries()) {
      row[name] = cells[i] ?? '';
    }
    return row as unknown as CsvRow;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function mimeFor(filename: string): string {
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function buildNormalizedFields(row: CsvRow | undefined): NormalizedReviewFields {
  if (!row) {
    return {
      beverageTypeHint: 'auto',
      origin: 'domestic',
      varietals: []
    };
  }
  const beverageTypeHint =
    row.beverage_type === 'distilled-spirits' ||
    row.beverage_type === 'wine' ||
    row.beverage_type === 'malt-beverage'
      ? row.beverage_type
      : 'auto';
  const origin = row.origin === 'imported' ? 'imported' : 'domestic';

  const optional = (s: string) => (s && s.trim().length > 0 ? s.trim() : undefined);

  return {
    beverageTypeHint,
    origin,
    brandName: optional(row.brand_name),
    fancifulName: optional(row.fanciful_name),
    classType: optional(row.class_type),
    alcoholContent: optional(row.alcohol_content),
    netContents: optional(row.net_contents),
    applicantAddress: optional(row.applicant_address),
    country: optional(row.country),
    formulaId: optional(row.formula_id),
    appellation: optional(row.appellation),
    vintage: optional(row.vintage),
    varietals: []
  };
}

async function main() {
  const repoRoot = process.cwd();
  const manifestPath = path.join(repoRoot, 'evals/batch/cola-cloud/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as BatchManifest;
  const targetSet = manifest.sets.find((s) => s.id === 'cola-cloud-all');
  if (!targetSet) {
    throw new Error('cola-cloud-all set not found in manifest');
  }

  const csvPath = path.join(repoRoot, 'evals/batch/cola-cloud', targetSet.csvFile);
  const csvText = await readFile(csvPath, 'utf8');
  const csvRows = parseCsv(csvText);
  const csvByFilename = new Map(csvRows.map((r) => [r.filename, r]));

  // Initialize local LLM.
  const configResult = readLocalLlmReviewExtractionConfig(process.env);
  if (!configResult.success) {
    console.error('[config] failed:', configResult.error.message);
    process.exit(2);
  }

  console.log('[init] config:', configResult.value);
  const loadStart = performance.now();
  const inferenceFn = createLocalLlmInferenceFn(configResult.value);

  // Warm up the model once so we don't charge its cold-start to the first label.
  console.log('[init] warming up model...');
  await inferenceFn({
    prompt: 'Respond with only this JSON and nothing else.',
    maxTokens: 32,
    jsonSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false
    }
  });
  const loadMs = Math.round(performance.now() - loadStart);
  console.log(`[init] model ready after ${loadMs}ms`);

  const extractor = createLocalLlmReviewExtractor({
    config: configResult.value,
    inferenceFn
  });

  // Collect per-image results.
  interface RowResult {
    imageId: string;
    filename: string;
    expectedRecommendation: string;
    verdict: string | null;
    status: 'pass' | 'review' | 'fail' | 'error';
    latencyMs: number;
    ocrDurationMs: number;
    inferenceDurationMs: number;
    ocrTextLength: number;
    extractedBrand: string | null;
    extractedClassType: string | null;
    extractedAlcoholContent: string | null;
    extractedNetContents: string | null;
    extractedWarningLength: number;
    errorMessage: string | null;
    fieldChecks: Record<string, { status: string; summary: string } | null>;
    warningStatus: string | null;
  }

  const results: RowResult[] = [];

  for (const [idx, image] of targetSet.imageCases.entries()) {
    const absPath = path.join(repoRoot, image.assetPath);
    const filename = path.basename(absPath);
    const progress = `[${idx + 1}/${targetSet.imageCases.length}]`;

    console.log(`${progress} ${filename}`);
    const csvRow = csvByFilename.get(filename);
    const fields = buildNormalizedFields(csvRow);
    const hasApplicationData =
      Boolean(fields.brandName) ||
      Boolean(fields.fancifulName) ||
      Boolean(fields.classType) ||
      Boolean(fields.alcoholContent);

    let buffer: Buffer;
    try {
      buffer = await readFile(absPath);
    } catch (err) {
      results.push({
        imageId: image.id,
        filename,
        expectedRecommendation: image.expectedRecommendation,
        verdict: null,
        status: 'error',
        latencyMs: 0,
        ocrDurationMs: 0,
        inferenceDurationMs: 0,
        ocrTextLength: 0,
        extractedBrand: null,
        extractedClassType: null,
        extractedAlcoholContent: null,
        extractedNetContents: null,
        extractedWarningLength: 0,
        errorMessage: `file read failed: ${(err as Error).message}`,
        fieldChecks: {},
        warningStatus: null
      });
      continue;
    }

    const intake: NormalizedReviewIntake = {
      label: {
        originalName: filename,
        mimeType: mimeFor(filename),
        bytes: buffer.byteLength,
        buffer
      },
      fields,
      hasApplicationData,
      standalone: !hasApplicationData
    };

    const wallStart = performance.now();
    const ocrStart = performance.now();
    const ocr = await runOcrPrepass(intake.label);
    const ocrMs = Math.round(performance.now() - ocrStart);

    if (ocr.status === 'failed') {
      const latencyMs = Math.round(performance.now() - wallStart);
      results.push({
        imageId: image.id,
        filename,
        expectedRecommendation: image.expectedRecommendation,
        verdict: null,
        status: 'error',
        latencyMs,
        ocrDurationMs: ocrMs,
        inferenceDurationMs: 0,
        ocrTextLength: 0,
        extractedBrand: null,
        extractedClassType: null,
        extractedAlcoholContent: null,
        extractedNetContents: null,
        extractedWarningLength: 0,
        errorMessage: `ocr failed: ${ocr.reason}`,
        fieldChecks: {},
        warningStatus: null
      });
      continue;
    }
    const ocrText = ocr.text;

    const intakeWithOcr: NormalizedReviewIntake = { ...intake, ocrText };
    const inferStart = performance.now();
    let extraction;
    try {
      extraction = await extractor(intakeWithOcr);
    } catch (err) {
      const latencyMs = Math.round(performance.now() - wallStart);
      results.push({
        imageId: image.id,
        filename,
        expectedRecommendation: image.expectedRecommendation,
        verdict: null,
        status: 'error',
        latencyMs,
        ocrDurationMs: ocrMs,
        inferenceDurationMs: Math.round(performance.now() - inferStart),
        ocrTextLength: ocrText.length,
        extractedBrand: null,
        extractedClassType: null,
        extractedAlcoholContent: null,
        extractedNetContents: null,
        extractedWarningLength: 0,
        errorMessage: `extractor failed: ${(err as Error).message}`,
        fieldChecks: {},
        warningStatus: null
      });
      continue;
    }
    const inferMs = Math.round(performance.now() - inferStart);

    // Build full report so we get real verdict status.
    const warningCheck = buildGovernmentWarningCheck(extraction);
    let report: VerificationReport;
    try {
      report = await buildVerificationReport({
        intake: intakeWithOcr,
        extraction,
        warningCheck
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - wallStart);
      results.push({
        imageId: image.id,
        filename,
        expectedRecommendation: image.expectedRecommendation,
        verdict: null,
        status: 'error',
        latencyMs,
        ocrDurationMs: ocrMs,
        inferenceDurationMs: inferMs,
        ocrTextLength: ocrText.length,
        extractedBrand: extraction.fields.brandName.value ?? null,
        extractedClassType: extraction.fields.classType.value ?? null,
        extractedAlcoholContent: extraction.fields.alcoholContent.value ?? null,
        extractedNetContents: extraction.fields.netContents.value ?? null,
        extractedWarningLength: extraction.fields.governmentWarning.value?.length ?? 0,
        errorMessage: `report build failed: ${(err as Error).message}`,
        fieldChecks: {},
        warningStatus: null
      });
      continue;
    }

    const latencyMs = Math.round(performance.now() - wallStart);

    // Map report verdict to pass/review/fail status like the batch export does.
    const rowStatus: 'pass' | 'review' | 'fail' = (() => {
      if (report.verdict === 'approve') return 'pass';
      if (report.verdict === 'reject') return 'fail';
      return 'review';
    })();

    const fieldChecks: Record<string, { status: string; summary: string } | null> = {};
    for (const id of ['brand-name', 'class-type', 'alcohol-content', 'net-contents']) {
      const c =
        report.checks.find((x) => x.id === id) ??
        report.crossFieldChecks.find((x) => x.id === id) ??
        null;
      fieldChecks[id] = c ? { status: c.status, summary: c.summary } : null;
    }
    const warnCheck = report.checks.find((x) => x.id === 'government-warning') ?? null;

    results.push({
      imageId: image.id,
      filename,
      expectedRecommendation: image.expectedRecommendation,
      verdict: report.verdict,
      status: rowStatus,
      latencyMs,
      ocrDurationMs: ocrMs,
      inferenceDurationMs: inferMs,
      ocrTextLength: ocrText.length,
      extractedBrand: extraction.fields.brandName.value ?? null,
      extractedClassType: extraction.fields.classType.value ?? null,
      extractedAlcoholContent: extraction.fields.alcoholContent.value ?? null,
      extractedNetContents: extraction.fields.netContents.value ?? null,
      extractedWarningLength: extraction.fields.governmentWarning.value?.length ?? 0,
      errorMessage: null,
      fieldChecks,
      warningStatus: warnCheck?.status ?? null
    });

    console.log(
      `  → status=${rowStatus} verdict=${report.verdict} ocr=${ocrMs}ms infer=${inferMs}ms total=${latencyMs}ms`
    );
  }

  // Aggregate.
  const summary = {
    pass: results.filter((r) => r.status === 'pass').length,
    review: results.filter((r) => r.status === 'review').length,
    fail: results.filter((r) => r.status === 'fail').length,
    error: results.filter((r) => r.status === 'error').length
  };
  const latencies = results
    .filter((r) => r.latencyMs > 0)
    .map((r) => r.latencyMs)
    .sort((a, b) => a - b);
  const inferenceLatencies = results
    .filter((r) => r.inferenceDurationMs > 0)
    .map((r) => r.inferenceDurationMs)
    .sort((a, b) => a - b);
  const ocrLatencies = results
    .filter((r) => r.ocrDurationMs > 0)
    .map((r) => r.ocrDurationMs)
    .sort((a, b) => a - b);

  const pct = (arr: number[], p: number) =>
    arr.length === 0 ? 0 : arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  const latency = {
    count: latencies.length,
    avg: avg(latencies),
    min: latencies[0] ?? 0,
    p50: pct(latencies, 0.5),
    p95: pct(latencies, 0.95),
    max: latencies[latencies.length - 1] ?? 0,
    ocrAvg: avg(ocrLatencies),
    ocrP95: pct(ocrLatencies, 0.95),
    inferenceAvg: avg(inferenceLatencies),
    inferenceP50: pct(inferenceLatencies, 0.5),
    inferenceP95: pct(inferenceLatencies, 0.95),
    inferenceMax: inferenceLatencies[inferenceLatencies.length - 1] ?? 0
  };

  const output = {
    generatedAt: new Date().toISOString(),
    pipeline: 'local-llm',
    model: 'qwen2.5-1.5b-instruct-q4_k_m',
    modelPath: configResult.value.modelPath,
    fixture: 'cola-cloud-all',
    modelWarmupMs: loadMs,
    summary,
    latency,
    results
  };

  const outDir = path.join(repoRoot, 'evals/results');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, '2026-04-16-local-llm-poc.json');
  await writeFile(outPath, JSON.stringify(output, null, 2) + '\n');

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('LOCAL LLM PIPELINE RESULTS (cola-cloud-all, 28 labels)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Model:', output.model);
  console.log('Model warmup:', output.modelWarmupMs, 'ms');
  console.log('Verdicts:', summary);
  console.log('');
  console.log('Latency (per label, ms):');
  console.log(`  total    avg=${latency.avg} p50=${latency.p50} p95=${latency.p95} max=${latency.max}`);
  console.log(`  ocr      avg=${latency.ocrAvg} p95=${latency.ocrP95}`);
  console.log(`  infer    avg=${latency.inferenceAvg} p50=${latency.inferenceP50} p95=${latency.inferenceP95} max=${latency.inferenceMax}`);
  console.log('');
  console.log(`Wrote ${outPath}`);

  await disposeLocalLlmCache();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
