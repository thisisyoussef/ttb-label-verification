import crypto from 'node:crypto';
import express from 'express';

import {
  formatSseFrame,
  reviewStreamFrameSchema,
  type ReviewStreamFrame
} from '../../shared/contracts/review';
import { extractFieldsFromOcrText } from '../extractors/ocr-field-extractor';
import { isOcrPrepassEnabled } from '../extractors/ocr-prepass';
import { runOcrPrepassOverLabels } from '../extractors/multi-label-stages';
import { runTracedReviewSurface } from '../llm/llm-trace';
import {
  prepareReviewUpload,
  sendReviewError
} from './request-handlers';
import {
  createReviewLatencyCapture,
  REVIEW_FIRST_RESULT_DEADLINE_MS,
  type ReviewLatencyObserver
} from '../review/review-latency';
import { logServerEvent } from '../server-events';
import {
  emitPreProviderLatencySummary,
  readClientTraceId,
  readProviderOverrideHeader,
  recordPreparedReviewLatency,
  type ExtractorResolver,
  type ResolvedExtractor
} from './review-route-support';
import { type ReviewExtractor } from '../extractors/review-extraction';

export async function handleReviewStream(
  request: express.Request,
  response: express.Response,
  deps: {
    extractorResolution: ResolvedExtractor;
    extractorResolver?: ExtractorResolver;
    latencyObserver?: ReviewLatencyObserver;
    firstResultBudgetMs?: number;
  }
) {
  const requestId = crypto.randomUUID();
  const clientTraceId = readClientTraceId(request);
  const latencyCapture = createReviewLatencyCapture({
    surface: '/api/review',
    clientTraceId,
    firstResultBudgetMs:
      deps.firstResultBudgetMs ?? REVIEW_FIRST_RESULT_DEADLINE_MS
  });

  const prepared = await prepareReviewUpload(request, response);
  recordPreparedReviewLatency(latencyCapture, prepared);

  if (!prepared.success) {
    return;
  }

  const override = readProviderOverrideHeader(request);
  const resolution = override && deps.extractorResolver
    ? (() => {
        const overridden = deps.extractorResolver!(override);
        return overridden.extractor ? overridden : deps.extractorResolution;
      })()
    : deps.extractorResolution;

  if (!resolution.extractor) {
    emitPreProviderLatencySummary({
      latencyCapture,
      observer: deps.latencyObserver,
      providers: resolution.providers
    });
    sendReviewError(response, resolution.status, resolution.error);
    return;
  }

  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  const emit = (frame: ReviewStreamFrame) => {
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

  const heartbeat = setInterval(() => {
    response.write(': heartbeat\n\n');
  }, 10_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    try {
      response.end();
    } catch {
      /* already closed */
    }
  };

  request.on('close', cleanup);

  emit({
    type: 'intake',
    requestId,
    filename: prepared.intake.label.originalName,
    bytes: prepared.intake.label.bytes,
    mimeType: prepared.intake.label.mimeType
  });

  try {
    let augmentedIntake = prepared.intake;
    if (isOcrPrepassEnabled()) {
      const ocrStartedAt = performance.now();
      try {
        const ocrResult = await runOcrPrepassOverLabels(prepared.intake.labels);
        const durationMs = Math.round(performance.now() - ocrStartedAt);
        if (ocrResult.status !== 'failed' && ocrResult.text) {
          const regex = extractFieldsFromOcrText(ocrResult.text);
          augmentedIntake = { ...prepared.intake, ocrText: ocrResult.text };
          const detectedBeverage =
            regex && regex.beverageTypeHint && regex.beverageTypeHint !== 'unknown'
              ? regex.beverageTypeHint
              : undefined;
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
            detectedBeverage,
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
        emit({
          type: 'ocr-done',
          requestId,
          ocrText: '',
          partialFields: {},
          durationMs: Math.round(performance.now() - ocrStartedAt)
        });
      }
    }

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
        latencyObserver: deps.latencyObserver,
        onVlmFieldProgress: (field) => {
          try {
            const value = field.value as {
              present?: boolean;
              value?: string;
              confidence?: number;
              note?: string;
              visibleText?: string;
              alternativeReading?: string;
            };
            if (typeof value.confidence !== 'number') {
              return;
            }
            emit({
              type: 'vlm-field',
              requestId,
              fieldName: field.name,
              field: {
                present: Boolean(value.present),
                value: value.value,
                confidence: value.confidence,
                note: value.note,
                visibleText: value.visibleText,
                alternativeReading: value.alternativeReading
              }
            });
          } catch {
            /* best-effort progressive emission */
          }
        }
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
