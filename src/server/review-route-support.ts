import crypto from 'node:crypto';
import express from 'express';

import { extractFieldsFromOcrText } from './ocr-field-extractor';
import {
  emitReviewLatencySummary,
  type ReviewLatencyCapture,
  type ReviewLatencyObserver
} from './review-latency';
import type { PreparedReviewUpload } from './request-handlers';
import type { AiProvider, ExtractionMode } from './ai-provider-policy';
import type { ReviewExtractor } from './review-extraction';
import type { ReviewError } from '../shared/contracts/review';

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

export type ExtractorResolver = (
  requestedMode?: ExtractionMode
) => ResolvedExtractor;

const PROVIDER_OVERRIDE_HEADER = 'x-provider-override';

export function readProviderOverrideHeader(
  request: express.Request
): ExtractionMode | undefined {
  const raw = request.header(PROVIDER_OVERRIDE_HEADER)?.trim().toLowerCase();
  if (raw === 'cloud' || raw === 'local') {
    return raw;
  }
  return undefined;
}

export function readClientTraceId(request: express.Request) {
  const raw = request.header('x-review-client-id')?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function recordPreparedReviewLatency(
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

export function emitPreProviderLatencySummary(input: {
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

export function writeStageTimingsHeader(
  response: express.Response,
  latencyCapture: ReviewLatencyCapture
) {
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
}

export function cacheKeyFromBytes(buffers: Buffer[]): string {
  const hash = crypto.createHash('sha256');
  for (const buffer of buffers) {
    hash.update(String(buffer.byteLength));
    hash.update(':');
    hash.update(buffer);
  }
  return hash.digest('hex');
}

export function partialFromOcr(ocrText: string | undefined): Record<string, unknown> {
  if (!ocrText || ocrText.length < 20) {
    return {};
  }
  const parsed = extractFieldsFromOcrText(ocrText);
  if (!parsed) {
    return {};
  }
  return {
    alcoholContent: parsed.fields.alcoholContent,
    netContents: parsed.fields.netContents,
    classType: parsed.fields.classType,
    countryOfOrigin: parsed.fields.countryOfOrigin,
    governmentWarning: parsed.fields.governmentWarning
  };
}
