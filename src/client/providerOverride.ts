// Developer-only "Provider Override" storage + header injection.
//
// The toolbench lets a developer force review requests onto a specific
// extraction mode without changing server env. We persist the choice in
// localStorage and inject an `X-Provider-Override` header into all review /
// batch / eval requests so the server can pick the matching extractor.
//
// Default behavior: no header is sent and the server picks its configured
// default mode (currently `local`, with cross-mode fallback to cloud on
// retryable failures).

export type ProviderOverrideChoice = 'default' | 'cloud' | 'local';

export const PROVIDER_OVERRIDE_STORAGE_KEY = 'ttb.dev.provider-override';
export const PROVIDER_OVERRIDE_HEADER = 'X-Provider-Override';

export function isProviderOverrideChoice(
  value: unknown
): value is ProviderOverrideChoice {
  return value === 'default' || value === 'cloud' || value === 'local';
}

export function readProviderOverride(): ProviderOverrideChoice {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'default';
  }
  try {
    const raw = window.localStorage.getItem(PROVIDER_OVERRIDE_STORAGE_KEY);
    if (isProviderOverrideChoice(raw)) {
      return raw;
    }
  } catch {
    // localStorage may be denied in some browser contexts; fall through.
  }
  return 'default';
}

export function writeProviderOverride(value: ProviderOverrideChoice): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (value === 'default') {
      window.localStorage.removeItem(PROVIDER_OVERRIDE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PROVIDER_OVERRIDE_STORAGE_KEY, value);
  } catch {
    // localStorage may be denied in some browser contexts; silently ignore.
  }
}

/**
 * Mix the provider-override header into an existing header bag. When the
 * developer override is `default` we return the headers unchanged so
 * normal server routing applies.
 */
export function withProviderOverrideHeader(
  headers: HeadersInit | undefined = {}
): HeadersInit | undefined {
  const override = readProviderOverride();
  if (override === 'default') {
    return headers;
  }

  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.set(PROVIDER_OVERRIDE_HEADER, override);
    return next;
  }

  if (Array.isArray(headers)) {
    return [...headers, [PROVIDER_OVERRIDE_HEADER, override]];
  }

  return {
    ...(headers ?? {}),
    [PROVIDER_OVERRIDE_HEADER]: override
  };
}
