import { afterEach, describe, expect, it, vi } from 'vitest';

const { runOcrPrepass, isOcrPrepassEnabled } = vi.hoisted(() => ({
  runOcrPrepass: vi.fn(),
  isOcrPrepassEnabled: vi.fn(() => true)
}));

vi.mock('../extractors/ocr-prepass', () => ({
  runOcrPrepass,
  isOcrPrepassEnabled
}));

import { reviewRelevanceResultSchema } from '../../shared/contracts/review';
import {
  buildLabelFile,
  cleanupTestResources,
  registerServer,
  serverUrl,
  startServer,
  validReviewFields
} from '../index.test-helpers';

afterEach(() => {
  runOcrPrepass.mockReset();
  isOcrPrepassEnabled.mockReset();
  isOcrPrepassEnabled.mockReturnValue(true);
});

afterEach(cleanupTestResources);

async function postReviewRelevance(
  server: { address: () => import('node:net').AddressInfo | string | null },
  files: File[]
) {
  const form = new FormData();
  files.forEach((file) => form.append('label', file));
  form.append('fields', JSON.stringify(validReviewFields()));

  return await fetch(serverUrl(server, '/api/review/relevance'), {
    method: 'POST',
    body: form
  });
}

describe('/api/review/relevance', () => {
  it('returns a likely-label decision without invoking the extractor', async () => {
    runOcrPrepass.mockResolvedValue({
      status: 'ok',
      text: [
        'STONE RIDGE BOURBON',
        '45% Alc./Vol.',
        '750 mL'
      ].join('\n'),
      durationMs: 42,
      preprocessingApplied: ['normalize']
    });

    const extractor = vi.fn();
    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReviewRelevance(server, [buildLabelFile()]);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Stage-Timings')).toContain('relevance-preflight=');
    const payload = reviewRelevanceResultSchema.parse(await response.json());
    expect(payload.decision).toBe('likely-label');
    expect(payload.shouldPrefetchExtraction).toBe(true);
    expect(extractor).not.toHaveBeenCalled();
  });

  it('merges signals from a second uploaded image before deciding', async () => {
    runOcrPrepass
      .mockResolvedValueOnce({
        status: 'ok',
        text: 'STONE RIDGE',
        durationMs: 21,
        preprocessingApplied: []
      })
      .mockResolvedValueOnce({
        status: 'ok',
        text: [
          'BOURBON',
          '45% Alc./Vol.',
          '750 mL'
        ].join('\n'),
        durationMs: 25,
        preprocessingApplied: []
      });

    const server = await startServer({ extractor: vi.fn() });
    registerServer(server);

    const response = await postReviewRelevance(server, [
      buildLabelFile({ name: 'front.png' }),
      buildLabelFile({ name: 'back.png' })
    ]);

    expect(response.status).toBe(200);
    const payload = reviewRelevanceResultSchema.parse(await response.json());
    expect(payload.decision).toBe('likely-label');
    expect(payload.signals.scannedImageCount).toBe(2);
    expect(runOcrPrepass).toHaveBeenCalledTimes(2);
  });
});
