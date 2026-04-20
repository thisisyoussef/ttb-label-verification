import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  syntheticLabelDefectKindSchema,
  syntheticLabelGenerateResponseSchema,
  SYNTHETIC_LABEL_DEFECT_KINDS
} from '../../shared/contracts/review';
import { clearSyntheticImageCacheForTests } from './synthetic-label-cache';
import { generateSyntheticLabel } from './synthetic-label-generator';

describe('syntheticLabelDefectKindSchema', () => {
  it('accepts every documented defect kind including none', () => {
    for (const kind of SYNTHETIC_LABEL_DEFECT_KINDS) {
      expect(syntheticLabelDefectKindSchema.parse(kind)).toBe(kind);
    }
  });

  it('rejects unknown defect kinds', () => {
    expect(() => syntheticLabelDefectKindSchema.parse('garbage')).toThrow();
  });
});

describe('generateSyntheticLabel', () => {
  afterEach(() => {
    clearSyntheticImageCacheForTests();
  });

  it('returns a schema-valid response and stores the bytes in cache', async () => {
    // Stub the image generator so the test is hermetic — no real
    // Imagen call, no GEMINI_API_KEY required.
    const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const result = await generateSyntheticLabel({
      generateImage: async () => ({ bytes: fakeBytes, mime: 'image/png' })
    });

    const parsed = syntheticLabelGenerateResponseSchema.parse(result);
    expect(parsed.image.url).toMatch(/^\/api\/eval\/synthetic\/image\//);
    expect(parsed.fields.brandName).toBeTruthy();
    expect(parsed.expected.defectKind).toBeOneOf([...SYNTHETIC_LABEL_DEFECT_KINDS]);
    if (parsed.expected.defectKind === 'none') {
      expect(parsed.expected.verdict).toBe('approve');
    }
  });

  it('populates images[] with distinct front + back entries when Math.random forces the back path', async () => {
    // Force every Math.random() call to return 0 so:
    //   - `pickDefectPlan` takes the "none" branch (random < 0.4)
    //   - `wantsBack` takes the back-label branch (random < 0.35)
    // Keeps the test deterministic regardless of RNG drift.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const generateImage = vi
        .fn<
          (prompt: string) => Promise<{ bytes: Buffer; mime: string }>
        >()
        .mockResolvedValue({ bytes: fakeBytes, mime: 'image/png' });

      const result = await generateSyntheticLabel({ generateImage });
      const parsed = syntheticLabelGenerateResponseSchema.parse(result);

      expect(generateImage).toHaveBeenCalledTimes(2);
      expect(parsed.images).toBeDefined();
      expect(parsed.images).toHaveLength(2);
      expect(parsed.images![0]!.id).toBe(parsed.image.id);
      expect(parsed.images![0]!.filename).toMatch(/-front\.png$/);
      expect(parsed.images![1]!.filename).toMatch(/-back\.png$/);
      expect(parsed.images![0]!.id).not.toBe(parsed.images![1]!.id);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
