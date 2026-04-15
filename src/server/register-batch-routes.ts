import express from 'express';

import { batchStartRequestSchema } from '../shared/contracts/review';
import { BatchSessionStore } from './batch-session';
import {
  handleBatchUpload,
  sendBatchError,
  sendReviewError
} from './request-handlers';
import type { ResolvedExtractor } from './register-review-routes';

export function registerBatchRoutes(input: {
  app: express.Express;
  batchSessions: BatchSessionStore;
  extractorResolution: ResolvedExtractor;
}) {
  const { app, batchSessions, extractorResolution } = input;

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
}
