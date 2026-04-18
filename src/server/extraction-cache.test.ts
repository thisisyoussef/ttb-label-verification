import { describe, expect, it } from 'vitest';

import { __resetExtractionCache, extractionCache } from './extraction-cache';

const DUMMY_EXTRACTION = {
  extraction: { id: 'ext-1' } as never,
  warningCheck: { id: 'government-warning' } as never,
  ocrText: 'GOVERNMENT WARNING ...',
  createdAt: Date.now()
};

describe('extractionCache', () => {
  it('stores and retrieves by key', () => {
    __resetExtractionCache();
    extractionCache.set('key-1', DUMMY_EXTRACTION);
    const hit = extractionCache.get('key-1');
    expect(hit).toBeDefined();
    expect(hit?.ocrText).toContain('GOVERNMENT');
  });

  it('returns undefined for stale entries (past TTL)', () => {
    __resetExtractionCache();
    extractionCache.set('stale', {
      ...DUMMY_EXTRACTION,
      createdAt: Date.now() - 10 * 60 * 1000 // 10 min ago, past 5-min TTL
    });
    expect(extractionCache.get('stale')).toBeUndefined();
  });

  it('evicts oldest entries when over max capacity', () => {
    __resetExtractionCache();
    // Insert 21 entries (1 over the default max of 20)
    for (let i = 0; i < 21; i += 1) {
      extractionCache.set(`key-${i}`, {
        ...DUMMY_EXTRACTION,
        createdAt: Date.now()
      });
    }
    expect(extractionCache.size()).toBe(20);
    expect(extractionCache.get('key-0')).toBeUndefined();
    expect(extractionCache.get('key-20')).toBeDefined();
  });
});
