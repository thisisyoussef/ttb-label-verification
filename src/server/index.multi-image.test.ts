import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildExtractionPayload,
  buildLabelFile,
  cleanupTestResources,
  postReview,
  registerServer,
  startServer,
  validReviewFields
} from './index.test-helpers';

afterEach(cleanupTestResources);

describe('server multi-image review route', () => {
  it(
    'accepts up to two label images on the review route and forwards both to extraction',
    async () => {
      const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
      const server = await startServer({ extractor });
      registerServer(server);

      const response = await postReview(server, {
        files: [
          buildLabelFile({ name: 'front.png', type: 'image/png' }),
          buildLabelFile({ name: 'back.png', type: 'image/png' })
        ],
        fields: JSON.stringify(validReviewFields())
      });

      expect(response.status).toBe(200);
      expect(extractor).toHaveBeenCalledTimes(1);
      expect(extractor).toHaveBeenCalledWith(
        expect.objectContaining({
          label: expect.objectContaining({ originalName: 'front.png' }),
          labels: [
            expect.objectContaining({ originalName: 'front.png' }),
            expect.objectContaining({ originalName: 'back.png' })
          ]
        }),
        expect.anything()
      );
    },
    15_000
  );
});
