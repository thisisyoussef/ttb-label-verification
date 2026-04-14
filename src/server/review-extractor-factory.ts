import type { ReviewError, ReviewExtraction } from '../shared/contracts/review';
import {
  providerMode,
  readExtractionRoutingPolicy,
  resolveExtractionMode,
  resolveProviderOrder,
  type AiCapability,
  type AiProvider,
  type ExtractionMode
} from './ai-provider-policy';
import {
  createGeminiReviewExtractor,
  readGeminiReviewExtractionConfig
} from './gemini-review-extractor';
import {
  createOpenAIReviewExtractor,
  readReviewExtractionConfig
} from './openai-review-extractor';
import type { NormalizedReviewIntake } from './review-intake';
import {
  type ReviewExtractor,
  type ReviewExtractorContext
} from './review-extraction';
import {
  ReviewProviderFailure,
  createReviewProviderFailure,
  createUnavailableProviderFailure,
  fallbackWindowStillOpen,
  formatProviderName,
  normalizeProviderRuntimeFailure
} from './review-provider-failure';

const DEFAULT_MAX_RETRYABLE_FALLBACK_ELAPSED_MS = 2000;

export interface ReviewExtractorProvider {
  provider: AiProvider;
  supports: (capability: AiCapability) => boolean;
  execute: (
    intake: NormalizedReviewIntake,
    context?: ReviewExtractorContext
  ) => Promise<ReviewExtraction>;
}

type ProviderFactorySuccess = {
  success: true;
  provider: ReviewExtractorProvider;
};

type ProviderFactoryFailure = {
  success: false;
  failure: ReviewProviderFailure;
};

export type ReviewExtractorProviderFactory = (input: {
  env: Record<string, string | undefined>;
  capability: AiCapability;
}) => ProviderFactorySuccess | ProviderFactoryFailure;

export type ReviewExtractorProviderFactories = Partial<
  Record<AiProvider, ReviewExtractorProviderFactory>
>;

type ConfiguredExtractorSuccess = {
  success: true;
  value: {
    extractor: ReviewExtractor;
    extractionMode: ExtractionMode;
    providers: AiProvider[];
  };
};

type ConfiguredExtractorFailure = {
  success: false;
  extractionMode?: ExtractionMode;
  status: number;
  error: ReviewError;
};

export type ConfiguredReviewExtractorResult =
  | ConfiguredExtractorSuccess
  | ConfiguredExtractorFailure;

const DEFAULT_PROVIDER_FACTORIES: ReviewExtractorProviderFactories = {
  gemini: createGeminiReviewExtractorProvider,
  openai: createOpenAiReviewExtractorProvider
};

export { ReviewProviderFailure } from './review-provider-failure';
export type { ReviewProviderFailureMetadata } from './review-provider-failure';

export function createConfiguredReviewExtractor(input: {
  env: Record<string, string | undefined>;
  capability?: AiCapability;
  requestedMode?: ExtractionMode;
  providers?: ReviewExtractorProviderFactories;
  maxRetryableFallbackElapsedMs?: number;
}): ConfiguredReviewExtractorResult {
  const capability = input.capability ?? 'label-extraction';
  const maxRetryableFallbackElapsedMs =
    input.maxRetryableFallbackElapsedMs ??
    DEFAULT_MAX_RETRYABLE_FALLBACK_ELAPSED_MS;
  const policyResult = readExtractionRoutingPolicy(input.env);
  if (!policyResult.success) {
    return policyResult;
  }

  const modeResult = resolveExtractionMode({
    policy: policyResult.value,
    requestedMode: input.requestedMode
  });
  if (!modeResult.success) {
    return {
      success: false,
      extractionMode: input.requestedMode ?? policyResult.value.defaultMode,
      status: modeResult.status,
      error: modeResult.error
    };
  }

  const extractionMode = modeResult.value;
  const providerOrder = resolveProviderOrder({
    policy: policyResult.value,
    mode: extractionMode,
    capability
  });
  const providerFactories = {
    ...DEFAULT_PROVIDER_FACTORIES,
    ...input.providers
  } satisfies ReviewExtractorProviderFactories;

  const availableProviders: ReviewExtractorProvider[] = [];
  let firstHardFailure: ReviewProviderFailure | undefined;
  let lastFailure: ReviewProviderFailure | undefined;

  for (const providerName of providerOrder) {
    const providerResult = resolveConfiguredProvider({
      env: input.env,
      capability,
      provider: providerName,
      providers: providerFactories
    });

    if (!providerResult.success) {
      lastFailure = providerResult.failure;
      if (!firstHardFailure && !providerResult.failure.metadata.fallbackAllowed) {
        firstHardFailure = providerResult.failure;
      }
      continue;
    }

    availableProviders.push(providerResult.provider);
  }

  if (availableProviders.length === 0) {
    const failure =
      firstHardFailure ??
      lastFailure ??
      createUnavailableProviderFailure({
        provider: providerOrder[0] ?? 'openai',
        capability
      });

    return {
      success: false,
      extractionMode,
      status: failure.status,
      error: failure.error
    };
  }

  return {
    success: true,
    value: {
      extractor: async (intake, context) => {
        const latencyCapture = context?.latencyCapture;
        latencyCapture?.setProviderOrder(
          availableProviders.map((provider) => provider.provider)
        );
        latencyCapture?.recordSpan({
          stage: 'provider-selection',
          outcome: 'success',
          durationMs: 0
        });

        let lastProviderFailure: ReviewProviderFailure | undefined;

        for (const [index, provider] of availableProviders.entries()) {
          const attempt = index === 0 ? 'primary' : 'fallback';
          const attemptStartedAt = performance.now();

          try {
            const extraction = await provider.execute(intake, {
              ...context,
              latencyCapture,
              latencyAttempt: attempt
            });

            if (attempt === 'primary') {
              latencyCapture?.recordSpan({
                stage: 'fallback-handoff',
                provider: availableProviders[1]?.provider,
                attempt: 'fallback',
                outcome: 'skipped',
                durationMs: 0
              });
              latencyCapture?.setOutcomePath('primary-success');
            } else {
              latencyCapture?.setOutcomePath('fast-fail-fallback-success');
            }

            return extraction;
          } catch (error) {
            const providerFailure = normalizeProviderRuntimeFailure({
              error,
              provider: provider.provider,
              mode: extractionMode,
              capability
            });

            lastProviderFailure = providerFailure;
            const nextProvider = availableProviders[index + 1]?.provider;
            const fallbackWindowOpen = fallbackWindowStillOpen({
              startedAt: attemptStartedAt,
              maxRetryableFallbackElapsedMs
            });

            if (!providerFailure.metadata.fallbackAllowed || !nextProvider) {
              latencyCapture?.recordSpan({
                stage: 'fallback-handoff',
                provider: nextProvider,
                attempt: 'fallback',
                outcome: 'skipped',
                durationMs: 0
              });
              latencyCapture?.setOutcomePath(
                attempt === 'primary' ? 'primary-hard-fail' : 'fallback-failure'
              );
              throw providerFailure;
            }

            if (!fallbackWindowOpen) {
              latencyCapture?.recordSpan({
                stage: 'fallback-handoff',
                provider: nextProvider,
                attempt: 'fallback',
                outcome: 'late-fail',
                durationMs: 0
              });
              latencyCapture?.setOutcomePath('late-fail-retryable');
              throw providerFailure;
            }

            latencyCapture?.recordSpan({
              stage: 'fallback-handoff',
              provider: nextProvider,
              attempt: 'fallback',
              outcome: 'success',
              durationMs: 0
            });
          }
        }

        if (lastProviderFailure) {
          latencyCapture?.setOutcomePath('fallback-failure');
          throw lastProviderFailure;
        }

        latencyCapture?.setOutcomePath('pre-provider-failure');
        throw createUnavailableProviderFailure({
          provider: availableProviders[0]?.provider ?? 'openai',
          capability
        });
      },
      extractionMode,
      providers: availableProviders.map((provider) => provider.provider)
    }
  };
}

