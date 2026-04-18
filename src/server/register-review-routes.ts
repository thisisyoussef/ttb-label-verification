import crypto from 'node:crypto';
import express from 'express';

import {
  checkReviewSchema,
  formatSseFrame,
  reviewExtractionSchema,
  reviewStreamFrameSchema,
  type ReviewError,
  type ReviewStreamFrame
} from '../shared/contracts/review';
import { extractFieldsFromOcrText } from './ocr-field-extractor';
import { runOcrPrepass, isOcrPrepassEnabled } from './ocr-prepass';
import { extractionCache, type CachedExtraction } from './extraction-cache';
import { buildVerificationReport } from './review-report';
import { buildGovernmentWarningCheck } from './government-warning-validator';
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
      const cacheKey = cacheKeyFromBytes(intake.label.buffer);
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

// --- Image-first prefetch helpers -----------------------------------------

function cacheKeyFromBytes(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function partialFromOcr(ocrText: string | undefined): Record<string, unknown> {
  if (!ocrText || ocrText.length < 20) return {};
  const parsed = extractFieldsFromOcrText(ocrText);
  if (!parsed) return {};
  return {
    alcoholContent: parsed.fields.alcoholContent,
    netContents: parsed.fields.netContents,
    classType: parsed.fields.classType,
    countryOfOrigin: parsed.fields.countryOfOrigin,
    governmentWarning: parsed.fields.governmentWarning
  };
}

/**
 * Streaming handler for `/api/review/stream`. Runs the same pipeline as
 * `/api/review` but emits Server-Sent Events at stage boundaries so the
 * client can render progressively:
 *
 *   intake       — immediate, once the upload is parsed
 *   ocr-done     — ~1-2s, with regex-extracted numeric/canonical fields
 *   report-ready — ~5-7s, with the full VerificationReport
 *   done         — terminal
 *
 * The OCR pre-pass runs once in this handler (to emit the early frame)
 * and is threaded into `intake.ocrText` so the downstream surface can
 * skip its own pre-pass. Keeps the double-work surface to zero when
 * everything happens in-process.
 *
 * MVP note: this is stage-level streaming, not per-VLM-field streaming.
 * A follow-up commit will tap `generateContentStream` to emit per-field
 * frames as Gemini structures its JSON response.
 */
async function handleReviewStream(
  request: express.Request,
  response: express.Response,
  deps: {
    extractorResolution: ResolvedExtractor;
    extractorResolver?: ExtractorResolver;
    latencyObserver?: ReviewLatencyObserver;
  }
) {
  const requestId = crypto.randomUUID();
  const clientTraceId = readClientTraceId(request);
  const latencyCapture = createReviewLatencyCapture({
    surface: '/api/review',
    clientTraceId
  });

  const prepared = await prepareReviewUpload(request, response);
  recordPreparedReviewLatency(latencyCapture, prepared);

  if (!prepared.success) {
    // prepareReviewUpload already wrote an error response. Nothing to
    // stream — caller sees a standard JSON error on the /stream URL,
    // same shape as /api/review failures.
    return;
  }

  // Resolve the provider (honoring x-provider-override) once the upload
  // is known-good so streaming SSE doesn't race the upload error path.
  const override = readProviderOverrideHeader(request);
  const resolution = override && deps.extractorResolver
    ? (() => {
        const overridden = deps.extractorResolver!(override);
        return overridden.extractor ? overridden : deps.extractorResolution;
      })()
    : deps.extractorResolution;

  if (!resolution.extractor) {
    sendReviewError(response, resolution.status, resolution.error);
    return;
  }

  // --- SSE setup ----------------------------------------------------------
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no'); // for nginx/Railway
  response.flushHeaders();

  const emit = (frame: ReviewStreamFrame) => {
    // Validate against the shared schema before write — a malformed
    // frame would silently break the client parser otherwise.
    const parsed = reviewStreamFrameSchema.safeParse(frame);
    if (!parsed.success) {
      logServerEvent('review.stream.invalid-frame', {
        requestId,
        frameType: (frame as { type?: string }).type,
        issue: parsed.error.issues[0]?.message
      });
      return;
    }
    response.write(formatSseFrame(parsed.data));
  };

  // Heartbeat every 10s to keep intermediaries (nginx, Railway edge)
  // from timing out the open connection on long-running labels.
  const heartbeat = setInterval(() => {
    response.write(': heartbeat\n\n');
  }, 10_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    try { response.end(); } catch { /* already closed */ }
  };

  request.on('close', cleanup);

  // --- Emit intake -------------------------------------------------------
  emit({
    type: 'intake',
    requestId,
    filename: prepared.intake.label.originalName,
    bytes: prepared.intake.label.bytes,
    mimeType: prepared.intake.label.mimeType
  });

  try {
    // --- OCR pre-pass (emits ocr-done frame) -----------------------------
    // Runs here instead of inside runTracedReviewSurface so the frame
    // arrives on the wire at ~1-2s. runTracedReviewSurface currently
    // runs its own Tesseract pass unconditionally, so this OCR is
    // executed twice. The cost is ~1s of CPU on the server (no LLM
    // call) and buys ~3-5s of perceived latency on the client —
    // worth it for the MVP. Follow-up: teach the downstream surface
    // to honor intake.ocrText and skip the duplicate pass.
    let augmentedIntake = prepared.intake;
    if (isOcrPrepassEnabled()) {
      const ocrStartedAt = performance.now();
      try {
        const ocrResult = await runOcrPrepass(prepared.intake.label);
        const durationMs = Math.round(performance.now() - ocrStartedAt);
        if (ocrResult.status !== 'failed' && ocrResult.text) {
          const regex = extractFieldsFromOcrText(ocrResult.text);
          augmentedIntake = { ...prepared.intake, ocrText: ocrResult.text };
          emit({
            type: 'ocr-done',
            requestId,
            ocrText: ocrResult.text,
            partialFields: regex
              ? {
                  alcoholContent: regex.fields.alcoholContent,
                  netContents: regex.fields.netContents,
                  classType: regex.fields.classType,
                  countryOfOrigin: regex.fields.countryOfOrigin,
                  governmentWarning: regex.fields.governmentWarning
                }
              : {},
            durationMs
          });
        } else {
          emit({
            type: 'ocr-done',
            requestId,
            ocrText: '',
            partialFields: {},
            durationMs
          });
        }
      } catch {
        // OCR failures are non-fatal — emit an empty frame so the
        // client knows the stage completed (with nothing to show)
        // and can move on to waiting for vlm-done / report-ready.
        emit({
          type: 'ocr-done',
          requestId,
          ocrText: '',
          partialFields: {},
          durationMs: Math.round(performance.now() - ocrStartedAt)
        });
      }
    }

    // --- Full review pipeline OR early-abort after OCR -------------------
    // Clients can pass `?only-ocr=true` to request just the OCR preview
    // (intake + ocr-done frames) without running the VLM. Used by
    // Processing screen to show partial fields in ~500ms while the
    // canonical /api/review call continues in parallel.
    const onlyOcr = String(request.query.only ?? '').toLowerCase() === 'ocr'
      || String(request.query['only-ocr'] ?? '').toLowerCase() === 'true';

    if (onlyOcr) {
      emit({ type: 'done', requestId });
    } else {
      const report = await runTracedReviewSurface({
        surface: '/api/review',
        extractionMode: resolution.extractionMode,
        provider: resolution.providers.join(',') || undefined,
        clientTraceId,
        intake: augmentedIntake,
        extractor: resolution.extractor as ReviewExtractor,
        latencyCapture,
        latencyObserver: deps.latencyObserver
      });

      emit({ type: 'report-ready', requestId, report });
      emit({ type: 'done', requestId });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    emit({
      type: 'error',
      requestId,
      message,
      retryable: true,
      kind: 'internal'
    });
  } finally {
    cleanup();
  }
}
