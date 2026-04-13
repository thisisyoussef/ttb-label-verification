import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './index';

const serversToClose: Array<{
  close: (callback: (error?: Error | undefined) => void) => void;
}> = [];
const tempDirsToRemove: string[] = [];

async function startServer(clientDistDir?: string) {
  const app = createApp({ clientDistDir });

  return await new Promise<{
    close: (callback: (error?: Error | undefined) => void) => void;
    address: () => AddressInfo | string | null;
  }>((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function serverUrl(server: { address: () => AddressInfo | string | null }, pathname: string) {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Server address not available.');
  }

  return `http://127.0.0.1:${address.port}${pathname}`;
}

afterEach(async () => {
  await Promise.all(
    serversToClose.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );

  tempDirsToRemove.splice(0).forEach((dirPath) => {
    rmSync(dirPath, { recursive: true, force: true });
  });
});

describe('server deployment surfaces', () => {
  it('serves the health endpoint as a no-persistence contract', async () => {
    const server = await startServer();
    serversToClose.push(server);

    const response = await fetch(serverUrl(server, '/api/health'));

    expect(response.status).toBe(200);

    const payload = (await response.json()) as { store: boolean; service: string };

    expect(payload.service).toBe('ttb-label-verification');
    expect(payload.store).toBe(false);
  });

  it('serves the built client when an index file exists', async () => {
    const clientDistDir = mkdtempSync(path.join(tmpdir(), 'ttb-client-dist-'));
    tempDirsToRemove.push(clientDistDir);
    writeFileSync(
      path.join(clientDistDir, 'index.html'),
      '<!doctype html><html><body><div id="root">deployed-client</div></body></html>'
    );

    const server = await startServer(clientDistDir);
    serversToClose.push(server);

    const response = await fetch(serverUrl(server, '/'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('deployed-client');
  });

  it('does not turn unknown api routes into the client fallback', async () => {
    const clientDistDir = mkdtempSync(path.join(tmpdir(), 'ttb-client-dist-'));
    tempDirsToRemove.push(clientDistDir);
    writeFileSync(
      path.join(clientDistDir, 'index.html'),
      '<!doctype html><html><body><div id="root">deployed-client</div></body></html>'
    );

    const server = await startServer(clientDistDir);
    serversToClose.push(server);

    const response = await fetch(serverUrl(server, '/api/missing'));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).not.toContain('deployed-client');
  });
});
