import { describe, expect, it } from 'vitest';

import { selectDiverseColas } from './cola-cloud-fetch-lib';

describe('selectDiverseColas', () => {
  it('excludes blocked unreadable COLA ids from future corpus picks', () => {
    const selected = selectDiverseColas(
      [
        {
          ttb_id: '26107001000011',
          brand_name: 'Too Hard To Read',
          product_name: 'Front Label',
          product_type: 'distilled spirits',
          class_name: 'Whisky',
          origin_name: 'United States',
          permit_number: 'P-1',
          approval_date: '2026-04-23',
          image_count: 2,
          has_barcode: false
        },
        {
          ttb_id: 'COLA-2026-0002',
          brand_name: 'Safe Harbor',
          product_name: 'Reserve',
          product_type: 'distilled spirits',
          class_name: 'Vodka',
          origin_name: 'United States',
          permit_number: 'P-2',
          approval_date: '2026-04-23',
          image_count: 2,
          has_barcode: true
        }
      ],
      2
    );

    expect(selected.map((cola) => cola.ttb_id)).toEqual(['COLA-2026-0002']);
  });
});
