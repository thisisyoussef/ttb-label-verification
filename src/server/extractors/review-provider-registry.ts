import type { AiCapability, AiProvider } from '../llm/ai-provider-policy';
import { providerMode } from '../llm/ai-provider-policy';
import {
  createGeminiReviewExtractor,
  readGeminiReviewExtractionConfig
} from './gemini-review-extractor';
import {
  createOpenAIReviewExtractor,
  readReviewExtractionConfig
} from './openai-review-extractor';
import {
  createTransformersReviewExtractor,
  readTransformersReviewExtractionConfig
} from './transformers-review-extractor';
import { createTransformersInferenceFn } from './transformers-model-loader';
import type { NormalizedReviewIntake } from '../review/review-intake';
import type { ReviewExtractorContext } from './review-extraction';
import type { ReviewExtraction } from '../../shared/contracts/review';
import {
  ReviewProviderFailure,
  createReviewProviderFailure,
  createUnavailableProviderFailure
} from './review-provider-failure';

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

export type ProviderFactoryResult = ProviderFactorySuccess | ProviderFactoryFailure;

export type ReviewExtractorProviderFactory = (input: {
  env: Record<string, string | undefined>;
  capability: AiCapability;
}) => ProviderFactoryResult;

export type ReviewExtractorProviderFactories = Partial<
  Record<AiProvider, ReviewExtractorProviderFactory>
>;

export const DEFAULT_PROVIDER_FACTORIES: ReviewExtractorProviderFactories = {
  gemini: createGeminiReviewExtractorProvider,
  openai: createOpenAiReviewExtractorProvider,
  transformers: createTransformersReviewExtractorProvider
};

export function resolveConfiguredProvider(input: {
  env: Record<string, string | undefined>;
  capability: AiCapability;
  provider: AiProvider;
  providers: ReviewExtractorProviderFactories;
}): ProviderFactoryResult {
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
          message: 'This type of label check is not available on this workstation yet.',
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
}): ProviderFactoryResult {
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

  const extractor = createGeminiReviewExtractor({ config: configResult.value });
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
}): ProviderFactoryResult {
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

  const extractor = createOpenAIReviewExtractor({ config: configResult.value });
  return {
    success: true,
    provider: {
      provider: 'openai',
      supports: (capability) => capability === 'label-extraction',
      execute: (intake, context) => extractor(intake, context)
    }
  };
}

function createTransformersReviewExtractorProvider(input: {
  env: Record<string, string | undefined>;
  capability: AiCapability;
}): ProviderFactoryResult {
  const configResult = readTransformersReviewExtractionConfig(input.env);
  if (!configResult.success) {
    return {
      success: false,
      failure: createReviewProviderFailure({
        status: configResult.status,
        error: configResult.error,
        provider: 'transformers',
        mode: 'local',
        capability: input.capability,
        reason: 'invalid-provider-config'
      })
    };
  }

  const extractor = createTransformersReviewExtractor({
    config: configResult.value,
    inferenceFn: createTransformersInferenceFn(configResult.value)
  });
  return {
    success: true,
    provider: {
      provider: 'transformers',
      supports: (capability) => capability === 'label-extraction',
      execute: (intake, context) => extractor(intake, context)
    }
  };
}

function classifyGeminiConfigFailure(env: Record<string, string | undefined>) {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return 'missing-configuration' as const;
  return 'invalid-provider-config' as const;
}

function classifyOpenAiConfigFailure(env: Record<string, string | undefined>) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return 'missing-configuration' as const;
  const storeValue = env.OPENAI_STORE?.trim().toLowerCase();
  if (storeValue && storeValue !== 'false') return 'privacy-boundary' as const;
  return 'invalid-provider-config' as const;
}
