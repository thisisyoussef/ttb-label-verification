/**
 * Single-image smoke test for the local LLM extractor.
 * Runs on ONE image to verify the full pipeline works end-to-end.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createLocalLlmReviewExtractor,
  readLocalLlmReviewExtractionConfig
} from '../../src/server/local-llm-review-extractor';
import {
  createLocalLlmInferenceFn,
  disposeLocalLlmCache
} from '../../src/server/local-llm-inference';
import type { NormalizedReviewIntake } from '../../src/server/review-intake';
import { buildGovernmentWarningCheck } from '../../src/server/government-warning-validator';
import { buildVerificationReport } from '../../src/server/review-report';

async function main() {
  const target = path.resolve(
    process.cwd(),
    'evals/labels/assets/cola-cloud/1840-original-lager-1840-original-lager-malt-beverage.webp'
  );

  const buf = await readFile(target);
  const configResult = readLocalLlmReviewExtractionConfig(process.env);
  if (!configResult.success) {
    console.error('config failed:', configResult.error.message);
    process.exit(2);
  }
  const inferenceFn = createLocalLlmInferenceFn(configResult.value);
  const extractor = createLocalLlmReviewExtractor({
    config: configResult.value,
    inferenceFn
  });

  const label = {
    originalName: path.basename(target),
    mimeType: 'image/webp',
    bytes: buf.byteLength,
    buffer: buf
  };
  const intake: NormalizedReviewIntake = {
    label,
    labels: [label],
    fields: {
      beverageTypeHint: 'malt-beverage',
      origin: 'domestic',
      brandName: '1840 Original Lager',
      classType: 'lager',
      alcoholContent: '5% Alc./Vol.',
      netContents: '355 mL',
      varietals: []
    },
    hasApplicationData: true,
    standalone: false
  };

  const start = performance.now();
  const extraction = await extractor(intake);
  console.log('extraction completed in', Math.round(performance.now() - start), 'ms');
  console.log('brand:', extraction.fields.brandName);
  console.log('class:', extraction.fields.classType);
  console.log('alcohol:', extraction.fields.alcoholContent);
  console.log('warning:', extraction.fields.governmentWarning.value?.slice(0, 100) ?? '(none)');

  const warningCheck = buildGovernmentWarningCheck(extraction);
  const report = await buildVerificationReport({ intake, extraction, warningCheck });
  console.log('verdict:', report.verdict);
  console.log('counts:', report.counts);

  await disposeLocalLlmCache();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
