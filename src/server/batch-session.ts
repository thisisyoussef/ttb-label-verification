import { randomUUID } from 'node:crypto';

import {
  type BatchDashboardResponse,
  batchDashboardResponseSchema,
  batchExportPayloadSchema,
  batchStreamFrameSchema,
  type BatchStartRequest
} from '../shared/contracts/review';
import { type AiProvider, type ExtractionMode } from './ai-provider-policy';
import type { LlmEndpointSurface } from './llm-policy';
import { runTracedReviewSurface } from './llm-trace';
import {
  createReviewLatencyCapture,
  emitReviewLatencySummary,
  type ReviewLatencyObserver
} from './review-latency';
import {
  createReviewExtractionFailure,
  type ReviewExtractor
} from './review-extraction';
import { convertPdfLabelToImage } from './pdf-label-converter';
import { createNormalizedReviewIntake } from './review-intake';
import {
  buildDashboardRow,
  buildErroredRow,
  buildParsedReviewFields,
  emptySummary,
  incrementSummary,
  normalizeProcessingError,
  summarizeRows,
  toMemoryUploadedLabel
} from './batch-session-helpers';
import { resolveBatchAssignments } from './batch-session-assignments';
import { createBatchSessionPreflight } from './batch-session-preflight';
import type {
  BatchSession,
  RunFrameWriter,
  StoredBatchAssignment,
  UploadedBatchFile
} from './batch-session-types';

type ExtractorOverride = {
  extractor: ReviewExtractor;
  extractionMode: ExtractionMode;
  providers: AiProvider[];
};

export class BatchSessionStore {
  private readonly sessions = new Map<string, BatchSession>();
  private readonly extractor: ReviewExtractor;
  private readonly extractionMode: ExtractionMode;
  private readonly providers: AiProvider[];
  private readonly latencyObserver?: ReviewLatencyObserver;

  constructor(input: {
    extractor: ReviewExtractor;
    extractionMode: ExtractionMode;
    providers: AiProvider[];
    latencyObserver?: ReviewLatencyObserver;
    /**
     * Accepted for API symmetry with the review route plumbing. Batch
     * overrides come in as per-call `run`/`retry` arguments, so this is
     * unused at the store level but kept on the constructor input so
     * `createApp` can pass a single shape to both.
     */
    extractorResolver?: unknown;
  }) {
    this.extractor = input.extractor;
    this.extractionMode = input.extractionMode;
    this.providers = input.providers;
    this.latencyObserver = input.latencyObserver;
    void input.extractorResolver;
  }

  createPreflight(input: {
    manifest: unknown;
    imageFiles: UploadedBatchFile[];
    csvFile: UploadedBatchFile;
  }) {
    const session = createBatchSessionPreflight(input);
    this.sessions.set(session.id, session);
    return session.preflight;
  }

