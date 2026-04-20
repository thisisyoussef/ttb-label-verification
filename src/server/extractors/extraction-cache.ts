import crypto from 'node:crypto';

import type { CheckReview, ReviewExtraction } from '../../shared/contracts/review';

/**
 * In-memory cache of completed extractions keyed by image-bytes hash.
 *
 * Powers the image-first prefetch path: when the user uploads an image,
 * the client fires `POST /api/review/extract-only` which computes the
 * VLM extraction + OCR + warning OCV WITHOUT running judgment, and
 * stashes the result here. When the user later clicks Verify, the
 * canonical `POST /api/review` call passes the cache key back via the
 * `x-extraction-cache-key` header; the server skips re-extraction and
 * runs just judgment + report against the cached data.
 *
 * For a user who spends 5+ seconds on the form, Verify returns in
 * ~100ms instead of ~5-7s. Judgment is the cheap part; extraction is
 * the long pole, and we've already paid for it during typing time.
 *
 * Ephemeral by design — sized and aged for a single interactive
 * session. No persistence, no cross-process sharing, no leak into
 * report outputs.
 */

export interface CachedExtraction {
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  ocrText?: string;
  createdAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_ENTRIES = 20;

class ExtractionCache {
  private readonly store = new Map<string, CachedExtraction>();
  constructor(
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly maxEntries = DEFAULT_MAX_ENTRIES
  ) {}

  /**
   * Compute a stable cache key from the raw image bytes. SHA-256 is
   * overkill cryptographically here but is cheap and collision-free
   * for our single-session use case.
   */
  static keyFor(imageBytes: Buffer): string {
    return crypto.createHash('sha256').update(imageBytes).digest('hex');
  }

  set(key: string, value: CachedExtraction): void {
    // Touch-based LRU: delete + re-insert moves to the end
    this.store.delete(key);
    this.store.set(key, value);
    this.evictIfNeeded();
  }

  get(key: string): CachedExtraction | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.createdAt > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh LRU position on read
    this.store.delete(key);
    this.store.set(key, hit);
    return hit;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  size(): number {
    return this.store.size;
  }

  /** Test-only helper — not exported through the module singleton. */
  clear(): void {
    this.store.clear();
  }

  private evictIfNeeded(): void {
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }
}

export const extractionCache = new ExtractionCache();

/** Test-only — full cache reset. */
export function __resetExtractionCache(): void {
  extractionCache.clear();
}
