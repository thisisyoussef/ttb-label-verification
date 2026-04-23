import { describe, expect, it } from 'vitest';

import { createReviewLatencyCapture } from './review-latency';

describe('review latency capture', () => {
  it('records ordered safe spans and derives fallback metadata', () => {
    const capture = createReviewLatencyCapture({
      surface: '/api/review/extraction',
      clientTraceId: 'latency-trace-001',
      fixtureId: 'fixture-fast-fallback-001',
      firstResultBudgetMs: 8_000
    });

    capture.setProviderOrder(['gemini', 'openai']);
    capture.recordSpan({
      stage: 'intake-parse',
      outcome: 'success',
      durationMs: 8
    });
    capture.recordSpan({
      stage: 'intake-normalization',
      outcome: 'success',
      durationMs: 4
    });
    capture.recordSpan({
      stage: 'provider-selection',
      outcome: 'success',
      durationMs: 1
    });
    capture.recordSpan({
      stage: 'request-assembly',
      provider: 'gemini',
      attempt: 'primary',
      outcome: 'success',
      durationMs: 6
    });
    capture.recordSpan({
      stage: 'provider-wait',
      provider: 'gemini',
      attempt: 'primary',
      outcome: 'fast-fail',
      durationMs: 40
    });
    capture.recordSpan({
      stage: 'fallback-handoff',
      provider: 'openai',
      attempt: 'fallback',
      outcome: 'success',
      durationMs: 1
    });
    capture.recordSpan({
      stage: 'request-assembly',
      provider: 'openai',
      attempt: 'fallback',
      outcome: 'success',
      durationMs: 5
    });
    capture.recordSpan({
      stage: 'provider-wait',
      provider: 'openai',
      attempt: 'fallback',
      outcome: 'success',
      durationMs: 31
    });
    capture.setOutcomePath('fast-fail-fallback-success');

    const summary = capture.finalize();

    expect(summary.surface).toBe('/api/review/extraction');
    expect(summary.outcomePath).toBe('fast-fail-fallback-success');
    expect(summary.fallbackAttempted).toBe(true);
    expect(summary.providerOrder).toEqual(['gemini', 'openai']);
    expect(summary.clientTraceId).toBe('latency-trace-001');
    expect(summary.fixtureId).toBe('fixture-fast-fallback-001');
    expect(summary.firstResultBudgetMs).toBe(8_000);
    expect(summary.spans.map((span) => span.stage)).toEqual([
      'intake-parse',
      'intake-normalization',
      'provider-selection',
      'request-assembly',
      'provider-wait',
      'fallback-handoff',
      'request-assembly',
      'provider-wait'
    ]);
    expect(summary.spans.filter((span) => span.attempt === 'fallback')).toHaveLength(3);
    expect(JSON.stringify(summary)).not.toContain('label.png');
    expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});
