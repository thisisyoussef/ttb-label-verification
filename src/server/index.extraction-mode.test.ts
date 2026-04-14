import { afterEach, describe, expect, it } from 'vitest';

import { reviewErrorSchema } from '../shared/contracts/review';
import {
  cleanupTestResources,
  postReview,
  registerServer,
  startServer
} from './index.test-helpers';

afterEach(cleanupTestResources);

type ManagedEnvKey =
  | 'AI_CAPABILITY_LABEL_EXTRACTION_ORDER'
  | 'AI_EXTRACTION_MODE_ALLOW_LOCAL'
  | 'AI_EXTRACTION_MODE_DEFAULT'
  | 'OPENAI_API_KEY';

function withEnv(
  overrides: Partial<Record<ManagedEnvKey, string | undefined>>,
  fn: () => Promise<void>
) {
  const original = new Map<ManagedEnvKey, string | undefined>();

  for (const [key, value] of Object.entries(overrides) as Array<
    [ManagedEnvKey, string | undefined]
  >) {
    original.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return fn().finally(() => {
    for (const [key, value] of original) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

describe('server extraction mode policy surfaces', () => {
  it('fails closed when local extraction mode is configured but no local provider is available', async () => {
    await withEnv(
      {
        AI_EXTRACTION_MODE_ALLOW_LOCAL: 'true',
        AI_EXTRACTION_MODE_DEFAULT: 'local',
        OPENAI_API_KEY: undefined
      },
      async () => {
        const server = await startServer();
        registerServer(server);

        const response = await postReview(server);

        expect(response.status).toBe(503);

        const payload = reviewErrorSchema.parse(await response.json());

        expect(payload.kind).toBe('adapter');
        expect(payload.retryable).toBe(false);
        expect(payload.message).toContain('Local extraction');
      }
    );
  });

  it('returns a structured error when provider-order env config is invalid', async () => {
    await withEnv(
      {
        AI_CAPABILITY_LABEL_EXTRACTION_ORDER: 'openai,openai',
        OPENAI_API_KEY: undefined
      },
      async () => {
        const server = await startServer();
        registerServer(server);

        const response = await postReview(server);

        expect(response.status).toBe(500);

        const payload = reviewErrorSchema.parse(await response.json());

        expect(payload.kind).toBe('adapter');
        expect(payload.retryable).toBe(false);
        expect(payload.message).toContain('duplicate provider');
      }
    );
  });
});
