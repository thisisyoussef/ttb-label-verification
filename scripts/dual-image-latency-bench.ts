/**
 * Local benchmark: single vs dual image cost for the server-side prep work
 * (everything the review pipeline does before the VLM network call).
 *
 * Measures four stages in isolation so we can attribute any TTB-304
 * regression without needing a live Gemini/OpenAI key:
 *
 *   1. base64 encode (runs once per extraction in the request-assembly span)
 *   2. buildGeminiReviewExtractionRequest (request-assembly for Gemini)
 *   3. buildReviewExtractionRequest (request-assembly for OpenAI)
 *   4. convertPdfLabelToImage (parallel PDF conversion)
 *
 * Each stage is run N times for single-image and dual-image inputs and
 * reported as mean / p95 ms.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildGeminiReviewExtractionRequest } from '../src/server/gemini-review-extractor.js';
import { buildReviewExtractionRequest } from '../src/server/openai-review-extractor.js';
import { convertPdfLabelToImage } from '../src/server/pdf-label-converter.js';
import type { NormalizedReviewIntake, NormalizedUploadedLabel } from '../src/server/review-intake.js';

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 25);
const ROOT = process.cwd();

const IMAGE_A = path.join(ROOT, 'evals/labels/assets/cola-cloud/1840-original-lager-1840-original-lager-malt-beverage.webp');
const IMAGE_B = path.join(ROOT, 'evals/labels/assets/cola-cloud/ana-luisa-gran-reserva-parcelas-blend-wine.webp');
const PDF_A = path.join(ROOT, 'evals/labels/assets/cola-cloud-pdf/1840-original-lager-1840-original-lager-malt-beverage.pdf');
const PDF_B = path.join(ROOT, 'evals/labels/assets/cola-cloud-pdf/ana-luisa-gran-reserva-parcelas-blend-wine.pdf');

function loadLabel(filePath: string, mimeType: string): NormalizedUploadedLabel {
  const buffer = readFileSync(filePath);
  return {
    originalName: path.basename(filePath),
    mimeType,
    bytes: buffer.length,
    buffer
  };
}

function buildIntake(labels: NormalizedUploadedLabel[]): NormalizedReviewIntake {
  return {
    label: labels[0]!,
    labels,
    fields: {
      beverageTypeHint: 'auto',
      origin: 'domestic',
      varietals: []
    },
    hasApplicationData: false,
    standalone: true
  };
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
  const p95 = sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] ?? 0;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  return { mean, p95, min, max };
}

function fmt(value: number) {
  return value.toFixed(2).padStart(7);
}

function printRow(label: string, single: number[], dual: number[]) {
  const s = stats(single);
  const d = stats(dual);
  const delta = d.mean - s.mean;
  const pct = (delta / s.mean) * 100;
  console.log(
    `  ${label.padEnd(34)}  single: mean=${fmt(s.mean)}ms p95=${fmt(s.p95)}ms    dual: mean=${fmt(d.mean)}ms p95=${fmt(d.p95)}ms    Δmean=${fmt(delta)}ms (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`
  );
}

async function time<T>(fn: () => Promise<T> | T): Promise<number> {
  const started = performance.now();
  await fn();
  return performance.now() - started;
}

async function runBench() {
  const labelA = loadLabel(IMAGE_A, 'image/webp');
  const labelB = loadLabel(IMAGE_B, 'image/webp');
  const pdfA = loadLabel(PDF_A, 'application/pdf');
  const pdfB = loadLabel(PDF_B, 'application/pdf');

  const singleIntake = buildIntake([labelA]);
  const dualIntake = buildIntake([labelA, labelB]);

  const singlePdfIntake = buildIntake([pdfA]);
  const dualPdfIntake = buildIntake([pdfA, pdfB]);

  const geminiConfig = {
    apiKey: 'bench',
    visionModel: 'gemini-2.5-flash-lite',
    timeoutMs: 5000
  };
  const openaiConfig = {
    apiKey: 'bench',
    visionModel: 'gpt-4o-mini',
    store: false as const,
    imageDetail: 'auto' as const
  };

  console.log(`\nDual-image latency benchmark — ${ITERATIONS} iterations per stage\n`);
  console.log(
    `  image A: ${labelA.bytes.toLocaleString()} bytes    image B: ${labelB.bytes.toLocaleString()} bytes`
  );
  console.log(
    `  pdf A:   ${pdfA.bytes.toLocaleString()} bytes    pdf B:   ${pdfB.bytes.toLocaleString()} bytes`
  );

  // Warmup — JIT + node module cache.
  for (let i = 0; i < 3; i++) {
    buildGeminiReviewExtractionRequest({ intake: singleIntake, config: geminiConfig });
    buildGeminiReviewExtractionRequest({ intake: dualIntake, config: geminiConfig });
    buildReviewExtractionRequest({ intake: singleIntake, config: openaiConfig });
    buildReviewExtractionRequest({ intake: dualIntake, config: openaiConfig });
  }

  console.log('\n[1] Gemini request assembly (base64 + prompt + schema):');
  const geminiSingle: number[] = [];
  const geminiDual: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    geminiSingle.push(
      await time(() =>
        buildGeminiReviewExtractionRequest({ intake: singleIntake, config: geminiConfig })
      )
    );
    geminiDual.push(
      await time(() =>
        buildGeminiReviewExtractionRequest({ intake: dualIntake, config: geminiConfig })
      )
    );
  }
  printRow('buildGeminiReviewExtraction', geminiSingle, geminiDual);

  console.log('\n[2] OpenAI request assembly (base64 + prompt + schema):');
  const openaiSingle: number[] = [];
  const openaiDual: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    openaiSingle.push(
      await time(() =>
        buildReviewExtractionRequest({ intake: singleIntake, config: openaiConfig })
      )
    );
    openaiDual.push(
      await time(() =>
        buildReviewExtractionRequest({ intake: dualIntake, config: openaiConfig })
      )
    );
  }
  printRow('buildReviewExtractionRequest', openaiSingle, openaiDual);

  console.log('\n[3] Raw base64 encode (Buffer.toString):');
  const b64Single: number[] = [];
  const b64Dual: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    b64Single.push(await time(() => labelA.buffer.toString('base64')));
    b64Dual.push(
      await time(() => {
        labelA.buffer.toString('base64');
        labelB.buffer.toString('base64');
      })
    );
  }
  printRow('Buffer.toString("base64")', b64Single, b64Dual);

  console.log('\n[4] PDF conversion (Promise.all parallel path):');
  const pdfSingle: number[] = [];
  const pdfDual: number[] = [];
  for (let i = 0; i < Math.min(ITERATIONS, 6); i++) {
    pdfSingle.push(
      await time(() => Promise.all(singlePdfIntake.labels.map(convertPdfLabelToImage)))
    );
    pdfDual.push(
      await time(() => Promise.all(dualPdfIntake.labels.map(convertPdfLabelToImage)))
    );
  }
  printRow('convertPdfLabelToImage(Promise.all)', pdfSingle, pdfDual);

  // Simulated sequential PDF conversion for comparison — what the pre-TTB-304
  // single-image flow effectively did (one PDF, no concurrency).
  console.log('\n[5] PDF conversion sequential (hypothetical, for reference):');
  const pdfSeqSingle: number[] = [];
  const pdfSeqDual: number[] = [];
  for (let i = 0; i < Math.min(ITERATIONS, 6); i++) {
    pdfSeqSingle.push(
      await time(async () => {
        for (const label of singlePdfIntake.labels) await convertPdfLabelToImage(label);
      })
    );
    pdfSeqDual.push(
      await time(async () => {
        for (const label of dualPdfIntake.labels) await convertPdfLabelToImage(label);
      })
    );
  }
  printRow('convertPdfLabelToImage(sequential)', pdfSeqSingle, pdfSeqDual);

  console.log('\nNote: Provider-wait (actual Gemini/OpenAI inference) is NOT');
  console.log('measured here — it requires a live API key. Request-assembly');
  console.log('is typically <5 ms so the dominant regression on 2-image');
  console.log('review is the provider-side token cost, not the code path.\n');
}

runBench().catch((err) => {
  console.error(err);
  process.exit(1);
});
