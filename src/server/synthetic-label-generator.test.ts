import { afterEach, describe, expect, it } from 'vitest';

import {
  syntheticLabelDefectKindSchema,
  syntheticLabelGenerateResponseSchema,
  SYNTHETIC_LABEL_DEFECT_KINDS
} from '../shared/contracts/review';
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
});
