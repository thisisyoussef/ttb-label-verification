import crypto from 'node:crypto';

/**
 * Tiny in-memory cache for synthetic-label image bytes.
 *
 * The toolbench "Generate with Gemini" flow generates a label, hands
 * the bytes to this cache, returns an opaque ID to the client, and the
 * client fetches the bytes via `GET /api/eval/synthetic/image/:id`.
 * Same shape as the COLA Cloud proxy idea, simpler implementation —
 * no LRU eviction, just a TTL sweep.
 *
 * Entries expire after 15 minutes. The toolbench loads the image
 * within seconds of receiving the descriptor, so a long TTL only
 * matters for the dev who clicks Generate, walks away, and comes
 * back. Memory pressure is bounded by the rate limiter on the
 * generate endpoint (1 req / 5s / IP).
 */

const TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  bytes: Buffer;
  mime: string;
  filename: string;
  createdAt: number;
}

const store = new Map<string, CacheEntry>();

function sweep(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, entry] of store) {
    if (entry.createdAt < cutoff) store.delete(id);
  }
}

export function putSyntheticImage(input: {
  bytes: Buffer;
  mime: string;
  filename: string;
}): string {
  sweep();
  const id = `syn-${crypto.randomUUID()}`;
  store.set(id, {
    bytes: input.bytes,
    mime: input.mime,
    filename: input.filename,
    createdAt: Date.now()
  });
  return id;
}

export function getSyntheticImage(id: string): CacheEntry | undefined {
  const entry = store.get(id);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return undefined;
  }
  return entry;
}

/**
 * Test helper. Production code should not call this — entries naturally
 * expire via TTL.
 */
export function clearSyntheticImageCacheForTests(): void {
  store.clear();
}