function resolveConfiguredProvider(input: {
  env: Record<string, string | undefined>;
  capability: AiCapability;
  provider: AiProvider;
  providers: ReviewExtractorProviderFactories;
}): ProviderFactorySuccess | ProviderFactoryFailure {
  const providerFactory = input.providers[input.provider];
  if (!providerFactory) {
    return {
      success: false,
      failure: createUnavailableProviderFailure({
        provider: input.provider,
        capability: input.capability
      })
    };
  }

  const providerResult = providerFactory({
    env: input.env,
    capability: input.capability
  });
  if (!providerResult.success) {
    return providerResult;
  }

  if (!providerResult.provider.supports(input.capability)) {
    return {
      success: false,
      failure: createReviewProviderFailure({
        status: 503,
        error: {
          kind: 'adapter',
          message: `${formatProviderName(input.provider)} does not support ${input.capability} in this environment yet.`,
          retryable: false
        },
        provider: input.provider,
        mode: providerMode(input.provider),
        capability: input.capability,
        reason: 'unsupported-capability'
      })
    };
  }

  return providerResult;
}

function createGeminiReviewExtractorProvider(input: {
  env: Record<string, string | undefined>;
  capability: AiCapability;
}): ProviderFactorySuccess | ProviderFactoryFailure {
  const configResult = readGeminiReviewExtractionConfig(input.env);
  if (!configResult.success) {
    return {
      success: false,
      failure: createReviewProviderFailure({
        status: configResult.status,
        error: configResult.error,
        provider: 'gemini',
        mode: 'cloud',
        capability: input.capability,
        reason: classifyGeminiConfigFailure(input.env)
      })
    };
  }

  const extractor = createGeminiReviewExtractor({
    config: configResult.value
  });

  return {
    success: true,
    provider: {
      provider: 'gemini',
      supports: (capability) => capability === 'label-extraction',
      execute: (intake, context) => extractor(intake, context)
    }
  };
}

function createOpenAiReviewExtractorProvider(input: {
  env: Record<string, string | undefined>;
  capability: AiCapability;
}): ProviderFactorySuccess | ProviderFactoryFailure {
  const configResult = readReviewExtractionConfig(input.env);
  if (!configResult.success) {
    return {
      success: false,
      failure: createReviewProviderFailure({
        status: configResult.status,
        error: configResult.error,
        provider: 'openai',
        mode: 'cloud',
        capability: input.capability,
        reason: classifyOpenAiConfigFailure(input.env)
      })
    };
  }

  const extractor = createOpenAIReviewExtractor({
    config: configResult.value
  });

  return {
    success: true,
    provider: {
      provider: 'openai',
      supports: (capability) => capability === 'label-extraction',
      execute: (intake, context) => extractor(intake, context)
    }
  };
}

function classifyGeminiConfigFailure(env: Record<string, string | undefined>) {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return 'missing-configuration' as const;
  }

  return 'invalid-provider-config' as const;
}

function classifyOpenAiConfigFailure(env: Record<string, string | undefined>) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return 'missing-configuration' as const;
  }

  const storeValue = env.OPENAI_STORE?.trim().toLowerCase();
  if (storeValue && storeValue !== 'false') {
    return 'privacy-boundary' as const;
  }

  return 'invalid-provider-config' as const;
}
