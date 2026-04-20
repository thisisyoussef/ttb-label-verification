import type { ReviewError, ReviewErrorKind } from '../../shared/contracts/review';

export const AI_CAPABILITIES = [
  'label-extraction',
  'structured-text',
  'embeddings'
] as const;
export const EXTRACTION_MODES = ['cloud', 'local'] as const;
export const AI_PROVIDERS = [
  'openai',
  'gemini',
  'ollama',
  'ollama-vlm',
  'transformers'
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];
export type ExtractionMode = (typeof EXTRACTION_MODES)[number];
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_EXTRACTION_MODE: ExtractionMode = 'cloud';

const DEFAULT_CLOUD_PROVIDER_ORDER: readonly AiProvider[] = ['openai', 'gemini'];
const DEFAULT_LABEL_EXTRACTION_PROVIDER_ORDER: readonly AiProvider[] = ['gemini', 'openai'];
const DEFAULT_LOCAL_PROVIDER_ORDER: readonly AiProvider[] = [
  'ollama-vlm',
  'transformers',
  'ollama'
];
const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off']);

export type ProviderFailureReason =
  | 'cross-mode-boundary'
  | 'invalid-provider-config'
  | 'missing-configuration'
  | 'network-unreachable'
  | 'privacy-boundary'
  | 'provider-not-implemented'
  | 'provider-timeout'
  | 'response-parse'
  | 'unsupported-capability';

export interface ExtractionRoutingPolicy {
  defaultMode: ExtractionMode;
  allowLocal: boolean;
  capabilityOrders: Record<AiCapability, readonly AiProvider[]>;
  localCapabilityOrders: Record<AiCapability, readonly AiProvider[]>;
}

type Success<T> = {
  success: true;
  value: T;
};

type Failure = {
  success: false;
  status: number;
  error: ReviewError;
};

export type ExtractionRoutingPolicyResult = Success<ExtractionRoutingPolicy> | Failure;
export type ExtractionModeResult = Success<ExtractionMode> | Failure;

export function fallbackAllowedForProviderFailure(input: {
  kind: ReviewErrorKind;
  reason: ProviderFailureReason;
}) {
  if (
    input.reason === 'missing-configuration' ||
    input.reason === 'network-unreachable' ||
    input.reason === 'provider-timeout' ||
    input.reason === 'response-parse'
  ) {
    return true;
  }

  return false;
}

export function readExtractionRoutingPolicy(
  env: Record<string, string | undefined>
): ExtractionRoutingPolicyResult {
  // Convenience: AI_PROVIDER=local is shorthand for "run everything local".
  // When set, it OVERRIDES AI_EXTRACTION_MODE_DEFAULT and
  // AI_EXTRACTION_MODE_ALLOW_LOCAL so a workstation with a cloud-default
  // .env can still opt into full-local mode for a single run without
  // editing the file.
  const aiProvider = env.AI_PROVIDER?.trim().toLowerCase();
  const aiProviderIsLocal =
    aiProvider === 'local' ||
    aiProvider === 'ollama' ||
    aiProvider === 'ollama-vlm';

  const defaultModeResult = aiProviderIsLocal
    ? ({ success: true, value: 'local' } as const)
    : parseExtractionModeValue(
        env.AI_EXTRACTION_MODE_DEFAULT,
        DEFAULT_EXTRACTION_MODE
      );
  if (!defaultModeResult.success) {
    return defaultModeResult;
  }

  const allowLocalResult = aiProviderIsLocal
    ? ({ success: true, value: true } as const)
    : parseBooleanValue({
        rawValue: env.AI_EXTRACTION_MODE_ALLOW_LOCAL,
        key: 'AI_EXTRACTION_MODE_ALLOW_LOCAL',
        fallbackValue: false
      });
  if (!allowLocalResult.success) {
    return allowLocalResult;
  }

  if (defaultModeResult.value === 'local' && !allowLocalResult.value) {
    return createAdapterFailure({
      status: 500,
      message:
        'AI_EXTRACTION_MODE_DEFAULT=local requires AI_EXTRACTION_MODE_ALLOW_LOCAL=true.'
    });
  }

  const defaultOrderResult = parseProviderOrder({
    rawValue: env.AI_CAPABILITY_DEFAULT_ORDER,
    key: 'AI_CAPABILITY_DEFAULT_ORDER',
    fallbackValue: DEFAULT_CLOUD_PROVIDER_ORDER
  });
  if (!defaultOrderResult.success) {
    return defaultOrderResult;
  }

  const labelExtractionOrderResult = parseProviderOrder({
    rawValue: env.AI_CAPABILITY_LABEL_EXTRACTION_ORDER,
    key: 'AI_CAPABILITY_LABEL_EXTRACTION_ORDER',
    fallbackValue: DEFAULT_LABEL_EXTRACTION_PROVIDER_ORDER
  });
  if (!labelExtractionOrderResult.success) {
    return labelExtractionOrderResult;
  }

  return {
    success: true,
    value: {
      defaultMode: defaultModeResult.value,
      allowLocal: allowLocalResult.value,
      capabilityOrders: {
        'label-extraction': labelExtractionOrderResult.value,
        'structured-text': defaultOrderResult.value,
        embeddings: defaultOrderResult.value
      },
      localCapabilityOrders: {
        'label-extraction': DEFAULT_LOCAL_PROVIDER_ORDER,
        'structured-text': DEFAULT_LOCAL_PROVIDER_ORDER,
        embeddings: DEFAULT_LOCAL_PROVIDER_ORDER
      }
    }
  };
}

