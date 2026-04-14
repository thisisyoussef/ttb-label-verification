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
  type ExtractionMode
} from './ai-provider-policy';
import {
  runTracedExtractionSurface,
  runTracedReviewSurface,
  runTracedWarningSurface
} from './llm-trace';
import { createConfiguredReviewExtractor } from './review-extractor-factory';
import { type ReviewExtractor } from './review-extraction';
import {
  handleBatchUpload,
  handleReviewUpload,
  sendBatchError,
  sendReviewError
} from './request-handlers';

if (process.env.NODE_ENV !== 'test') {
  loadLocalEnv();
}

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const defaultClientDistDir = path.resolve(serverDir, '../../dist');

type CreateAppOptions = {
  clientDistDir?: string;
  extractor?: ReviewExtractor;
  extractionMode?: ExtractionMode;
};

function readClientTraceId(request: express.Request) {
  const raw = request.header('x-review-client-id')?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const clientDistDir = options.clientDistDir ?? defaultClientDistDir;
  const clientIndexPath = path.join(clientDistDir, 'index.html');
  const hasBuiltClient = existsSync(clientIndexPath);
  const extractorResolution = resolveExtractor(options);
  const batchSessions = new BatchSessionStore({
    extractor:
      extractorResolution.extractor ??
      (async () => {
        throw new Error('Extractor unavailable.');
      }),
    extractionMode: extractorResolution.extractionMode
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

  app.post('/api/review', (request, response) => {
    handleReviewUpload(request, response, async (intake) => {
      if (!extractorResolution.extractor) {
        sendReviewError(
          response,
          extractorResolution.status,
          extractorResolution.error
        );
        return;
      }

      response.json(
        await runTracedReviewSurface({
          surface: '/api/review',
          extractionMode: extractorResolution.extractionMode,
          clientTraceId: readClientTraceId(request),
          intake,
          extractor: extractorResolution.extractor
        })
      );
    });
  });

  app.post('/api/review/extraction', (request, response) => {
    handleReviewUpload(request, response, async (intake) => {
      if (!extractorResolution.extractor) {
        sendReviewError(
          response,
          extractorResolution.status,
          extractorResolution.error
        );
        return;
      }

      const extraction = await runTracedExtractionSurface({
        surface: '/api/review/extraction',
        extractionMode: extractorResolution.extractionMode,
        clientTraceId: readClientTraceId(request),
        intake,
        extractor: extractorResolution.extractor
      });
      response.json(reviewExtractionSchema.parse(extraction));
    });
  });

  app.post('/api/review/warning', (request, response) => {
    handleReviewUpload(request, response, async (intake) => {
      if (!extractorResolution.extractor) {
        sendReviewError(
          response,
          extractorResolution.status,
          extractorResolution.error
        );
        return;
      }

      const warningCheck = await runTracedWarningSurface({
        surface: '/api/review/warning',
        extractionMode: extractorResolution.extractionMode,
        clientTraceId: readClientTraceId(request),
        intake,
        extractor: extractorResolution.extractor
      });
      response.json(checkReviewSchema.parse(warningCheck));
    });
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
    }
  | {
      extractor?: undefined;
      extractionMode: ExtractionMode;
      status: number;
      error: ReviewError;
    } {
  if (options.extractor) {
    return {
      extractor: options.extractor,
      extractionMode: options.extractionMode ?? DEFAULT_EXTRACTION_MODE
    };
  }

  const resolution = createConfiguredReviewExtractor({
    env: process.env,
    requestedMode: options.extractionMode
  });
  if (!resolution.success) {
    return {
      extractor: undefined,
      extractionMode: resolution.extractionMode ?? DEFAULT_EXTRACTION_MODE,
      status: resolution.status,
      error: resolution.error
    };
  }

  return {
    extractor: resolution.value.extractor,
    extractionMode: resolution.value.extractionMode
  };
}
