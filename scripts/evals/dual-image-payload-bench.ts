/**
 * Payload-size probe: how much heavier is a 2-image Gemini/OpenAI request
 * than a 1-image one? Visual tokens scale roughly with base64 byte count
 * (though providers apply internal tile-based quantization), so the
 * payload delta is a useful proxy for provider-wait regression on
 * multi-image review.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { buildGeminiReviewExtractionRequest } from '../../src/server/extractors/gemini-review-extractor.js';
import { buildReviewExtractionRequest } from '../../src/server/extractors/openai-review-extractor.js';
import type { NormalizedReviewIntake, NormalizedUploadedLabel } from '../../src/server/review/review-intake.js';

const ROOT = process.cwd();
const COLA_DIR = path.join(ROOT, 'evals/labels/assets/cola-cloud');

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
    fields: { beverageTypeHint: 'auto', origin: 'domestic', varietals: [] },
    hasApplicationData: false,
    standalone: true
  };
}

function approxBytes(req: unknown): number {
  return JSON.stringify(req).length;
}

const webpFiles = readdirSync(COLA_DIR)
  .filter((f) => f.endsWith('.webp'))
  .slice(0, 6)
  .map((f) => ({
    path: path.join(COLA_DIR, f),
    bytes: statSync(path.join(COLA_DIR, f)).size
  }))
  .sort((a, b) => a.bytes - b.bytes);

const geminiConfig = { apiKey: 'bench', visionModel: 'gemini-2.5-flash-lite', timeoutMs: 5000 };
const openaiConfig = {
  apiKey: 'bench',
  visionModel: 'gpt-4o-mini',
  store: false as const,
  imageDetail: 'auto' as const
};

console.log('\nPayload-size probe: 1-image vs 2-image request bodies\n');

for (let i = 0; i + 1 < webpFiles.length; i += 2) {
  const a = loadLabel(webpFiles[i]!.path, 'image/webp');
  const b = loadLabel(webpFiles[i + 1]!.path, 'image/webp');
  const single = buildIntake([a]);
  const dual = buildIntake([a, b]);

  const geminiSingle = buildGeminiReviewExtractionRequest({ intake: single, config: geminiConfig });
  const geminiDual = buildGeminiReviewExtractionRequest({ intake: dual, config: geminiConfig });
  const openaiSingle = buildReviewExtractionRequest({ intake: single, config: openaiConfig });
  const openaiDual = buildReviewExtractionRequest({ intake: dual, config: openaiConfig });

  const geminiSingleBytes = approxBytes(geminiSingle);
  const geminiDualBytes = approxBytes(geminiDual);
  const openaiSingleBytes = approxBytes(openaiSingle);
  const openaiDualBytes = approxBytes(openaiDual);

  console.log(`Pair: ${path.basename(a.originalName)} + ${path.basename(b.originalName)}`);
  console.log(
    `  raw bytes:           A=${a.bytes.toLocaleString().padStart(7)}   B=${b.bytes.toLocaleString().padStart(7)}`
  );
  console.log(
    `  Gemini body size:    single=${geminiSingleBytes.toLocaleString().padStart(8)}  dual=${geminiDualBytes.toLocaleString().padStart(8)}  Δ=+${(geminiDualBytes - geminiSingleBytes).toLocaleString()}  (${((geminiDualBytes / geminiSingleBytes - 1) * 100).toFixed(0)}% larger)`
  );
  console.log(
    `  OpenAI body size:    single=${openaiSingleBytes.toLocaleString().padStart(8)}  dual=${openaiDualBytes.toLocaleString().padStart(8)}  Δ=+${(openaiDualBytes - openaiSingleBytes).toLocaleString()}  (${((openaiDualBytes / openaiSingleBytes - 1) * 100).toFixed(0)}% larger)`
  );
  console.log();
}