export function resolveExtractionMode(input: {
  policy: ExtractionRoutingPolicy;
  requestedMode?: ExtractionMode;
}): ExtractionModeResult {
  const requestedMode = input.requestedMode ?? input.policy.defaultMode;

  if (requestedMode === 'local' && !input.policy.allowLocal) {
    return createAdapterFailure({
      status: 503,
      message: 'Local mode is not available on this workstation.'
    });
  }

  return {
    success: true,
    value: requestedMode
  };
}

export function resolveProviderOrder(input: {
  policy: ExtractionRoutingPolicy;
  mode: ExtractionMode;
  capability: AiCapability;
}) {
  return input.mode === 'local'
    ? input.policy.localCapabilityOrders[input.capability]
    : input.policy.capabilityOrders[input.capability];
}

export function providerMode(provider: AiProvider): ExtractionMode {
  return provider === 'ollama' ||
    provider === 'ollama-vlm' ||
    provider === 'transformers'
    ? 'local'
    : 'cloud';
}

function parseExtractionModeValue(
  rawValue: string | undefined,
  fallbackValue: ExtractionMode
): Success<ExtractionMode> | Failure {
  const normalizedValue = rawValue?.trim().toLowerCase();
  if (!normalizedValue) {
    return {
      success: true,
      value: fallbackValue
    };
  }

  if (normalizedValue === 'cloud' || normalizedValue === 'local') {
    return {
      success: true,
      value: normalizedValue
    };
  }

  return createAdapterFailure({
    status: 500,
    message: 'AI_EXTRACTION_MODE_DEFAULT must be cloud or local.'
  });
}

function parseBooleanValue(input: {
  rawValue: string | undefined;
  key: string;
  fallbackValue: boolean;
}): Success<boolean> | Failure {
  const normalizedValue = input.rawValue?.trim().toLowerCase();
  if (!normalizedValue) {
    return {
      success: true,
      value: input.fallbackValue
    };
  }

  if (TRUTHY_VALUES.has(normalizedValue)) {
    return {
      success: true,
      value: true
    };
  }

  if (FALSY_VALUES.has(normalizedValue)) {
    return {
      success: true,
      value: false
    };
  }

  return createAdapterFailure({
    status: 500,
    message: `${input.key} must be true or false.`
  });
}

function parseProviderOrder(input: {
  rawValue: string | undefined;
  key: string;
  fallbackValue: readonly AiProvider[];
}): Success<readonly AiProvider[]> | Failure {
  const normalizedValue = input.rawValue?.trim();
  if (!normalizedValue) {
    return {
      success: true,
      value: input.fallbackValue
    };
  }

  const providers = normalizedValue
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => provider.length > 0);
  if (providers.length === 0) {
    return createAdapterFailure({
      status: 500,
      message: `${input.key} must list at least one provider.`
    });
  }

  const seenProviders = new Set<AiProvider>();
  const orderedProviders: AiProvider[] = [];

  for (const provider of providers) {
    if (!isAiProvider(provider)) {
      return createAdapterFailure({
        status: 500,
        message: `${input.key} contains unknown provider "${provider}".`
      });
    }

    if (seenProviders.has(provider)) {
      return createAdapterFailure({
        status: 500,
        message: `${input.key} contains duplicate provider "${provider}".`
      });
    }

    seenProviders.add(provider);
    orderedProviders.push(provider);
  }

  return {
    success: true,
    value: orderedProviders
  };
}

function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDERS.some((provider) => provider === value);
}

function createAdapterFailure(input: {
  status: number;
  message: string;
}): Failure {
  return {
    success: false,
    status: input.status,
    error: {
      kind: 'adapter',
      message: input.message,
      retryable: false
    }
  };
}
