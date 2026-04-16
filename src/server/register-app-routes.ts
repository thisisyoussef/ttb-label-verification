import express from 'express';

import { helpManifestSchema } from '../shared/contracts/help';
import {
  getSeedVerificationReport,
  healthResponseSchema
} from '../shared/contracts/review';
import { LOCAL_HELP_MANIFEST } from '../shared/help-fixture';
import { BatchSessionStore } from './batch-session';
import { registerBatchRoutes } from './register-batch-routes';
import { registerEvalRoutes } from './register-eval-routes';
import {
  registerReviewRoutes,
  type ExtractorResolver,
  type ResolvedExtractor
} from './register-review-routes';
import { type ReviewLatencyObserver } from './review-latency';

interface RegisterAppRoutesInput {
  app: express.Express;
  batchSessions: BatchSessionStore;
  extractorResolution: ResolvedExtractor;
  extractorResolver?: ExtractorResolver;
  latencyObserver?: ReviewLatencyObserver;
}

export function registerAppRoutes({
  app,
  batchSessions,
  extractorResolution,
  extractorResolver,
  latencyObserver
}: RegisterAppRoutesInput) {
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

  registerReviewRoutes({
    app,
    extractorResolution,
    extractorResolver,
    latencyObserver
  });
  registerBatchRoutes({
    app,
    batchSessions,
    extractorResolution,
    extractorResolver
  });
  registerEvalRoutes(app);
}
