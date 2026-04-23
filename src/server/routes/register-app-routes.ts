import express from 'express';

import { helpManifestSchema } from '../../shared/contracts/help';
import {
  getSeedVerificationReport,
  healthResponseSchema
} from '../../shared/contracts/review';
import { LOCAL_HELP_MANIFEST } from '../../shared/help-fixture';
import { BatchSessionStore } from '../batch/batch-session';
import { registerBatchRoutes } from './register-batch-routes';
import { registerEvalRoutes } from './register-eval-routes';
import {
  type ExtractorResolver,
  type ResolvedExtractor
} from './review-route-support';
import {
  registerReviewRoutes
} from './register-review-routes';
import { type ReviewLatencyObserver } from '../review/review-latency';

interface RegisterAppRoutesInput {
  app: express.Express;
  batchSessions: BatchSessionStore;
  extractorResolution: ResolvedExtractor;
  extractorResolver?: ExtractorResolver;
  latencyObserver?: ReviewLatencyObserver;
  firstResultBudgetMs?: number;
}

export function registerAppRoutes({
  app,
  batchSessions,
  extractorResolution,
  extractorResolver,
  latencyObserver,
  firstResultBudgetMs
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

  /**
   * Capability probe for the client. Tells the Toolbench whether the
   * Local track (Ollama / in-process) is actually available so the
   * provider toggle can gate that option. Derived from the same env
   * vars the extractor factory reads — kept here (not hard-coded) so
   * Railway staging/production naturally report `allowLocal: false`
   * while local dev reports `true`.
   */
  app.get('/api/capabilities', (_request, response) => {
    const env = process.env;
    const allowLocalRaw = (env.AI_EXTRACTION_MODE_ALLOW_LOCAL ?? '')
      .trim()
      .toLowerCase();
    const allowLocal =
      allowLocalRaw === 'true' ||
      allowLocalRaw === '1' ||
      allowLocalRaw === 'yes' ||
      allowLocalRaw === 'on';
    const defaultMode =
      (env.AI_EXTRACTION_MODE_DEFAULT ?? '').trim().toLowerCase() === 'local'
        ? 'local'
        : 'cloud';
    response.setHeader('cache-control', 'no-store');
    response.json({
      allowLocal,
      defaultMode: allowLocal ? defaultMode : 'cloud'
    });
  });

  registerReviewRoutes({
    app,
    extractorResolution,
    extractorResolver,
    latencyObserver,
    firstResultBudgetMs
  });
  registerBatchRoutes({
    app,
    batchSessions,
    extractorResolution,
    extractorResolver
  });
  registerEvalRoutes(app);
}
