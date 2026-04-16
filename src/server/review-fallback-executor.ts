import type { AiProvider, ExtractionMode } from './ai-provider-policy';
import type { ReviewExtraction } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import type { ReviewExtractorContext } from './review-extraction';
import type { ReviewLatencyCapture } from './review-latency';
import type { ReviewExtractorProvider } from './review-provider-registry';
import {
  createUnavailableProviderFailure,
  fallbackWindowStillOpen,
  normalizeProviderRuntimeFailure
} from './review-provider-failure';

export function createFallbackExtractor(input: {
  providers: ReviewExtractorProvider[];
  extractionMode: ExtractionMode;
  maxRetryableFallbackElapsedMs: number;
}) {
  return async (
    intake: NormalizedReviewIntake,
    context?: ReviewExtractorContext
  ): Promise<ReviewExtraction> => {
    const extractorStartedAt = performance.now();
    const latencyCapture = context?.latencyCapture;
    latencyCapture?.setProviderOrder(input.providers.map((p) => p.provider));
    latencyCapture?.recordSpan({ stage: 'provider-selection', outcome: 'success', durationMs: 0 });

    let lastProviderFailure: ReturnType<typeof normalizeProviderRuntimeFailure> | undefined;

    for (const [index, provider] of input.providers.entries()) {
      const attempt = index === 0 ? 'primary' : 'fallback';
      try {
        const extraction = await provider.execute(intake, { ...context, latencyCapture, latencyAttempt: attempt });
        if (attempt === 'primary') {
          recordSpan(latencyCapture, input.providers[1]?.provider, 'skipped');
          latencyCapture?.setOutcomePath('primary-success');
        } else {
          latencyCapture?.setOutcomePath('fast-fail-fallback-success');
        }
        return extraction;
      } catch (error) {
        const providerFailure = normalizeProviderRuntimeFailure({
          error, provider: provider.provider, mode: input.extractionMode, capability: 'label-extraction'
        });
        lastProviderFailure = providerFailure;
        const nextProvider = input.providers[index + 1]?.provider;
        const fallbackWindowOpen = fallbackWindowStillOpen({
          elapsedMs: latencyCapture?.getElapsedMs() ?? performance.now() - extractorStartedAt,
          maxRetryableFallbackElapsedMs: input.maxRetryableFallbackElapsedMs
        });
        if (!providerFailure.metadata.fallbackAllowed || !nextProvider) {
          recordSpan(latencyCapture, nextProvider, 'skipped');
          latencyCapture?.setOutcomePath(attempt === 'primary' ? 'primary-hard-fail' : 'fallback-failure');
          throw providerFailure;
        }
        if (!fallbackWindowOpen) {
          recordSpan(latencyCapture, nextProvider, 'late-fail');
          latencyCapture?.setOutcomePath('late-fail-retryable');
          throw providerFailure;
        }
        recordSpan(latencyCapture, nextProvider, 'success');
      }
    }

    if (lastProviderFailure) { latencyCapture?.setOutcomePath('fallback-failure'); throw lastProviderFailure; }
    latencyCapture?.setOutcomePath('pre-provider-failure');
    throw createUnavailableProviderFailure({ provider: input.providers[0]?.provider ?? 'openai', capability: 'label-extraction' });
  };
}

function recordSpan(
  latencyCapture: ReviewLatencyCapture | undefined,
  nextProvider: AiProvider | undefined,
  outcome: 'skipped' | 'success' | 'late-fail'
) {
  latencyCapture?.recordSpan({ stage: 'fallback-handoff', provider: nextProvider, attempt: 'fallback', outcome, durationMs: 0 });
}
