import { loadLocalEnv } from './load-local-env';

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { helpManifestSchema } from '../shared/contracts/help';
import {
  batchStartRequestSchema,
  checkReviewSchema,
  reviewExtractionSchema,
  type ReviewError,
  getSeedVerificationReport,
  healthResponseSchema
} from '../shared/contracts/review';
import { LOCAL_HELP_MANIFEST } from '../shared/help-fixture';
import { BatchSessionStore } from './batch-session';
import {
  DEFAULT_EXTRACTION_MODE,
  type AiProvider,
  type ExtractionMode
} from './ai-provider-policy';
import {
  runTracedExtractionSurface,
  runTracedReviewSurface,
  runTracedWarningSurface
} from './llm-trace';
import {
  createConfiguredReviewExtractor,
  type ReviewExtractorProviderFactories
} from './review-extractor-factory';
import { type ReviewExtractor } from './review-extraction';
import {
  handleBatchUpload,
  prepareReviewUpload,
  respondToReviewExecutionError,
  sendBatchError,
  sendReviewError,
  type PreparedReviewUpload
} from './request-handlers';
import {
  createConsoleReviewLatencyObserver,
  createReviewLatencyCapture,
  emitReviewLatencySummary,
  mergeReviewLatencyObservers,
  type ReviewLatencyCapture,
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

function readClientTraceId(request: express.Request) {
  const raw = request.header('x-review-client-id')?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

function recordPreparedReviewLatency(
  latencyCapture: ReviewLatencyCapture,
  prepared: PreparedReviewUpload
) {
  latencyCapture.recordSpan({
    stage: 'intake-parse',
    outcome: prepared.parse.outcome,
    durationMs: prepared.parse.durationMs
  });
  latencyCapture.recordSpan({
    stage: 'intake-normalization',
    outcome: prepared.normalization.outcome,
    durationMs: prepared.normalization.durationMs
  });
}

function emitPreProviderLatencySummary(input: {
  latencyCapture: ReviewLatencyCapture;
  observer?: ReviewLatencyObserver;
  providers: AiProvider[];
}) {
  input.latencyCapture.setProviderOrder(input.providers);
  input.latencyCapture.recordSpan({
    stage: 'provider-selection',
    outcome: 'skipped',
    durationMs: 0
  });
  input.latencyCapture.setOutcomePath('pre-provider-failure');
  emitReviewLatencySummary(input.latencyCapture, input.observer);
}

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

  app.get('/api/health', (_request, response) => {
    response.json(
      healthResponseSchema.parse({
        status: 'ok',
        service: 'ttb-label-verification',
        mode: 'scaffold',
        responsesApi: true,
        store: false,
        timestamp: new Date().toISOString()
      })
    );
  });

  app.get('/api/review/seed', (_request, response) => {
    response.json(getSeedVerificationReport());
  });

  app.get('/api/help/manifest', (_request, response) => {
    response.setHeader('cache-control', 'public, max-age=300');
    response.json(helpManifestSchema.parse(LOCAL_HELP_MANIFEST));
  });

  async function handleSingleLabelRoute<T>(
    surface: '/api/review' | '/api/review/extraction' | '/api/review/warning',
    request: express.Request,
    response: express.Response,
    runner: (input: {
      intake: Parameters<NonNullable<typeof extractorResolution.extractor>>[0];
      clientTraceId?: string;
      latencyCapture: ReviewLatencyCapture;
    }) => Promise<T>
  ) {
    const clientTraceId = readClientTraceId(request);
    const latencyCapture = createReviewLatencyCapture({
      surface,
      clientTraceId
    });
    const prepared = await prepareReviewUpload(request, response);
    recordPreparedReviewLatency(latencyCapture, prepared);

    if (!prepared.success) {
      emitPreProviderLatencySummary({
        latencyCapture,
        observer: latencyObserver,
        providers: extractorResolution.providers
      });
      return;
    }

    if (!extractorResolution.extractor) {
      emitPreProviderLatencySummary({
        latencyCapture,
        observer: latencyObserver,
        providers: extractorResolution.providers
      });
      sendReviewError(
        response,
        extractorResolution.status,
        extractorResolution.error
      );
      return;
    }

    try {
      response.json(
        await runner({
          intake: prepared.intake,
          clientTraceId,
          latencyCapture
        })
      );
    } catch (error) {
      respondToReviewExecutionError(error, response);
    }
  }

  app.post('/api/review', (request, response) => {
    void handleSingleLabelRoute('/api/review', request, response, async ({
      intake,
      clientTraceId,
      latencyCapture
    }) =>
      await runTracedReviewSurface({
        surface: '/api/review',
        extractionMode: extractorResolution.extractionMode,
        provider: extractorResolution.providers.join(',') || undefined,
        clientTraceId,
        intake,
        extractor: extractorResolution.extractor as ReviewExtractor,
        latencyCapture,
        latencyObserver
      })
    );
  });

  app.post('/api/review/extraction', (request, response) => {
    void handleSingleLabelRoute(
      '/api/review/extraction',
      request,
      response,
      async ({ intake, clientTraceId, latencyCapture }) => {
        const extraction = await runTracedExtractionSurface({
          surface: '/api/review/extraction',
          extractionMode: extractorResolution.extractionMode,
          provider: extractorResolution.providers.join(',') || undefined,
          clientTraceId,
          intake,
          extractor: extractorResolution.extractor as ReviewExtractor,
          latencyCapture,
          latencyObserver
        });
        return reviewExtractionSchema.parse(extraction);
      }
    );
  });

  app.post('/api/review/warning', (request, response) => {
    void handleSingleLabelRoute(
      '/api/review/warning',
      request,
      response,
      async ({ intake, clientTraceId, latencyCapture }) => {
        const warningCheck = await runTracedWarningSurface({
          surface: '/api/review/warning',
          extractionMode: extractorResolution.extractionMode,
          provider: extractorResolution.providers.join(',') || undefined,
          clientTraceId,
          intake,
          extractor: extractorResolution.extractor as ReviewExtractor,
          latencyCapture,
          latencyObserver
        });
        return checkReviewSchema.parse(warningCheck);
      }
    );
  });

  app.post('/api/batch/preflight', (request, response) => {
    handleBatchUpload(request, response, async ({ manifest, imageFiles, csvFile }) => {
      const preflight = batchSessions.createPreflight({
        manifest,
        imageFiles,
        csvFile
      });

      response.json(preflight);
    });
  });

  app.post('/api/batch/run', async (request, response) => {
    if (!extractorResolution.extractor) {
      sendReviewError(response, extractorResolution.status, extractorResolution.error);
      return;
    }

    const payload = batchStartRequestSchema.safeParse(request.body);
    if (!payload.success) {
      sendReviewError(response, 400, {
        kind: 'validation',
        message: 'We could not read this batch request.',
        retryable: false
      });
      return;
    }

    response.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('cache-control', 'no-store');

    try {
      await batchSessions.run(payload.data, async (frame) => {
        response.write(`${JSON.stringify(frame)}\n`);
      });
      response.end();
    } catch (error) {
      if (response.headersSent) {
        response.end();
        return;
      }

      sendBatchError(response, error);
    }
  });

  app.post('/api/batch/:batchSessionId/cancel', (request, response) => {
    try {
      batchSessions.cancel(request.params.batchSessionId);
      response.status(202).json({ status: 'cancelling' });
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/summary', (request, response) => {
    try {
      response.json(batchSessions.getSummary(request.params.batchSessionId));
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/report/:reportId', (request, response) => {
    try {
      response.json(
        batchSessions.getReport(
          request.params.batchSessionId,
          request.params.reportId
        )
      );
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/export', (request, response) => {
    try {
      response.setHeader(
        'content-disposition',
        `attachment; filename="ttb-batch-${request.params.batchSessionId}.json"`
      );
      response.json(batchSessions.getExport(request.params.batchSessionId));
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.post('/api/batch/:batchSessionId/retry/:imageId', async (request, response) => {
    if (!extractorResolution.extractor) {
      sendReviewError(response, extractorResolution.status, extractorResolution.error);
      return;
    }

    try {
      response.json(
        await batchSessions.retry(
          request.params.batchSessionId,
          request.params.imageId
        )
      );
    } catch (error) {
      sendBatchError(response, error);
    }
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

function resolveExtractor(options: CreateAppOptions):
  | {
      extractor: ReviewExtractor;
      extractionMode: ExtractionMode;
      providers: AiProvider[];
    }
  | {
      extractor?: undefined;
      extractionMode: ExtractionMode;
      status: number;
      error: ReviewError;
      providers: AiProvider[];
    } {
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