  async run(
    payload: BatchStartRequest,
    onFrame: RunFrameWriter,
    override?: ExtractorOverride
  ) {
    const session = this.requireSession(payload.batchSessionId);
    const assignments = resolveBatchAssignments(session, payload.resolutions);

    session.assignments = new Map(
      assignments.map((assignment) => [assignment.image.id, assignment])
    );
    session.results.clear();
    session.reports.clear();
    session.phase = 'running';
    session.cancelRequested = false;
    session.totals = {
      started: assignments.length,
      done: 0
    };
    session.summary = emptySummary();

    if (assignments.length > 0) {
      await onFrame(
        batchStreamFrameSchema.parse({
          type: 'progress',
          done: 0,
          total: assignments.length,
          secondsRemainingEstimate: assignments.length * 5
        })
      );
    }

    // Bounded-concurrency pipeline across labels. The old sequential loop
    // wasted the time every `processAssignment` spent waiting on Gemini —
    // on a 10-label batch, sequential = 10 × ~3.5s ≈ 35s. With concurrency
    // N we keep N VLM calls in flight, so total wall ≈ first_call +
    // ceil((remaining_calls / N) * per_call_ms).
    //
    // N is capped to avoid Gemini rate-limit fire (BATCH_CONCURRENCY env,
    // default 3). completedOrder matches the assignment's index in the
    // submitted CSV, independent of which label's VLM finishes first, so
    // the UI renders rows in original order.
    let totalDurationMs = 0;
    const concurrency = readBatchConcurrency();
    type CompletedItem = {
      index: number;
      result: Awaited<ReturnType<BatchSessionStore['processAssignment']>>;
      durationMs: number;
    };
    // Map keyed by a unique dispatch id so we can remove the winning
    // promise cleanly (no identity-on-resolved-value contortions).
    const inFlight = new Map<number, Promise<CompletedItem>>();
    let nextDispatchId = 0;

    const dispatch = (assignmentIndex: number) => {
      const dispatchId = nextDispatchId++;
      const startedAt = Date.now();
      const assignment = assignments[assignmentIndex]!;
      const completedOrder = assignmentIndex + 1;
      const promise = (async (): Promise<CompletedItem> => {
        const result = await this.processAssignment({
          assignment,
          completedOrder,
          surface: '/api/batch/run',
          override
        });
        return {
          index: assignmentIndex,
          result,
          durationMs: Date.now() - startedAt
        };
      })().finally(() => {
        inFlight.delete(dispatchId);
      });
      inFlight.set(dispatchId, promise);
      return promise;
    };

    const emitCompletion = async (completed: CompletedItem) => {
      const { index, result, durationMs } = completed;
      const assignment = assignments[index]!;
      totalDurationMs += durationMs;

      session.results.set(assignment.image.id, {
        row: result.row,
        assignment
      });
      if (result.report) {
        session.reports.set(result.report.id, result.report);
      }
      incrementSummary(session.summary, result.row.status);
      session.totals.done += 1;

      await onFrame(
        batchStreamFrameSchema.parse({
          type: 'item',
          itemId: `item-${assignment.image.id}-${index + 1}`,
          imageId: assignment.image.id,
          filename: assignment.image.filename,
          identity: `${assignment.row.brandName} — ${assignment.row.classType}`,
          status: result.row.status,
          reportId: result.row.reportId ?? undefined,
          errorMessage: result.row.errorMessage ?? undefined
        })
      );

      if (session.totals.done < session.totals.started) {
        const averageMs = totalDurationMs / session.totals.done;
        const remaining = session.totals.started - session.totals.done;
        await onFrame(
          batchStreamFrameSchema.parse({
            type: 'progress',
            done: session.totals.done,
            total: session.totals.started,
            secondsRemainingEstimate: Math.max(
              0,
              Math.round((averageMs * remaining) / 1000 / concurrency)
            )
          })
        );
      }
    };

    let nextToDispatch = 0;
    while (nextToDispatch < assignments.length && !session.cancelRequested) {
      // Fill the in-flight window up to concurrency before awaiting.
      while (
        nextToDispatch < assignments.length &&
        inFlight.size < concurrency &&
        !session.cancelRequested
      ) {
        dispatch(nextToDispatch);
        nextToDispatch += 1;
      }
      if (inFlight.size === 0) break;
      const completed = await Promise.race(inFlight.values());
      await emitCompletion(completed);
    }

    // Drain remaining in-flight work even if cancellation fired mid-batch;
    // we want deterministic summaries for the frames still in flight.
    while (inFlight.size > 0) {
      const completed = await Promise.race(inFlight.values());
      await emitCompletion(completed);
    }

    session.phase =
      session.cancelRequested && session.totals.done < session.totals.started
        ? 'cancelled-partial'
        : 'complete';

    await onFrame(
      batchStreamFrameSchema.parse({
        type: 'summary',
        total: session.totals.done,
        pass: session.summary.pass,
        review: session.summary.review,
        fail: session.summary.fail,
        error: session.summary.error,
        dashboardHandle: {
          sessionId: session.id
        }
      })
    );
  }

  cancel(sessionId: string) {
    const session = this.requireSession(sessionId);
    session.cancelRequested = true;
  }

  getSummary(sessionId: string) {
    const session = this.requireSession(sessionId);
    return this.serializeSummary(session);
  }

  getReport(sessionId: string, reportId: string) {
    const session = this.requireSession(sessionId);
    const report = session.reports.get(reportId);
    if (!report) {
      throw createReviewExtractionFailure({
        status: 404,
        kind: 'validation',
        message: 'We could not find that report in this batch session.',
        retryable: false
      });
    }

    return report;
  }

  getExport(sessionId: string) {
    const session = this.requireSession(sessionId);
    return batchExportPayloadSchema.parse({
      generatedAt: new Date().toISOString(),
      phase: session.phase === 'prepared' || session.phase === 'running' ? 'complete' : session.phase,
      totals: session.totals,
      summary: session.summary,
      rows: this.sortedRows(session),
      reports: Object.fromEntries(session.reports.entries()),
      noPersistence: true
    });
  }

