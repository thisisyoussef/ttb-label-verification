import { randomUUID } from 'node:crypto';
import {
  type BatchDashboardResponse,
  batchDashboardResponseSchema,
  batchExportPayloadSchema,
  batchStreamFrameSchema,
  type BatchStartRequest,
  type ReviewExtraction,
  type VerificationReport
} from '../../shared/contracts/review';
import { type AiProvider, type ExtractionMode } from '../llm/ai-provider-policy';
import type { LlmEndpointSurface } from '../llm/llm-policy';
import { runTracedReviewSurface } from '../llm/llm-trace';
import {
  createReviewLatencyCapture,
  emitReviewLatencySummary,
  type ReviewLatencyObserver
} from '../review/review-latency';
import {
  createReviewExtractionFailure,
  type ReviewExtractor
} from '../extractors/review-extraction';
import { convertPdfLabelToImage } from '../extractors/pdf-label-converter';
import { createNormalizedReviewIntake } from '../review/review-intake';
import {
  buildDashboardRow,
  buildErroredRow,
  buildParsedReviewFields,
  emptySummary,
  incrementSummary,
  normalizeProcessingError,
  summarizeRows,
  toMemoryUploadedLabels
} from './batch-session-helpers';
import { resolveBatchAssignments } from './batch-session-assignments';
import { createBatchSessionPreflight } from './batch-session-preflight';
import type {
  BatchSession,
  RunFrameWriter,
  StoredBatchAssignment,
  UploadedBatchFile
} from './batch-session-types';
import { estimateBatchSecondsRemaining } from './batch-session-estimate';
import { logServerEvent } from '../server-events';
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
      assignments.map((assignment) => [assignment.primaryImage.id, assignment])
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
          secondsRemainingEstimate: estimateBatchSecondsRemaining(assignments.length)
        })
      );
    }
    const concurrency = readBatchConcurrency();
    type CompletedItem = {
      index: number;
      result: Awaited<ReturnType<BatchSessionStore['processAssignment']>>;
    };
    // Map keyed by a unique dispatch id so we can remove the winning
    // promise cleanly (no identity-on-resolved-value contortions).
    const inFlight = new Map<number, Promise<CompletedItem>>();
    let nextDispatchId = 0;
    const dispatch = (assignmentIndex: number) => {
      const dispatchId = nextDispatchId++;
      const assignment = assignments[assignmentIndex]!;
      const completedOrder = assignmentIndex + 1;
      const promise = (async (): Promise<CompletedItem> => {
        const result = await this.processAssignmentWithHiddenRetry({
          sessionId: session.id,
          assignment,
          completedOrder,
          surface: '/api/batch/run',
          override
        });
        return {
          index: assignmentIndex,
          result
        };
      })().finally(() => {
        inFlight.delete(dispatchId);
      });
      inFlight.set(dispatchId, promise);
      return promise;
    };
    const emitCompletion = async (completed: CompletedItem) => {
      const { index, result } = completed;
      const assignment = assignments[index]!;
      session.results.set(assignment.primaryImage.id, {
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
          itemId: `item-${assignment.primaryImage.id}-${index + 1}`,
          imageId: assignment.primaryImage.id,
          secondaryImageId: assignment.secondaryImage?.id ?? null,
          filename: assignment.primaryImage.filename,
          identity: `${assignment.row.brandName} — ${assignment.row.classType}`,
          status: result.row.status,
          reportId: result.row.reportId ?? undefined,
          errorMessage: result.row.errorMessage ?? undefined
        })
      );
      if (session.totals.done < session.totals.started) {
        const remaining = session.totals.started - session.totals.done;
        await onFrame(
          batchStreamFrameSchema.parse({
            type: 'progress',
            done: session.totals.done,
            total: session.totals.started,
            secondsRemainingEstimate: estimateBatchSecondsRemaining(remaining)
          })
        );
      }
    };
    let nextToDispatch = 0;
    while (nextToDispatch < assignments.length && !session.cancelRequested) {
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
    const result = await this.processAssignmentWithHiddenRetry({
      sessionId: session.id,
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
  private async processAssignmentWithHiddenRetry(input: {
    sessionId: string;
    assignment: StoredBatchAssignment;
    completedOrder: number;
    surface: LlmEndpointSurface;
    override?: ExtractorOverride;
  }) {
    let hiddenRetryCount = 0;

    while (true) {
      const result = await this.processAssignment(input);
      if (!result.error?.retryable) {
        if (hiddenRetryCount > 0) {
          logServerEvent('batch.item.hidden-retry.succeeded', {
            batchSessionId: input.sessionId,
            imageId: input.assignment.primaryImage.id,
            surface: input.surface,
            hiddenRetryCount
          });
        }
        return result;
      }

      if (hiddenRetryCount >= 1) {
        logServerEvent('batch.item.hidden-retry.exhausted', {
          batchSessionId: input.sessionId,
          imageId: input.assignment.primaryImage.id,
          surface: input.surface,
          hiddenRetryCount,
          kind: result.error.kind
        });
        return result;
      }

      hiddenRetryCount += 1;
      logServerEvent('batch.item.hidden-retry.started', {
        batchSessionId: input.sessionId,
        imageId: input.assignment.primaryImage.id,
        surface: input.surface,
        hiddenRetryCount,
        kind: result.error.kind
      });
    }
  }
  private async processAssignment(input: {
    sessionId: string;
    assignment: StoredBatchAssignment;
    completedOrder: number;
    surface: LlmEndpointSurface;
    override?: ExtractorOverride;
  }) {
    const latencyCapture = createReviewLatencyCapture({
      surface: input.surface,
      clientTraceId: [input.surface, input.assignment.primaryImage.id].join(':'),
      fixtureId: input.assignment.primaryImage.id
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
        files: toMemoryUploadedLabels(input.assignment),
        fields: parsedFields
      });
      const labels = await Promise.all(
        rawIntake.labels.map((label) => convertPdfLabelToImage(label))
      );
      const intake = {
        ...rawIntake,
        label: labels[0]!,
        labels
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
        clientTraceId: [input.surface, input.assignment.primaryImage.id].join(':'),
        intake,
        extractor: activeExtractor,
        fixtureId: input.assignment.primaryImage.id,
        reportId: randomUUID(),
        latencyCapture,
        latencyObserver: this.latencyObserver
      });
      const extraction =
        (report as VerificationReport & { __extraction?: ReviewExtraction }).__extraction;
      return {
        row: buildDashboardRow({
          assignment: input.assignment,
          report,
          completedOrder: input.completedOrder
        }),
        report,
        intake,
        extraction,
        error: null
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
        report: null,
        error: reviewError
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
function readBatchConcurrency(): number {
  const raw = process.env.BATCH_CONCURRENCY?.trim();
  if (!raw) return 5;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 5;
  return Math.min(parsed, 8);
}
