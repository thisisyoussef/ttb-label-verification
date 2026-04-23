import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupTestResources,
  registerServer,
  serverUrl,
  startServer
} from '../index.test-helpers';
import { __resetColaCloudRouteCache } from './eval-cola-cloud-routes';

const originalApiKey = process.env.COLACLOUD_API_KEY;
const originalBootWarmup = process.env.TTB_BOOT_WARMUP;

afterEach(async () => {
  await cleanupTestResources();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  __resetColaCloudRouteCache();

  if (originalApiKey === undefined) {
    delete process.env.COLACLOUD_API_KEY;
  } else {
    process.env.COLACLOUD_API_KEY = originalApiKey;
  }

  if (originalBootWarmup === undefined) {
    delete process.env.TTB_BOOT_WARMUP;
  } else {
    process.env.TTB_BOOT_WARMUP = originalBootWarmup;
  }
});

describe('eval COLA Cloud routes', () => {
  it('returns counterpart stored sample images when the checked-in corpus has them', async () => {
    process.env.TTB_BOOT_WARMUP = 'disabled';

    const realFetch = fetch;
    const server = await startServer();
    registerServer(server);

    const response = await realFetch(
      serverUrl(
        server,
        '/api/eval/sample?id=persian-empire-black-widow-distilled-spirits'
      )
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      image: { id: string; filename: string };
      images?: Array<{ id: string; filename: string }>;
      fields: { brandName: string };
    };

    expect(payload.fields.brandName).toBe('Persian Empire');
    expect(payload.image.filename).toBe(
      'persian-empire-black-widow-distilled-spirits.webp'
    );
    expect(payload.images).toHaveLength(2);
    expect(payload.images?.map((image) => image.filename)).toEqual([
      'persian-empire-black-widow-distilled-spirits.webp',
      'persian-empire-black-widow-distilled-spirits-back.webp'
    ]);
  });

  it('returns both preferred live images when a COLA record includes a second label', async () => {
    process.env.COLACLOUD_API_KEY = 'test-cola-cloud-key';
    process.env.TTB_BOOT_WARMUP = 'disabled';

    const realFetch = fetch;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.startsWith('https://app.colacloud.us/api/v1/colas?')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                ttb_id: 'COLA-2026-0001',
                brand_name: 'North Ridge',
                product_name: 'Reserve',
                product_type: 'Distilled Spirits',
                class_name: 'Vodka',
                origin_name: 'United States',
                image_count: 2
              }
            ]
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        );
      }

      if (url === 'https://app.colacloud.us/api/v1/colas/COLA-2026-0001') {
        return new Response(
          JSON.stringify({
            data: {
              ttb_id: 'COLA-2026-0001',
              brand_name: 'North Ridge',
              product_name: 'Reserve',
              product_type: 'Distilled Spirits',
              class_name: 'Vodka',
              origin_name: 'United States',
              abv: 40,
              domestic_or_imported: 'Domestic',
              grape_varietals: null,
              wine_vintage_year: null,
              wine_appellation: null,
              address_recipient: 'North Ridge Spirits, Austin, TX',
              address_state: 'TX',
              images: [
                {
                  ttb_image_id: 'front-1',
                  image_index: 2,
                  container_position: 'Front',
                  extension_type: 'jpg',
                  image_url: 'https://cdn.example.com/front.jpg'
                },
                {
                  ttb_image_id: 'neck-1',
                  image_index: 1,
                  container_position: 'Neck',
                  extension_type: 'jpg',
                  image_url: 'https://cdn.example.com/neck.jpg'
                },
                {
                  ttb_image_id: 'back-1',
                  image_index: 3,
                  container_position: 'Back',
                  extension_type: 'png',
                  image_url: 'https://cdn.example.com/back.png'
                }
              ]
            }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const server = await startServer();
    registerServer(server);

    const response = await realFetch(serverUrl(server, '/api/eval/cola-cloud/fresh'));

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      image: { id: string; filename: string; url: string };
      images: Array<{ id: string; filename: string; url: string }>;
      fields: { brandName: string; formulaId: string };
      meta: { imageCount: number; selectedImageCount: number };
    };

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload.fields.brandName).toBe('North Ridge');
    expect(payload.fields.formulaId).toBe('COLA-2026-0001');
    expect(payload.images).toHaveLength(2);
    expect(payload.images[0]).toMatchObject({
      id: 'colacloud-COLA-2026-0001-front-1',
      filename: 'COLA-2026-0001-front.jpg',
      url: expect.stringContaining(
        encodeURIComponent('https://cdn.example.com/front.jpg')
      )
    });
    expect(payload.images[1]).toMatchObject({
      id: 'colacloud-COLA-2026-0001-back-1',
      filename: 'COLA-2026-0001-back.png',
      url: expect.stringContaining(
        encodeURIComponent('https://cdn.example.com/back.png')
      )
    });
    expect(payload.image).toEqual(payload.images[0]);
    expect(payload.meta).toMatchObject({
      imageCount: 3,
      selectedImageCount: 2
    });
  });

  it('skips blocked live COLA ids and falls through to another candidate', async () => {
    process.env.COLACLOUD_API_KEY = 'test-cola-cloud-key';
    process.env.TTB_BOOT_WARMUP = 'disabled';

    const realFetch = fetch;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.startsWith('https://app.colacloud.us/api/v1/colas?')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                ttb_id: '26107001000011',
                brand_name: 'Too Hard To Read',
                product_name: 'Front Label',
                product_type: 'distilled spirits',
                class_name: 'Whisky',
                origin_name: 'United States',
                image_count: 2
              },
              {
                ttb_id: 'COLA-2026-0002',
                brand_name: 'Safe Harbor',
                product_name: 'Reserve',
                product_type: 'distilled spirits',
                class_name: 'Vodka',
                origin_name: 'United States',
                image_count: 2
              }
            ]
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        );
      }

      if (url === 'https://app.colacloud.us/api/v1/colas/COLA-2026-0002') {
        return new Response(
          JSON.stringify({
            data: {
              ttb_id: 'COLA-2026-0002',
              brand_name: 'Safe Harbor',
              product_name: 'Reserve',
              product_type: 'distilled spirits',
              class_name: 'Vodka',
              origin_name: 'United States',
              abv: 40,
              domestic_or_imported: 'Domestic',
              grape_varietals: null,
              wine_vintage_year: null,
              wine_appellation: null,
              address_recipient: 'Safe Harbor Spirits, Austin, TX',
              address_state: 'TX',
              images: [
                {
                  ttb_image_id: 'front-1',
                  image_index: 1,
                  container_position: 'Front',
                  extension_type: 'jpg',
                  image_url: 'https://cdn.example.com/safe-front.jpg'
                },
                {
                  ttb_image_id: 'back-1',
                  image_index: 2,
                  container_position: 'Back',
                  extension_type: 'jpg',
                  image_url: 'https://cdn.example.com/safe-back.jpg'
                }
              ]
            }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const server = await startServer();
    registerServer(server);

    const response = await realFetch(serverUrl(server, '/api/eval/cola-cloud/fresh'));

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      fields: { brandName: string; formulaId: string };
      images: Array<{ filename: string }>;
    };

    expect(payload.fields.brandName).toBe('Safe Harbor');
    expect(payload.fields.formulaId).toBe('COLA-2026-0002');
    expect(payload.images.map((image) => image.filename)).toEqual([
      'COLA-2026-0002-front.jpg',
      'COLA-2026-0002-back.jpg'
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://app.colacloud.us/api/v1/colas/26107001000011'
    );
  });
});
