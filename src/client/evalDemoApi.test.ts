import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadEvalPackFiles } from './evalDemoApi';

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  });
}

function createBlobResponse(
  body: string | number[],
  contentType: string,
  status = 200
) {
  const blobBody = typeof body === 'string' ? body : new Uint8Array(body);

  return new Response(new Blob([blobBody], { type: contentType }), {
    status,
    headers: {
      'content-type': contentType
    }
  });
}

describe('loadEvalPackFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the full pack using the canonical source field from the manifest', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url === '/api/eval/packs') {
          return createJsonResponse({
            packs: [
              {
                id: 'cola-cloud-all',
                title: 'COLA Cloud',
                description: 'Demo pack',
                csvFile: 'cola-cloud-all.csv',
                imageCount: 2,
                images: [
                  {
                    id: 'front',
                    source: 'cola-cloud-manifest',
                    assetPath: 'evals/labels/not-the-source/front.png',
                    filename: 'front.png',
                    beverageType: 'distilled-spirits'
                  },
                  {
                    id: 'back',
                    source: 'cola-cloud-manifest',
                    assetPath: 'evals/labels/not-the-source/back.png',
                    filename: 'back.png',
                    beverageType: 'distilled-spirits'
                  }
                ]
              }
            ]
          });
        }

        if (url === '/api/eval/pack/cola-cloud-all/csv') {
          return createBlobResponse('filename\nfront.png', 'text/csv');
        }

        if (url === '/api/eval/label-image/cola-cloud-manifest/front.png') {
          return createBlobResponse([1, 2, 3], 'image/png');
        }

        if (url === '/api/eval/label-image/cola-cloud-manifest/back.png') {
          return createBlobResponse([4, 5, 6], 'image/png');
        }

        throw new Error(`Unexpected fetch: ${url}`);
      });

    const result = await loadEvalPackFiles('cola-cloud-all');

    expect(result.pack.id).toBe('cola-cloud-all');
    expect(result.csvFile.name).toBe('cola-cloud-all.csv');
    expect(result.imageFiles.map((file) => file.name)).toEqual([
      'front.png',
      'back.png'
    ]);
    expect(fetchSpy).toHaveBeenCalledWith('/api/eval/label-image/cola-cloud-manifest/front.png');
    expect(fetchSpy).toHaveBeenCalledWith('/api/eval/label-image/cola-cloud-manifest/back.png');
  });

  it('keeps the toolbench batch behavior of skipping failed images when at least one loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url === '/api/eval/packs') {
        return createJsonResponse({
          packs: [
            {
              id: 'cola-cloud-all',
              title: 'COLA Cloud',
              description: 'Demo pack',
              csvFile: 'cola-cloud-all.csv',
              imageCount: 2,
              images: [
                {
                  id: 'front',
                  source: 'cola-cloud',
                  assetPath: 'evals/labels/cola-cloud/front.png',
                  filename: 'front.png',
                  beverageType: 'distilled-spirits'
                },
                {
                  id: 'back',
                  source: 'cola-cloud',
                  assetPath: 'evals/labels/cola-cloud/back.png',
                  filename: 'back.png',
                  beverageType: 'distilled-spirits'
                }
              ]
            }
          ]
        });
      }

      if (url === '/api/eval/pack/cola-cloud-all/csv') {
        return createBlobResponse('filename\nfront.png', 'text/csv');
      }

      if (url === '/api/eval/label-image/cola-cloud/front.png') {
        return createBlobResponse([1, 2, 3], 'image/png');
      }

      if (url === '/api/eval/label-image/cola-cloud/back.png') {
        return createBlobResponse('missing', 'text/plain', 404);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await loadEvalPackFiles('cola-cloud-all');

    expect(result.imageFiles.map((file) => file.name)).toEqual(['front.png']);
  });

  it('throws when the pack cannot yield any images', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url === '/api/eval/packs') {
        return createJsonResponse({
          packs: [
            {
              id: 'cola-cloud-all',
              title: 'COLA Cloud',
              description: 'Demo pack',
              csvFile: 'cola-cloud-all.csv',
              imageCount: 1,
              images: [
                {
                  id: 'front',
                  source: 'cola-cloud',
                  assetPath: 'evals/labels/cola-cloud/front.png',
                  filename: 'front.png',
                  beverageType: 'distilled-spirits'
                }
              ]
            }
          ]
        });
      }

      if (url === '/api/eval/pack/cola-cloud-all/csv') {
        return createBlobResponse('filename\nfront.png', 'text/csv');
      }

      if (url === '/api/eval/label-image/cola-cloud/front.png') {
        return createBlobResponse('missing', 'text/plain', 404);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(loadEvalPackFiles('cola-cloud-all')).rejects.toThrow(
      'No images could be fetched from "cola-cloud-all".'
    );
  });
});
