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
import { logServerEvent } from './server-events';

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

/**
 * Resolves an extractor for a specific requested mode. When `requestedMode`
 * is undefined the default extractor (built from env at startup) is returned.
 *
 * Used by the Provider Override header path (Mission 2) so a dev can force
 * the request through the other mode without restarting the server.
 */
export type ExtractorResolver = (
  requestedMode?: ExtractionMode
) => ResolvedExtractor;

const PROVIDER_OVERRIDE_HEADER = 'x-provider-override';

export function readProviderOverrideHeader(
  request: express.Request
): ExtractionMode | undefined {
  const raw = request.header(PROVIDER_OVERRIDE_HEADER)?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'cloud' || raw === 'local') {
    return raw;
  }
  return undefined;
}

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
  extractorResolver?: ExtractorResolver;
  latencyObserver?: ReviewLatencyObserver;
}) {
  const { app, extractorResolution, extractorResolver, latencyObserver } = input;

  function resolveForRequest(request: express.Request): {
    resolution: ResolvedExtractor;
    overrideRequested: ExtractionMode | undefined;
  } {
    const override = readProviderOverrideHeader(request);
    if (!override || !extractorResolver) {
      return { resolution: extractorResolution, overrideRequested: undefined };
    }

    const overridden = extractorResolver(override);
    if (!overridden.extractor) {
      // Fall back to default when the overridden mode is unavailable.
      logServerEvent('review.provider-override.unavailable', {
        requestedMode: override,
        reason: overridden.error?.kind ?? 'unknown'
      });
      return { resolution: extractorResolution, overrideRequested: override };
    }

    logServerEvent('review.provider-override.applied', {
      requestedMode: override,
      resolvedMode: overridden.extractionMode,
      providers: overridden.providers
    });
    return { resolution: overridden, overrideRequested: override };
  }

  async function handleSingleLabelRoute<T>(
    surface: '/api/review' | '/api/review/extraction' | '/api/review/warning',
    request: express.Request,
    response: express.Response,
    runner: (input: {
      intake: Parameters<NonNullable<ResolvedExtractor['extractor']>>[0];
      clientTraceId?: string;
      latencyCapture: ReviewLatencyCapture;
      resolution: ResolvedExtractor;
    }) => Promise<T>
  ) {
    const clientTraceId = readClientTraceId(request);
    const { resolution } = resolveForRequest(request);
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
        providers: resolution.providers
      });
      return;
    }

    if (!resolution.extractor) {
      emitPreProviderLatencySummary({
        latencyCapture,
        observer: latencyObserver,
        providers: resolution.providers
      });
      sendReviewError(response, resolution.status, resolution.error);
      return;
    }

    try {
      const result = await runner({
        intake: prepared.intake,
        clientTraceId,
        latencyCapture,
        resolution
      });

      // Expose per-stage timings on the response so we can diagnose where
      // the wall-clock time goes without needing SSH on the pod. Format:
      //   X-Stage-Timings: total=9821;ocr=812;vlm=3012;ocv=4123;judge=1431
      //
      // The header keeps the breakdown compact (no JSON) so it fits in the
      // typical 8KB header budget and is trivially grep-able from client
      // timing tools.
      try {
        const finalized = latencyCapture.finalize();
        const aggregate: Record<string, number> = {};
        for (const span of finalized.spans) {
          const ms = Math.round(span.durationMs);
          if (!Number.isFinite(ms) || ms < 0) continue;
          aggregate[span.stage] = (aggregate[span.stage] ?? 0) + ms;
        }
        const parts = Object.entries(aggregate).map(
          ([stage, ms]) => `${stage}=${ms}`
        );
        parts.unshift(`total=${Math.round(finalized.totalDurationMs)}`);
        response.setHeader('X-Stage-Timings', parts.join(';'));
      } catch {
        /* best-effort; never block the response on telemetry */
      }

      response.json(result);
    } catch (error) {
      respondToReviewExecutionError(error, response);
    }
  }

  app.post('/api/review', (request, response) => {
    void handleSingleLabelRoute('/api/review', request, response, async ({
      intake,
      clientTraceId,
      latencyCapture,
      resolution
    }) =>
      await runTracedReviewSurface({
        surface: '/api/review',
        extractionMode: resolution.extractionMode,
        provider: resolution.providers.join(',') || undefined,
        clientTraceId,
        intake,
        extractor: resolution.extractor as ReviewExtractor,
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
      async ({ intake, clientTraceId, latencyCapture, resolution }) => {
        const extraction = await runTracedExtractionSurface({
          surface: '/api/review/extraction',
          extractionMode: resolution.extractionMode,
          provider: resolution.providers.join(',') || undefined,
          clientTraceId,
          intake,
          extractor: resolution.extractor as ReviewExtractor,
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
      async ({ intake, clientTraceId, latencyCapture, resolution }) => {
        const warningCheck = await runTracedWarningSurface({
          surface: '/api/review/warning',
          extractionMode: resolution.extractionMode,
          provider: resolution.providers.join(',') || undefined,
          clientTraceId,
          intake,
          extractor: resolution.extractor as ReviewExtractor,
          latencyCapture,
          latencyObserver
        });
        return checkReviewSchema.parse(warningCheck);
      }
    );
  });
}
