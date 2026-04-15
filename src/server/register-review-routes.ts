import express from 'express';

import {
  checkReviewSchema,
  reviewExtractionSchema,
  type ReviewError
} from '../shared/contracts/review';
import { type AiProvider, type ExtractionMode } from './ai-provider-policy';
import {
  runTracedExtractionSurface,
  runTracedReviewSurface,
  runTracedWarningSurface
} from './llm-trace';
import { type ReviewExtractor } from './review-extraction';
import {
  prepareReviewUpload,
  respondToReviewExecutionError,
  sendReviewError,
  type PreparedReviewUpload
} from './request-handlers';
import {
  createReviewLatencyCapture,
  emitReviewLatencySummary,
  type ReviewLatencyCapture,
  type ReviewLatencyObserver
} from './review-latency';

export type ResolvedExtractor =
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

export function registerReviewRoutes(input: {
  app: express.Express;
  extractorResolution: ResolvedExtractor;
  latencyObserver?: ReviewLatencyObserver;
}) {
  const { app, extractorResolution, latencyObserver } = input;

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
}
