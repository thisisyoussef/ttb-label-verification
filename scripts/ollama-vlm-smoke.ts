/**
 * Quick smoke test for the Ollama VLM extractor.
 *
 * Reads a single label image, runs the Ollama VLM extractor, and prints the
 * structured ReviewExtraction.
 *
 * Usage:
 *   OLLAMA_VISION_MODEL=qwen2.5vl:3b npx tsx scripts/ollama-vlm-smoke.ts [path/to/image]
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createOllamaVlmReviewExtractor,
  readOllamaVlmReviewExtractionConfig
} from '../src/server/ollama-vlm-review-extractor';
import { createNormalizedReviewIntake } from '../src/server/review-intake';

async function main() {
  const repoRoot = process.cwd();
  const labelPath =
    process.argv[2] ??
    path.join(
      repoRoot,
      'evals/labels/assets/cola-cloud/1840-original-lager-1840-original-lager-malt-beverage.webp'
    );

  const env = { ...process.env, OLLAMA_VLM_ENABLED: 'true' };
  const configResult = readOllamaVlmReviewExtractionConfig(env);
  if (!configResult.success) {
    console.error('Config error:', configResult.error.message);
    process.exit(1);
  }

  const extractor = createOllamaVlmReviewExtractor({
    config: configResult.value
  });

  const buffer = await readFile(labelPath);
  const mimeType = labelPath.endsWith('.webp')
    ? 'image/webp'
    : labelPath.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';

  const intake = createNormalizedReviewIntake({
    file: {
      buffer,
      mimetype: mimeType,
      originalname: path.basename(labelPath),
      size: buffer.byteLength
    } as unknown as Express.Multer.File,
    fields: {
      fields: {
        beverageTypeHint: 'auto',
        origin: 'unknown',
        brandName: '1840 Original',
        fancifulName: '1840 Original Lager',
        classType: 'lager',
        alcoholContent: '4.9% Alc./Vol.',
        netContents: '12 fl oz',
        varietals: []
      } as any,
      hasApplicationData: true
    }
  });

  console.log(`[smoke] Model: ${configResult.value.visionModel}`);
  console.log(`[smoke] Host: ${configResult.value.host}`);
  console.log(`[smoke] Image: ${labelPath} (${buffer.byteLength} bytes)`);
  console.log('[smoke] Calling VLM...');
  const t0 = performance.now();
  const extraction = await extractor(intake);
  const ms = Math.round(performance.now() - t0);
  console.log(`[smoke] Extraction completed in ${ms}ms`);
  console.log('=== FIELDS ===');
  for (const [k, v] of Object.entries(extraction.fields)) {
    if (Array.isArray(v)) continue;
    console.log(
      `  ${k.padEnd(20)} present=${(v as any).present} value=${JSON.stringify((v as any).value)} conf=${(v as any).confidence}`
    );
  }
  console.log('=== QUALITY ===');
  console.log(`  score=${extraction.imageQuality.score}`);
  console.log(`  noTextDetected=${extraction.imageQuality.noTextDetected}`);
  console.log(`  summary=${extraction.summary}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
