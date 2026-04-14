import { randomUUID } from 'node:crypto';
import {
  BATCH_LABEL_CAP,
  MAX_LABEL_UPLOAD_BYTES,
  type BatchDashboardResponse,
  batchDashboardResponseSchema,
  batchExportPayloadSchema,
  batchPreflightRequestSchema,
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  type BatchResolution,
  type BatchStartRequest,
} from '../shared/contracts/review';
import {
  buildBatchFileError,
  formatFileSize,
  hasSupportedLabelFileType,
  normalizeFilenameForComparison
} from '../shared/batch-file-meta';
import { buildGovernmentWarningCheck } from './government-warning-validator';
import type { LlmEndpointSurface } from './llm-policy';
import { runTracedReviewExtraction } from './llm-trace';
import {
  createReviewExtractionFailure,
  type ReviewExtractor
} from './review-extraction';
import { createNormalizedReviewIntake } from './review-intake';
import { buildVerificationReport } from './review-report';
import { parseBatchCsv } from './batch-csv';
import { buildBatchMatching } from './batch-matching';
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
import type {
  BatchSession,
  RunFrameWriter,
  StoredBatchAssignment,
  StoredBatchImage,
  UploadedBatchFile
} from './batch-session-types';

export class BatchSessionStore {
  private readonly sessions = new Map<string, BatchSession>();

  constructor(private readonly extractor: ReviewExtractor) {}

  createPreflight(input: {
    manifest: unknown;
    imageFiles: UploadedBatchFile[];
    csvFile: UploadedBatchFile;
  }) {
    const manifest = batchPreflightRequestSchema.parse(input.manifest);
    const acceptedImages = new Map<string, StoredBatchImage>();
    const fileErrors: ReturnType<typeof buildBatchFileError>[] = [];
    const seenFilenames = new Set<string>();

    manifest.images.forEach((meta, index) => {
      const file = input.imageFiles[index];
      if (!file) {
        return;
      }

      if (index >= BATCH_LABEL_CAP) {
        fileErrors.push(
          buildBatchFileError({
            filename: file.originalname,
            reason: 'over-cap'
          })
        );
        return;
      }

      if (
        !hasSupportedLabelFileType({
          filename: file.originalname,
          mimeType: file.mimetype
        })
      ) {
        fileErrors.push(
          buildBatchFileError({
            filename: file.originalname,
            reason: 'unsupported-type'
          })
        );
        return;
      }

      if (file.size > MAX_LABEL_UPLOAD_BYTES) {
        fileErrors.push(
          buildBatchFileError({
            filename: file.originalname,
            reason: 'oversized'
          })
        );
        return;
      }

      const normalizedName = normalizeFilenameForComparison(file.originalname);
      if (seenFilenames.has(normalizedName)) {
        fileErrors.push(
          buildBatchFileError({
            filename: file.originalname,
            reason: 'duplicate'
          })
        );
        return;
      }
      seenFilenames.add(normalizedName);

      acceptedImages.set(meta.clientId, {
        id: meta.clientId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sizeLabel: formatFileSize(file.size),
        isPdf: file.mimetype === 'application/pdf',
        buffer: file.buffer
      });
    });

    const csv = parseBatchCsv({
      filename: input.csvFile.originalname,
      text: input.csvFile.buffer.toString('utf8')
    });

    const sessionId = randomUUID();
    const rows = csv.success ? csv.rows : [];
    const matching = csv.success
      ? buildBatchMatching({
          images: [...acceptedImages.values()].map((image) => ({
            id: image.id,
            filename: image.filename
          })),
          rows
        })
      : {
          matched: [],
          ambiguous: [],
          unmatchedImageIds: [...acceptedImages.keys()],
          unmatchedRowIds: []
        };

    const preflight = batchPreflightResponseSchema.parse({
      batchSessionId: sessionId,
      csvHeaders: csv.success ? csv.headers : [],
      csvRows: csv.success ? csv.preview.rows : [],
      matching,
      csvError: csv.success ? undefined : csv.error,
      fileErrors
    });

    this.sessions.set(sessionId, {
      id: sessionId,
      images: acceptedImages,
      rows,
      preflight,
      assignments: new Map(),
      results: new Map(),
      reports: new Map(),
      phase: 'prepared',
      totals: {
        started: 0,
        done: 0
      },
      summary: emptySummary(),
      cancelRequested: false
    });

    return preflight;
  }

  async run(
    payload: BatchStartRequest,
    onFrame: RunFrameWriter
  ) {
    const session = this.requireSession(payload.batchSessionId);
    const assignments = this.resolveAssignments(session, payload.resolutions);

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

    let completedOrder = 0;
    let totalDurationMs = 0;

    for (const assignment of assignments) {
      if (session.cancelRequested) {
        break;
      }

      const startedAt = Date.now();
      completedOrder += 1;
      const result = await this.processAssignment({
        assignment,
        completedOrder,
        surface: '/api/batch/run'
      });
      totalDurationMs += Date.now() - startedAt;

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
          itemId: `item-${assignment.image.id}-${completedOrder}`,
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
              Math.round((averageMs * remaining) / 1000)
            )
          })
        );
      }
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

  async retry(sessionId: string, imageId: string) {
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
      surface: '/api/batch/retry'
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
  }) {
    const parsedFields = buildParsedReviewFields(input.assignment.row);
    const intake = createNormalizedReviewIntake({
      file: toMemoryUploadedLabel(input.assignment.image),
      fields: parsedFields
    });

    try {
      const extraction = await runTracedReviewExtraction({
        surface: input.surface,
        intake,
        extractor: this.extractor,
        fixtureId: input.assignment.image.id
      });
      const report = buildVerificationReport({
        intake,
        extraction,
        warningCheck: buildGovernmentWarningCheck(extraction),
        id: randomUUID()
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

  private resolveAssignments(session: BatchSession, resolutions: BatchResolution[]) {
    const rowsById = new Map(session.rows.map((row) => [row.id, row]));
    const assignedRowIds = new Set<string>();
    const assignments: StoredBatchAssignment[] = [];

    for (const matched of session.preflight.matching.matched) {
      const image = session.images.get(matched.imageId);
      const row = rowsById.get(matched.row.id);
      if (!image || !row) {
        continue;
      }
      assignedRowIds.add(row.id);
      assignments.push({ image, row });
    }

    const resolutionByImageId = new Map(resolutions.map((resolution) => [resolution.imageId, resolution]));
    const unresolvedImageIds = new Set([
      ...session.preflight.matching.ambiguous.map((entry) => entry.imageId),
      ...session.preflight.matching.unmatchedImageIds
    ]);

    for (const imageId of unresolvedImageIds) {
      const resolution = resolutionByImageId.get(imageId);
      if (!resolution) {
        throw createReviewExtractionFailure({
          status: 400,
          kind: 'validation',
          message: 'Resolve every ambiguous or unmatched image before starting the batch.',
          retryable: false
        });
      }

      if (resolution.action.kind === 'dropped') {
        continue;
      }

      const image = session.images.get(imageId);
      const row = rowsById.get(resolution.action.rowId);
      if (!image || !row) {
        throw createReviewExtractionFailure({
          status: 400,
          kind: 'validation',
          message: 'One of the selected row matches was not available.',
          retryable: false
        });
      }
      if (assignedRowIds.has(row.id)) {
        throw createReviewExtractionFailure({
          status: 400,
          kind: 'validation',
          message: 'A CSV row was assigned to more than one image.',
          retryable: false
        });
      }

      assignedRowIds.add(row.id);
      assignments.push({ image, row });
    }

    return assignments;
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