  async retry(sessionId: string, imageId: string, override?: ExtractorOverride) {
    const session = this.requireSession(sessionId);
    const existing = session.results.get(imageId);
    const assignment = session.assignments.get(imageId);

    if (!existing || !assignment || existing.row.status !== 'error') {
      throw createReviewExtractionFailure({
        status: 409,
        kind: 'validation',
        message: 'That item is not available for retry.',
        retryable: false
      });
    }

    const result = await this.processAssignment({
      assignment,
      completedOrder: existing.row.completedOrder,
      surface: '/api/batch/retry',
      override
    });

    session.results.set(imageId, {
      row: result.row,
      assignment
    });
    if (result.report) {
      session.reports.set(result.report.id, result.report);
    }
    session.summary = summarizeRows(this.sortedRows(session));

    return this.serializeSummary(session);
  }

  private async processAssignment(input: {
    assignment: StoredBatchAssignment;
    completedOrder: number;
    surface: LlmEndpointSurface;
    override?: ExtractorOverride;
  }) {
    const latencyCapture = createReviewLatencyCapture({
      surface: input.surface,
      clientTraceId: [input.surface, input.assignment.image.id].join(':'),
      fixtureId: input.assignment.image.id
    });
    latencyCapture.recordSpan({
      stage: 'intake-parse',
      outcome: 'skipped',
      durationMs: 0
    });

    const activeExtractor = input.override?.extractor ?? this.extractor;
    const activeExtractionMode =
      input.override?.extractionMode ?? this.extractionMode;
    const activeProviders = input.override?.providers ?? this.providers;

    try {
      const normalizationStartedAt = performance.now();
      const parsedFields = buildParsedReviewFields(input.assignment.row);
      const rawIntake = createNormalizedReviewIntake({
        file: toMemoryUploadedLabel(input.assignment.image),
        fields: parsedFields
      });
      const intake = {
        ...rawIntake,
        label: await convertPdfLabelToImage(rawIntake.label)
      };
      latencyCapture.recordSpan({
        stage: 'intake-normalization',
        outcome: 'success',
        durationMs: performance.now() - normalizationStartedAt
      });

      const report = await runTracedReviewSurface({
        surface: input.surface,
        extractionMode: activeExtractionMode,
        provider: activeProviders.join(',') || undefined,
        clientTraceId: [input.surface, input.assignment.image.id].join(':'),
        intake,
        extractor: activeExtractor,
        fixtureId: input.assignment.image.id,
        reportId: randomUUID(),
        latencyCapture,
        latencyObserver: this.latencyObserver
      });

      return {
        row: buildDashboardRow({
          assignment: input.assignment,
          report,
          completedOrder: input.completedOrder
        }),
        report
      };
    } catch (error) {
      if (!latencyCapture.getOutcomePath()) {
        latencyCapture.setOutcomePath('pre-provider-failure');
        emitReviewLatencySummary(latencyCapture, this.latencyObserver);
      }

      const reviewError = normalizeProcessingError(error);

      return {
        row: buildErroredRow({
          assignment: input.assignment,
          completedOrder: input.completedOrder,
          error: reviewError
        }),
        report: null
      };
    }
  }

  private serializeSummary(session: BatchSession): BatchDashboardResponse {
    return batchDashboardResponseSchema.parse({
      batchSessionId: session.id,
      phase:
        session.phase === 'cancelled-partial' ? 'cancelled-partial' : 'complete',
      totals: session.totals,
      summary: session.summary,
      rows: this.sortedRows(session)
    });
  }

  private sortedRows(session: BatchSession) {
    return [...session.results.values()]
      .map((entry) => entry.row)
      .sort((left, right) => left.completedOrder - right.completedOrder);
  }

  private requireSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw createReviewExtractionFailure({
        status: 404,
        kind: 'validation',
        message: 'That batch session is no longer available.',
        retryable: false
      });
    }

    return session;
  }
}

/**
 * Bounded concurrency for the batch VLM pipeline. Measured on the
 * 28-label cola-cloud-all corpus against Gemini 2.5 Flash-Lite
 * (2026-04-17):
 *
 *   N=1   135.6s  (4.8s/label)  sequential baseline
 *   N=3    50.1s  (1.8s/label)  2.7× speedup
 *   N=5    28.9s  (1.0s/label)  4.7× speedup (sweet spot)
 *   N=8    33.3s  (1.2s/label)  regresses — Gemini starts queuing
 *
 * Default 5 captures most of the achievable throughput without tipping
 * Gemini into rate-limited backoff. Override via BATCH_CONCURRENCY env
 * (clamped to 1-8) if a different tier's rate limits shift the curve.
 */
function readBatchConcurrency(): number {
  const raw = process.env.BATCH_CONCURRENCY?.trim();
  if (!raw) return 5;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 5;
  return Math.min(parsed, 8);
}
