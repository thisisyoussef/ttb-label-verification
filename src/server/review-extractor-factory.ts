import type { ReviewError, ReviewExtraction } from '../shared/contracts/review';
import {
  fallbackAllowedForProviderFailure,
  providerMode,
  readExtractionRoutingPolicy,
  resolveExtractionMode,
  resolveProviderOrder,
  type AiCapability,
  type AiProvider,
  type ExtractionMode,
  type ProviderFailureReason
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
  ReviewExtractionFailure,
  isReviewExtractionFailure,
  type ReviewExtractor
} from './review-extraction';

const DEFAULT_MAX_RETRYABLE_FALLBACK_ELAPSED_MS = 2000;

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

export interface ReviewExtractorProvider {
  provider: AiProvider;
  supports: (capability: AiCapability) => boolean;
  execute: (intake: NormalizedReviewIntake) => Promise<ReviewExtraction>;
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
      extractor: async (intake) => {
        let lastProviderFailure: ReviewProviderFailure | undefined;

        for (const provider of availableProviders) {
          const startedAt = Date.now();

          try {
            return await provider.execute(intake);
          } catch (error) {
            const providerFailure = normalizeProviderRuntimeFailure({
              error,
              provider: provider.provider,
              mode: extractionMode,
              capability
            });

            lastProviderFailure = providerFailure;
            if (
              !providerFailure.metadata.fallbackAllowed ||
              !fallbackWindowStillOpen({
                startedAt,
                maxRetryableFallbackElapsedMs
              })
            ) {
              throw providerFailure;
            }
          }
        }

        if (lastProviderFailure) {
          throw lastProviderFailure;
        }

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

export function isReviewProviderFailure(
  error: unknown
): error is ReviewProviderFailure {
  return error instanceof ReviewProviderFailure;
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
      execute: (intake) => extractor(intake)
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
      execute: (intake) => extractor(intake)
    }
  };
}

function normalizeProviderRuntimeFailure(input: {
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

function createUnavailableProviderFailure(input: {
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

function createReviewProviderFailure(input: {
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

function fallbackWindowStillOpen(input: {
  startedAt: number;
  maxRetryableFallbackElapsedMs: number;
}) {
  return Date.now() - input.startedAt <= input.maxRetryableFallbackElapsedMs;
}

function formatProviderName(provider: AiProvider) {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'gemini':
      return 'Gemini';
    case 'ollama':
      return 'Ollama';
  }
}
