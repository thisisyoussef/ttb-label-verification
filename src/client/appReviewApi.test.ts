import { describe, expect, it, vi, afterEach } from 'vitest';

import { submitReview, prefetchExtraction, checkReviewRelevance } from './appReviewApi';
import type { LabelImage } from './types';

function makeImage(overrides: Partial<LabelImage> = {}): LabelImage {
  return {
    file: new File(['demo'], 'demo.png', { type: 'image/png' }),
    previewUrl: 'blob:demo',
    sizeLabel: '1 KB',
    ...overrides
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('appReviewApi demo shortcuts', () => {
  it('returns a canned report without calling fetch when the image is a demo scenario', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await submitReview({
      image: makeImage({ demoScenarioId: 'perfect-spirit-label' }),
      beverage: 'distilled-spirits',
      fields: {
        brandName: '',
        fancifulName: '',
        classType: '',
        alcoholContent: '',
        netContents: '',
        applicantAddress: '',
        origin: 'domestic',
        country: '',
        formulaId: '',
        appellation: '',
        vintage: '',
        varietals: []
      },
      signal: new AbortController().signal
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips extract-only prefetch and relevance checks for demo images', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const image = makeImage({ demoScenarioId: 'perfect-spirit-label' });

    await expect(
      prefetchExtraction({
        image,
        beverage: 'distilled-spirits',
        signal: new AbortController().signal
      })
    ).resolves.toBeNull();

    await expect(
      checkReviewRelevance({
        image,
        beverage: 'distilled-spirits',
        signal: new AbortController().signal
      })
    ).resolves.toBeNull();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
