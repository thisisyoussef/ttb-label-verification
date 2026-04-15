import { loadLocalEnv } from './load-local-env';

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { BatchSessionStore } from './batch-session';
import {
  DEFAULT_EXTRACTION_MODE,
  type ExtractionMode
} from './ai-provider-policy';
import {
  createConfiguredReviewExtractor,
  type ReviewExtractorProviderFactories
} from './review-extractor-factory';
import { type ReviewExtractor } from './review-extraction';
import { registerAppRoutes } from './register-app-routes';
import { type ResolvedExtractor } from './register-review-routes';
import {
  createConsoleReviewLatencyObserver,
  mergeReviewLatencyObservers,
  type ReviewLatencyObserver
} from './review-latency';

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
};

export function createApp(options: CreateAppOptions = {}) {
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
  const batchSessions = new BatchSessionStore({
    extractor:
      extractorResolution.extractor ??
      (async () => {
        throw new Error('Extractor unavailable.');
      }),
    extractionMode: extractorResolution.extractionMode,
    providers: extractorResolution.providers,
    latencyObserver
  });

  app.use(express.json({ limit: '1mb' }));
  registerAppRoutes({
    app,
    batchSessions,
    extractorResolution,
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

  app.listen(port, () => {
    console.log(`TTB label verification API listening on http://localhost:${port}`);
  });
}

function resolveExtractor(options: CreateAppOptions): ResolvedExtractor {
  if (options.extractor) {
    return {
      extractor: options.extractor,
      extractionMode: options.extractionMode ?? DEFAULT_EXTRACTION_MODE,
      providers: []
    };
  }

  const resolution = createConfiguredReviewExtractor({
    env: process.env,
    requestedMode: options.extractionMode,
    providers: options.providerFactories,
    maxRetryableFallbackElapsedMs: options.maxRetryableFallbackElapsedMs
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
