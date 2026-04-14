import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXTRACTION_MODE,
  fallbackAllowedForProviderFailure,
  readExtractionRoutingPolicy,
  resolveExtractionMode,
  resolveProviderOrder
} from './ai-provider-policy';

describe('AI provider policy', () => {
  it('loads the default cloud routing policy with capability-specific orders', () => {
    const result = readExtractionRoutingPolicy({});

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected provider policy to load.');
    }

    expect(result.value.defaultMode).toBe(DEFAULT_EXTRACTION_MODE);
    expect(result.value.allowLocal).toBe(false);
    expect(
      resolveProviderOrder({
        policy: result.value,
        mode: 'cloud',
        capability: 'label-extraction'
      })
    ).toEqual(['openai']);
    expect(
      resolveProviderOrder({
        policy: result.value,
        mode: 'cloud',
        capability: 'structured-text'
      })
    ).toEqual(['openai', 'gemini']);
    expect(
      resolveProviderOrder({
        policy: result.value,
        mode: 'local',
        capability: 'label-extraction'
      })
    ).toEqual(['ollama']);
  });

  it('rejects unknown or duplicate providers in env ordering', () => {
    const duplicate = readExtractionRoutingPolicy({
      AI_CAPABILITY_LABEL_EXTRACTION_ORDER: 'openai,openai'
    });
    const unknown = readExtractionRoutingPolicy({
      AI_CAPABILITY_DEFAULT_ORDER: 'openai,not-a-provider'
    });

    expect(duplicate.success).toBe(false);
    if (duplicate.success) {
      throw new Error('Expected duplicate provider config to fail.');
    }

    expect(duplicate.status).toBe(500);
    expect(duplicate.error.kind).toBe('adapter');
    expect(duplicate.error.message).toContain('duplicate provider');

    expect(unknown.success).toBe(false);
    if (unknown.success) {
      throw new Error('Expected unknown provider config to fail.');
    }

    expect(unknown.status).toBe(500);
    expect(unknown.error.kind).toBe('adapter');
    expect(unknown.error.message).toContain('unknown provider');
  });

  it('requires local mode to be explicitly enabled', () => {
    const policyResult = readExtractionRoutingPolicy({});

    expect(policyResult.success).toBe(true);
    if (!policyResult.success) {
      throw new Error('Expected provider policy to load.');
    }

    const disabledLocal = resolveExtractionMode({
      policy: policyResult.value,
      requestedMode: 'local'
    });

    expect(disabledLocal.success).toBe(false);
    if (disabledLocal.success) {
      throw new Error('Expected local mode override to fail.');
    }

    expect(disabledLocal.status).toBe(503);
    expect(disabledLocal.error.retryable).toBe(false);
    expect(disabledLocal.error.message).toContain('Local extraction mode');
  });

  it('allows explicit local mode once the env gate is enabled', () => {
    const policyResult = readExtractionRoutingPolicy({
      AI_EXTRACTION_MODE_ALLOW_LOCAL: 'true'
    });

    expect(policyResult.success).toBe(true);
    if (!policyResult.success) {
      throw new Error('Expected provider policy to load.');
    }

    const localMode = resolveExtractionMode({
      policy: policyResult.value,
      requestedMode: 'local'
    });

    expect(localMode).toEqual({
      success: true,
      value: 'local'
    });
  });

  it('fails closed for privacy and unsupported-capability errors, but allows network fallback', () => {
    expect(
      fallbackAllowedForProviderFailure({
        kind: 'network',
        reason: 'network-unreachable'
      })
    ).toBe(true);
    expect(
      fallbackAllowedForProviderFailure({
        kind: 'timeout',
        reason: 'provider-timeout'
      })
    ).toBe(true);
    expect(
      fallbackAllowedForProviderFailure({
        kind: 'adapter',
        reason: 'privacy-boundary'
      })
    ).toBe(false);
    expect(
      fallbackAllowedForProviderFailure({
        kind: 'adapter',
        reason: 'unsupported-capability'
      })
    ).toBe(false);
  });
});
