import type { AiProvider } from '../llm/ai-provider-policy';
import type { LlmEndpointSurface } from '../llm/llm-policy';

export const REVIEW_MAX_RETRYABLE_FALLBACK_ELAPSED_MS = 550;

export type ReviewLatencyStage =
  | 'intake-parse'
  | 'intake-normalization'
  | 'provider-selection'
  | 'relevance-preflight'
  | 'request-assembly'
  | 'provider-wait'
  | 'fallback-handoff'
  | 'deterministic-validation'
  | 'report-shaping'
  // New pipeline stages added in the accuracy pass
  | 'ocr-prepass'
  | 'warning-ocv'
  | 'region-detection'
  | 'llm-judgment'
  // Spirits-only same-field-of-vision VLM check (27 CFR 5.61).
  | 'spirits-colocation'
  // Parallel anchor track — deterministic OCR verification of app values.
  | 'anchor-track';

export type ReviewLatencyStageOutcome =
  | 'success'
  | 'fast-fail'
  | 'late-fail'
  | 'skipped';

export type ReviewLatencyAttempt = 'primary' | 'fallback';

export type ReviewLatencyPath =
  | 'primary-success'
  | 'fast-fail-fallback-success'
  | 'late-fail-retryable'
  | 'primary-hard-fail'
  | 'pre-provider-failure'
  | 'preflight-success'
  | 'fallback-failure';

export type ReviewLatencySpan = {
  stage: ReviewLatencyStage;
  outcome: ReviewLatencyStageOutcome;
  durationMs: number;
  provider?: AiProvider;
  attempt?: ReviewLatencyAttempt;
};

export type ReviewLatencyProviderMetadata = {
  provider: AiProvider;
  attempt?: ReviewLatencyAttempt;
  serviceTier?: string;
  promptTokenCount?: number;
  thoughtsTokenCount?: number;
};

export type ReviewLatencySummary = {
  surface: LlmEndpointSurface;
  outcomePath: ReviewLatencyPath;
  totalDurationMs: number;
  spans: ReviewLatencySpan[];
  providerMetadata: ReviewLatencyProviderMetadata[];
  providerOrder: AiProvider[];
  fallbackAttempted: boolean;
  clientTraceId?: string;
  fixtureId?: string;
};

export type ReviewLatencyObserver = (summary: ReviewLatencySummary) => void;

export class ReviewLatencyCapture {
  private readonly startedAt = performance.now();
  private readonly spans: ReviewLatencySpan[] = [];
  private readonly providerMetadata: ReviewLatencyProviderMetadata[] = [];
  private providerOrder: AiProvider[] = [];
  private outcomePath?: ReviewLatencyPath;
  private finalized?: ReviewLatencySummary;

  constructor(
    private readonly metadata: {
      surface: LlmEndpointSurface;
      clientTraceId?: string;
      fixtureId?: string;
    }
  ) {}

  setProviderOrder(providerOrder: AiProvider[]) {
    this.providerOrder = [...providerOrder];
  }

  setOutcomePath(outcomePath: ReviewLatencyPath) {
    this.outcomePath = outcomePath;
  }

  getOutcomePath() {
    return this.outcomePath;
  }

  getElapsedMs() {
    return performance.now() - this.startedAt;
  }

  hasFallbackAttempt() {
    return this.spans.some(
      (span) => span.stage === 'fallback-handoff' && span.outcome === 'success'
    );
  }

  recordSpan(span: ReviewLatencySpan) {
    if (this.finalized) {
      return;
    }

    this.spans.push({
      ...span,
      durationMs: normalizeDuration(span.durationMs)
    });
  }

  recordProviderMetadata(metadata: ReviewLatencyProviderMetadata) {
    if (this.finalized) {
      return;
    }

    this.providerMetadata.push({
      ...metadata
    });
  }

  finalize() {
    if (this.finalized) {
      return this.finalized;
    }

    this.finalized = {
      surface: this.metadata.surface,
      outcomePath: this.outcomePath ?? 'primary-hard-fail',
      totalDurationMs: normalizeDuration(performance.now() - this.startedAt),
      spans: [...this.spans],
      providerMetadata: [...this.providerMetadata],
      providerOrder: [...this.providerOrder],
      fallbackAttempted: this.hasFallbackAttempt(),
      clientTraceId: this.metadata.clientTraceId,
      fixtureId: this.metadata.fixtureId
    };

    return this.finalized;
  }
}

export function createReviewLatencyCapture(input: {
  surface: LlmEndpointSurface;
  clientTraceId?: string;
  fixtureId?: string;
}) {
  return new ReviewLatencyCapture(input);
}

export function mergeReviewLatencyObservers(
  ...observers: Array<ReviewLatencyObserver | undefined>
) {
  const activeObservers = observers.filter(
    (observer): observer is ReviewLatencyObserver => Boolean(observer)
  );
  if (activeObservers.length === 0) {
    return undefined;
  }

  return (summary: ReviewLatencySummary) => {
    for (const observer of activeObservers) {
      observer(summary);
    }
  };
}

export function createConsoleReviewLatencyObserver(): ReviewLatencyObserver {
  return (summary) => {
    console.info('[ttb-latency] ' + JSON.stringify(summary));
  };
}

export function emitReviewLatencySummary(
  capture: ReviewLatencyCapture,
  observer?: ReviewLatencyObserver
) {
  if (!observer) {
    return capture.finalize();
  }

  const summary = capture.finalize();
  observer(summary);
  return summary;
}

function normalizeDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 0;
  }

  return Math.round(durationMs);
}
