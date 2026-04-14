import { afterAll, describe, expect, it } from 'vitest';

import { helpManifestSchema } from '../shared/contracts/help';
import { createApp } from './index';

async function startServer() {
  const app = createApp();
  return app.listen(0);
}

function serverUrl(server: Awaited<ReturnType<typeof startServer>>, path: string) {
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('Expected server to listen on a local port.');
  }

  return `http://127.0.0.1:${address.port}${path}`;
}

describe('help manifest route', () => {
  const servers: Array<Awaited<ReturnType<typeof startServer>>> = [];

  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    })));
  });

  it('returns a cacheable deterministic help manifest', async () => {
    const server = await startServer();
    servers.push(server);

    const response = await fetch(serverUrl(server, '/api/help/manifest?locale=en'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');

    const manifest = helpManifestSchema.parse(await response.json());
    expect(manifest.locale).toBe('en');
    expect(manifest.tourSteps).toHaveLength(8);
    expect(manifest.infoPopovers).toHaveLength(5);
  });
});
