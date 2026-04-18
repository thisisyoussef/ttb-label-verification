import express from 'express';

import {
  checkReviewSchema,
  reviewExtractionSchema
} from '../shared/contracts/review';
import { extractionCache, type CachedExtraction } from './extraction-cache';
import { buildVerificationReport } from './review-report';
import { buildGovernmentWarningCheck } from './warning/government-warning-validator';
import { type ExtractionMode } from './ai-provider-policy';
import {
  runTracedExtractionSurface,
  runTracedReviewSurface,
  runTracedWarningSurface
} from './llm-trace';
import { type ReviewExtractor } from './review-extraction';
import {
  prepareReviewUpload,
  respondToReviewExecutionError,
  sendReviewError
} from './request-handlers';
import {
  createReviewLatencyCapture,
  type ReviewLatencyCapture,
  type ReviewLatencyObserver
} from './review-latency';
import { logServerEvent } from './server-events';
import {
  cacheKeyFromBytes,
  emitPreProviderLatencySummary,
  partialFromOcr,
  readClientTraceId,
  readProviderOverrideHeader,
  recordPreparedReviewLatency,
  type ExtractorResolver,
  type ResolvedExtractor
} from './review-route-support';
import { handleReviewStream } from './review-stream-route';

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
    }) => {
      // Image-first prefetch hit: client supplies the cache key returned
      // by an earlier /api/review/extract-only call. We skip extraction
      // entirely and run just judgment + report against the cached
      // extraction. buildVerificationReport is a pure function — takes
      // sub-second on a typical label, vs 5-7s for a cold extraction.
      const cacheKey = request.header('x-extraction-cache-key')?.trim();
      if (cacheKey) {
        const hit = extractionCache.get(cacheKey);
        if (hit) {
          logServerEvent('review.extraction-cache.hit', {
            cacheKey: cacheKey.slice(0, 12),
            clientTraceId
          });
          // Merge cached OCR text into intake so downstream judgment /
          // OCR-fallback paths still see it.
          const cachedIntake = hit.ocrText
            ? { ...intake, ocrText: hit.ocrText }
            : intake;
          const report = await buildVerificationReport({
            intake: cachedIntake,
            extraction: hit.extraction,
            warningCheck: hit.warningCheck
          });
          return report;
        }
        logServerEvent('review.extraction-cache.miss', {
          cacheKey: cacheKey.slice(0, 12),
          clientTraceId
        });
      }
      return runTracedReviewSurface({
        surface: '/api/review',
        extractionMode: resolution.extractionMode,
        provider: resolution.providers.join(',') || undefined,
        clientTraceId,
        intake,
        extractor: resolution.extractor as ReviewExtractor,
        latencyCapture,
        latencyObserver
      });
    });
  });

  // Image-first prefetch: runs the full extraction + warning-check
  // pipeline on the uploaded image without requiring application data
  // or computing a verdict. The result is stashed in an in-memory cache
  // keyed by image-bytes hash; the client passes that key back on the
  // eventual /api/review call to skip re-extraction.
  //
  // Cost: same as a full /api/review extraction (~5-7s of VLM). Win:
  // amortized against form-filling time — if the user spends >5s
  // typing, Verify returns in <100ms because judgment+report is cheap.
  app.post('/api/review/extract-only', (request, response) => {
    void handleSingleLabelRoute('/api/review', request, response, async ({
      intake,
      clientTraceId,
      latencyCapture,
      resolution
    }) => {
      const cacheKey = cacheKeyFromBytes(
        (intake.labels.length > 0 ? intake.labels : [intake.label]).map((label) => label.buffer)
      );
      const existing = extractionCache.get(cacheKey);
      if (existing) {
        logServerEvent('review.extraction-cache.prefetch-dedup', {
          cacheKey: cacheKey.slice(0, 12),
          clientTraceId
        });
        return {
          cacheKey,
          ocrText: existing.ocrText ?? '',
          ocrPreview: partialFromOcr(existing.ocrText)
        };
      }
      const reportWithExtraction = (await runTracedReviewSurface({
        surface: '/api/review',
        extractionMode: resolution.extractionMode,
        provider: resolution.providers.join(',') || undefined,
        clientTraceId,
        intake,
        extractor: resolution.extractor as ReviewExtractor,
        latencyCapture,
        latencyObserver
      })) as unknown as { __extraction?: unknown };

      // Pull the extraction + warning off the report. The extraction is
      // attached as a non-enumerable __extraction property by
      // runTracedReviewSurface; we reconstruct a warning CheckReview
      // from the extraction itself so we don't re-run warning OCV.
      const extraction = (reportWithExtraction as { __extraction: unknown })
        .__extraction as CachedExtraction['extraction'];
      if (extraction) {
        const warningCheck = buildGovernmentWarningCheck(extraction);
        extractionCache.set(cacheKey, {
          extraction,
          warningCheck,
          ocrText: intake.ocrText,
          createdAt: Date.now()
        });
        logServerEvent('review.extraction-cache.stored', {
          cacheKey: cacheKey.slice(0, 12),
          clientTraceId
        });
      }
      return {
        cacheKey,
        ocrText: intake.ocrText ?? '',
        ocrPreview: partialFromOcr(intake.ocrText)
      };
    });
  });

  // Option C — row-level refine. Fires AFTER the initial /api/review
  // lands with any identifier field in 'review' status. Re-runs the
  // pipeline with VERIFICATION_MODE forced on, so the VLM gets the
  // applicant-declared identifiers and can decide whether they're
  // actually visible on the label (instead of bottom-up guessing).
  // Returns the full refined report so the client can merge the
  // specific rows it wanted to re-check.
  app.post('/api/review/refine', (request, response) => {
    void handleSingleLabelRoute('/api/review', request, response, async ({
      intake,
      clientTraceId,
      latencyCapture,
      resolution
    }) => {
      const previous = process.env.VERIFICATION_MODE;
      process.env.VERIFICATION_MODE = 'on';
      try {
        return await runTracedReviewSurface({
          surface: '/api/review',
          extractionMode: resolution.extractionMode,
          provider: resolution.providers.join(',') || undefined,
          clientTraceId,
          intake,
          extractor: resolution.extractor as ReviewExtractor,
          latencyCapture,
          latencyObserver
        });
      } finally {
        if (previous === undefined) {
          delete process.env.VERIFICATION_MODE;
        } else {
          process.env.VERIFICATION_MODE = previous;
        }
      }
    });
  });

  app.post('/api/review/stream', (request, response) => {
    void handleReviewStream(request, response, {
      extractorResolution,
      extractorResolver,
      latencyObserver
    });
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
