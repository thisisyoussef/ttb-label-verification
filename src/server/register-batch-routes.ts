import express from 'express';

import { batchStartRequestSchema } from '../shared/contracts/review';
import { BatchSessionStore } from './batch-session';
import {
  handleBatchUpload,
  sendBatchError,
  sendReviewError
} from './request-handlers';
import {
  readProviderOverrideHeader,
  type ExtractorResolver,
  type ResolvedExtractor
} from './review-route-support';
import { logServerEvent } from './server-events';

function setNoStore(response: express.Response) {
  response.setHeader('cache-control', 'no-store');
}

function resolveForBatchRequest(input: {
  request: express.Request;
  defaultResolution: ResolvedExtractor;
  extractorResolver?: ExtractorResolver;
}): ResolvedExtractor {
  const override = readProviderOverrideHeader(input.request);
  if (!override || !input.extractorResolver) {
    return input.defaultResolution;
  }
  const overridden = input.extractorResolver(override);
  if (!overridden.extractor) {
    logServerEvent('batch.provider-override.unavailable', {
      requestedMode: override,
      reason: overridden.error?.kind ?? 'unknown'
    });
    return input.defaultResolution;
  }
  logServerEvent('batch.provider-override.applied', {
    requestedMode: override,
    resolvedMode: overridden.extractionMode,
    providers: overridden.providers
  });
  return overridden;
}

export function registerBatchRoutes(input: {
  app: express.Express;
  batchSessions: BatchSessionStore;
  extractorResolution: ResolvedExtractor;
  extractorResolver?: ExtractorResolver;
}) {
  const { app, batchSessions, extractorResolution, extractorResolver } = input;

  app.post('/api/batch/preflight', (request, response) => {
    handleBatchUpload(request, response, async ({ manifest, imageFiles, csvFile }) => {
      const preflight = batchSessions.createPreflight({
        manifest,
        imageFiles,
        csvFile
      });

      setNoStore(response);
      response.json(preflight);
    });
  });

  app.post('/api/batch/run', async (request, response) => {
    const resolution = resolveForBatchRequest({
      request,
      defaultResolution: extractorResolution,
      extractorResolver
    });
    if (!resolution.extractor) {
      sendReviewError(response, resolution.status, resolution.error);
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
    setNoStore(response);

    try {
      await batchSessions.run(
        payload.data,
        async (frame) => {
          response.write(`${JSON.stringify(frame)}\n`);
        },
        {
          extractor: resolution.extractor,
          extractionMode: resolution.extractionMode,
          providers: resolution.providers
        }
      );
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
      setNoStore(response);
      response.status(202).json({ status: 'cancelling' });
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/summary', (request, response) => {
    try {
      setNoStore(response);
      response.json(batchSessions.getSummary(request.params.batchSessionId));
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/report/:reportId', (request, response) => {
    try {
      setNoStore(response);
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
      setNoStore(response);
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
    const resolution = resolveForBatchRequest({
      request,
      defaultResolution: extractorResolution,
      extractorResolver
    });
    if (!resolution.extractor) {
      sendReviewError(response, resolution.status, resolution.error);
      return;
    }

    try {
      setNoStore(response);
      response.json(
        await batchSessions.retry(
          request.params.batchSessionId,
          request.params.imageId,
          {
            extractor: resolution.extractor,
            extractionMode: resolution.extractionMode,
            providers: resolution.providers
          }
        )
      );
    } catch (error) {
      sendBatchError(response, error);
    }
  });
}
