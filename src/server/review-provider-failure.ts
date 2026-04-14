import type { ReviewError } from '../shared/contracts/review';
import {
  fallbackAllowedForProviderFailure,
  providerMode,
  type AiCapability,
  type AiProvider,
  type ExtractionMode,
  type ProviderFailureReason
} from './ai-provider-policy';
import {
  ReviewExtractionFailure,
  isReviewExtractionFailure
} from './review-extraction';

export interface ReviewProviderFailureMetadata {
  provider: AiProvider;
  mode: ExtractionMode;
  capability: AiCapability;
  reason: ProviderFailureReason;
  fallbackAllowed: boolean;
}

export class ReviewProviderFailure extends ReviewExtractionFailure {
  readonly metadata: ReviewProviderFailureMetadata;

  constructor(input: {
    status: number;
    error: ReviewError;
    provider: AiProvider;
    mode: ExtractionMode;
    capability: AiCapability;
    reason: ProviderFailureReason;
    fallbackAllowed?: boolean;
  }) {
    super(input.status, input.error);
    this.name = 'ReviewProviderFailure';
    this.metadata = {
      provider: input.provider,
      mode: input.mode,
      capability: input.capability,
      reason: input.reason,
      fallbackAllowed:
        input.fallbackAllowed ??
        fallbackAllowedForProviderFailure({
          kind: input.error.kind,
          reason: input.reason
        })
    };
  }
}

export function isReviewProviderFailure(
  error: unknown
): error is ReviewProviderFailure {
  return error instanceof ReviewProviderFailure;
}

export function normalizeProviderRuntimeFailure(input: {
  error: unknown;
  provider: AiProvider;
  mode: ExtractionMode;
  capability: AiCapability;
}) {
  if (isReviewProviderFailure(input.error)) {
    return input.error;
  }

  if (isReviewExtractionFailure(input.error)) {
    return createReviewProviderFailure({
      status: input.error.status,
      error: input.error.error,
      provider: input.provider,
      mode: input.mode,
      capability: input.capability,
      reason: classifyRuntimeFailureReason(input.error.error.kind)
    });
  }

  return createReviewProviderFailure({
    status: 500,
    error: {
      kind: 'unknown',
      message: 'We could not extract label fields from this upload.',
      retryable: true
    },
    provider: input.provider,
    mode: input.mode,
    capability: input.capability,
    reason: 'response-parse'
  });
}

export function createUnavailableProviderFailure(input: {
  provider: AiProvider;
  capability: AiCapability;
}) {
  const mode = providerMode(input.provider);

  return createReviewProviderFailure({
    status: 503,
    error: {
      kind: 'adapter',
      message:
        mode === 'local'
          ? 'Local extraction is not configured for this environment.'
          : `${formatProviderName(input.provider)} extraction is not configured for this environment.`,
      retryable: false
    },
    provider: input.provider,
    mode,
    capability: input.capability,
    reason: 'provider-not-implemented'
  });
}

export function createReviewProviderFailure(input: {
  status: number;
  error: ReviewError;
  provider: AiProvider;
  mode: ExtractionMode;
  capability: AiCapability;
  reason: ProviderFailureReason;
  fallbackAllowed?: boolean;
}) {
  return new ReviewProviderFailure(input);
}

export function fallbackWindowStillOpen(input: {
  startedAt: number;
  maxRetryableFallbackElapsedMs: number;
}) {
  return performance.now() - input.startedAt <= input.maxRetryableFallbackElapsedMs;
}

export function formatProviderName(provider: AiProvider) {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'gemini':
      return 'Gemini';
    case 'ollama':
      return 'Ollama';
  }
}

function classifyRuntimeFailureReason(kind: ReviewError['kind']): ProviderFailureReason {
  switch (kind) {
    case 'network':
      return 'network-unreachable';
    case 'timeout':
      return 'provider-timeout';
    case 'adapter':
      return 'response-parse';
    default:
      return 'invalid-provider-config';
  }
}
