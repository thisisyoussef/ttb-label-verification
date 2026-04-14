const DEFAULT_TRACING_VALUE = 'false';
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export const DEFAULT_LANGSMITH_PROJECT = 'ttb-label-verification-dev';

export interface LangSmithConfig {
  apiKey?: string;
  endpoint?: string;
  project: string;
  tracingEnabled: boolean;
}

function normalizeOptionalValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseBooleanValue(value: string | undefined, fallback: boolean) {
  const normalized = normalizeOptionalValue(value)?.toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return fallback;
}

export function readLangSmithConfig(
  env: Record<string, string | undefined>
): LangSmithConfig {
  const apiKey =
    normalizeOptionalValue(env.LANGSMITH_API_KEY) ??
    normalizeOptionalValue(env.LANGCHAIN_API_KEY);
  const endpoint =
    normalizeOptionalValue(env.LANGSMITH_ENDPOINT) ??
    normalizeOptionalValue(env.LANGCHAIN_ENDPOINT);
  const project =
    normalizeOptionalValue(env.LANGSMITH_PROJECT) ??
    normalizeOptionalValue(env.LANGCHAIN_PROJECT) ??
    DEFAULT_LANGSMITH_PROJECT;
  const tracingEnabled = parseBooleanValue(
    env.LANGSMITH_TRACING ?? env.LANGCHAIN_TRACING_V2 ?? DEFAULT_TRACING_VALUE,
    false
  );

  return {
    apiKey,
    endpoint,
    project,
    tracingEnabled
  };
}

export function buildLangSmithProcessEnv(
  env: Record<string, string | undefined>
): NodeJS.ProcessEnv {
  const config = readLangSmithConfig(env);
  const nextEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env
  };

  nextEnv.LANGSMITH_PROJECT = config.project;
  nextEnv.LANGCHAIN_PROJECT = config.project;
  nextEnv.LANGSMITH_TRACING = config.tracingEnabled ? 'true' : 'false';
  nextEnv.LANGCHAIN_TRACING_V2 = config.tracingEnabled ? 'true' : 'false';

  if (config.apiKey) {
    nextEnv.LANGSMITH_API_KEY = config.apiKey;
    nextEnv.LANGCHAIN_API_KEY = config.apiKey;
  }

  if (config.endpoint) {
    nextEnv.LANGSMITH_ENDPOINT = config.endpoint;
    nextEnv.LANGCHAIN_ENDPOINT = config.endpoint;
  }

  return nextEnv;
}
