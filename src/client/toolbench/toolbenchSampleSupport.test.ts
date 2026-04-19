import { describe, expect, it } from 'vitest';

import { resolveBuiltinSample } from './toolbenchSampleSupport';

describe('resolveBuiltinSample', () => {
  it('keeps counterpart images from the checked-in COLA corpus', () => {
    const sample = resolveBuiltinSample(
      'persian-empire-black-widow-distilled-spirits'
    ) as unknown as {
      filename: string;
      images?: Array<{ filename: string }>;
    };

    expect(sample.filename).toBe('persian-empire-black-widow-distilled-spirits.webp');
    expect(sample.images).toHaveLength(2);
    expect(sample.images?.map((image) => image.filename)).toEqual([
      'persian-empire-black-widow-distilled-spirits.webp',
      'persian-empire-black-widow-distilled-spirits-back.webp'
    ]);
  });
});
