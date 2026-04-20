import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const MODEL =
  process.env.TRANSFORMERS_LOCAL_MODEL || 'HuggingFaceTB/SmolVLM-500M-Instruct';
const DTYPE = process.env.TRANSFORMERS_DTYPE || 'q4';
const CACHE_DIR = process.env.TRANSFORMERS_CACHE_DIR || '.cache/transformers';

async function cacheModel() {
  console.log(
    `[model:cache] Caching ${MODEL} (${DTYPE}) into ${CACHE_DIR}...`
  );

  const absoluteCacheDir = path.resolve(CACHE_DIR);
  if (!existsSync(absoluteCacheDir)) {
    mkdirSync(absoluteCacheDir, { recursive: true });
  }

  const transformers = await import('@huggingface/transformers');
  transformers.env.cacheDir = absoluteCacheDir;

  console.log('[model:cache] Downloading model files...');
  await (transformers.pipeline as Function)('image-text-to-text', MODEL, { dtype: DTYPE });

  console.log(`[model:cache] Model cached successfully at ${absoluteCacheDir}`);
}

cacheModel().catch((error) => {
  console.error('[model:cache] Failed to cache model:', error);
  if (process.env.TRANSFORMERS_CACHE_REQUIRED === 'true') {
    process.exit(1);
  }
  console.warn(
    '[model:cache] Continuing without local model. Local extraction will be unavailable.'
  );
});
