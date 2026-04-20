import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSeedVerificationReport } from '../../shared/contracts/review';

const { runTracedReviewSurfaceMock } = vi.hoisted(() => ({
  runTracedReviewSurfaceMock: vi.fn()
}));

vi.mock('./llm-trace', async () => {
  const actual = await vi.importActual<typeof import('./llm-trace')>('./llm-trace');

  return {
    ...actual,
    runTracedReviewSurface: runTracedReviewSurfaceMock
  };
});

import {
  cleanupTestResources,
  postReview,
  registerServer,
  startServer
} from '../index.test-helpers';

afterEach(async () => {
  runTracedReviewSurfaceMock.mockReset();
  await cleanupTestResources();
});

describe('LLM route extraction mode overrides', () => {
  it('passes an explicit extraction-mode override through the traced review surface', async () => {
    runTracedReviewSurfaceMock.mockResolvedValue(getSeedVerificationReport());
    const extractor = vi.fn();

    const server = await startServer({
      extractor,
      extractionMode: 'local'
    });
    registerServer(server);

    const response = await postReview(server, {
      clientTraceId: 'trace-review-local-001'
    });

    expect(response.status).toBe(200);
    expect(runTracedReviewSurfaceMock).toHaveBeenCalledTimes(1);

    const traceInput = runTracedReviewSurfaceMock.mock.calls[0]?.[0];

    expect(traceInput?.extractionMode).toBe('local');
    expect(traceInput?.clientTraceId).toBe('trace-review-local-001');
  });
});
