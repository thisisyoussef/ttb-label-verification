import { loadLocalEnv } from './load-local-env';

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { BatchSessionStore } from './batch/batch-session';
import {
  DEFAULT_EXTRACTION_MODE,
  type ExtractionMode
} from './llm/ai-provider-policy';
import { runBootWarmup } from './boot-warmup';
import {
  createConfiguredReviewExtractor,
  type ReviewExtractorProviderFactories
} from './extractors/review-extractor-factory';
import { type ReviewExtractor } from './extractors/review-extraction';
import { registerAppRoutes } from './routes/register-app-routes';
import {
  type ExtractorResolver,
  type ResolvedExtractor
} from './routes/review-route-support';
import {
  createConsoleReviewLatencyObserver,
  mergeReviewLatencyObservers,
  type ReviewLatencyObserver
} from './review/review-latency';

if (process.env.NODE_ENV !== 'test') {
  loadLocalEnv();
}

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const defaultClientDistDir = path.resolve(serverDir, '../../dist');

type CreateAppOptions = {
  clientDistDir?: string;
  extractor?: ReviewExtractor;
  extractionMode?: ExtractionMode;
  providerFactories?: ReviewExtractorProviderFactories;
  maxRetryableFallbackElapsedMs?: number;
  latencyObserver?: ReviewLatencyObserver;
  enableCrossModeFallback?: boolean;
};

// Module-level cache so repeated createApp() calls in the same process
// (e.g. the eval runner spinning up in-process) only warm once.
let bootWarmupPromise: Promise<void> | null = null;

function kickOffBootWarmup() {
  if (bootWarmupPromise) return bootWarmupPromise;
  if (process.env.TTB_BOOT_WARMUP?.trim().toLowerCase() === 'disabled') {
    bootWarmupPromise = Promise.resolve();
    return bootWarmupPromise;
  }
  bootWarmupPromise = runBootWarmup()
    .then((result) => {
      // Keep the log single-line so it is easy to grep in eval output.
      // eslint-disable-next-line no-console
      console.info(
        `[boot-warmup] tesseract=${result.tesseract.ok ? `ok ${result.tesseract.durationMs}ms` : 'skipped'} ` +
          `sharp=${result.sharp.ok ? `ok ${result.sharp.durationMs}ms` : 'skipped'} ` +
          `ocr=${result.ocrPipeline.ok ? `ok ${result.ocrPipeline.durationMs}ms` : 'skipped'} ` +
          `ollama-vlm=${result.ollamaVlm.ok ? `ok ${result.ollamaVlm.durationMs}ms` : `skip(${result.ollamaVlm.note ?? '?'})`} ` +
          `ollama-judge=${result.ollamaJudgment.ok ? `ok ${result.ollamaJudgment.durationMs}ms` : `skip(${result.ollamaJudgment.note ?? '?'})`} ` +
          `total=${result.totalDurationMs}ms`
      );
    })
    .catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(`[boot-warmup] failed: ${(error as Error).message}`);
    });
  return bootWarmupPromise;
}

export function createApp(options: CreateAppOptions = {}) {
  // Fire-and-forget — we do not block createApp on warmup because tests
  // should not pay a 500ms+ cost. In the eval runner the warmup finishes
  // well before the first label call (batch setup takes hundreds of ms).
  kickOffBootWarmup();
  const app = express();
  const clientDistDir = options.clientDistDir ?? defaultClientDistDir;
  const latencyObserver = mergeReviewLatencyObservers(
    options.latencyObserver,
    process.env.TTB_DEBUG_LATENCY === '1'
      ? createConsoleReviewLatencyObserver()
      : undefined
  );
  const clientIndexPath = path.join(clientDistDir, 'index.html');
  const hasBuiltClient = existsSync(clientIndexPath);
  const extractorResolution = resolveExtractor(options);
  const extractorResolver = createExtractorResolver({
    options,
    defaultResolution: extractorResolution
  });
  const batchSessions = new BatchSessionStore({
    extractor:
      extractorResolution.extractor ??
      (async () => {
        throw new Error('Extractor unavailable.');
      }),
    extractionMode: extractorResolution.extractionMode,
    providers: extractorResolution.providers,
    latencyObserver,
    extractorResolver
  });

  app.use(express.json({ limit: '1mb' }));
  registerAppRoutes({
    app,
    batchSessions,
    extractorResolution,
    extractorResolver,
    latencyObserver
  });

  if (hasBuiltClient) {
    app.use(
      express.static(clientDistDir, {
        index: false
      })
    );

    app.get('*', (request, response, next) => {
      if (request.path.startsWith('/api/')) {
        next();
        return;
      }

      response.sendFile(clientIndexPath);
    });
  }

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  const port = Number(process.env.PORT ?? 8787);

  // createApp already kicked off warmup; wait for it before accepting traffic
  // so the first inbound label never pays the cold-start penalty. If warmup
  // is disabled the promise resolves immediately.
  (bootWarmupPromise ?? Promise.resolve()).finally(() => {
    app.listen(port, () => {
      console.log(`TTB label verification API listening on http://localhost:${port}`);
    });
  });
}

function resolveExtractor(
  options: CreateAppOptions,
  requestedMode?: ExtractionMode
): ResolvedExtractor {
  if (options.extractor) {
    return {
      extractor: options.extractor,
      extractionMode: requestedMode ?? options.extractionMode ?? DEFAULT_EXTRACTION_MODE,
      providers: []
    };
  }

  const resolution = createConfiguredReviewExtractor({
    env: process.env,
    requestedMode: requestedMode ?? options.extractionMode,
    providers: options.providerFactories,
    maxRetryableFallbackElapsedMs: options.maxRetryableFallbackElapsedMs,
    enableCrossModeFallback: options.enableCrossModeFallback ?? true
  });
  if (!resolution.success) {
    return {
      extractor: undefined,
      extractionMode: resolution.extractionMode ?? DEFAULT_EXTRACTION_MODE,
      status: resolution.status,
      error: resolution.error,
      providers: []
    };
  }

  return {
    extractor: resolution.value.extractor,
    extractionMode: resolution.value.extractionMode,
    providers: resolution.value.providers
  };
}

function createExtractorResolver(input: {
  options: CreateAppOptions;
  defaultResolution: ResolvedExtractor;
}): ExtractorResolver {
  const cache = new Map<ExtractionMode | 'default', ResolvedExtractor>();
  cache.set('default', input.defaultResolution);

  return (requestedMode) => {
    if (!requestedMode) {
      return input.defaultResolution;
    }

    const cached = cache.get(requestedMode);
    if (cached) {
      return cached;
    }

    const resolution = resolveExtractor(input.options, requestedMode);
    cache.set(requestedMode, resolution);
    return resolution;
  };
}
