import { describe, expect, it } from 'vitest';

import type { ParsedBatchCsvRow } from './batch-csv';
import { buildBatchMatching } from './batch-matching';

function csvRow(
  id: string,
  rowIndex: number,
  filenameHint: string,
  brandName: string,
  classType: string,
  secondaryFilenameHint = ''
): ParsedBatchCsvRow {
  return {
    id,
    rowIndex,
    filenameHint,
    secondaryFilenameHint,
    brandName,
    classType,
    beverageType: 'distilled-spirits',
    fancifulName: '',
    alcoholContent: '45% Alc./Vol.',
    netContents: '750 mL',
    applicantAddress: '',
    origin: 'domestic',
    country: '',
    formulaId: '',
    appellation: '',
    vintage: ''
  };
}

describe('batch matching', () => {
  it('matches by normalized filename before falling back to order', () => {
    const matching = buildBatchMatching({
      images: [
        { id: 'image-1', filename: 'Old-Oak-Bourbon.PNG' },
        { id: 'image-2', filename: 'second-label.jpg' }
      ],
      rows: [
        csvRow(
          'row-1',
          1,
          'old-oak-bourbon.jpg',
          'Old Oak Bourbon',
          'Kentucky Straight Bourbon'
        ),
        csvRow('row-2', 2, '', 'Second Label', 'Straight Rye')
      ]
    });

    expect(matching.matched).toEqual([
      {
        imageId: 'image-1',
        secondaryImageId: null,
        row: expect.objectContaining({ id: 'row-1' }),
        source: 'filename'
      },
      {
        imageId: 'image-2',
        secondaryImageId: null,
        row: expect.objectContaining({ id: 'row-2' }),
        source: 'order'
      }
    ]);
    expect(matching.unmatchedImageIds).toEqual([]);
    expect(matching.unmatchedRowIds).toEqual([]);
  });

  it('marks duplicate csv filename matches as ambiguous', () => {
    const matching = buildBatchMatching({
      images: [{ id: 'image-1', filename: 'stones-throw-gin.jpg' }],
      rows: [
        csvRow('row-1', 1, 'stones-throw-gin.jpg', "Stone's Throw Gin", '750 mL'),
        csvRow('row-2', 2, 'stones-throw-gin.PNG', "Stone's Throw Gin", '1.75 L')
      ]
    });

    expect(matching.matched).toHaveLength(0);
    expect(matching.ambiguous).toEqual([
      {
        imageId: 'image-1',
        candidates: [
          expect.objectContaining({ id: 'row-1' }),
          expect.objectContaining({ id: 'row-2' })
        ]
      }
    ]);
  });

  it('surfaces unmatched rows after order fallback is exhausted', () => {
    const matching = buildBatchMatching({
      images: [{ id: 'image-1', filename: 'unknown-label.jpg' }],
      rows: [
        csvRow('row-1', 1, 'known-label.jpg', 'Known Label', 'Straight Rye'),
        csvRow('row-2', 2, 'second-label.jpg', 'Second Label', 'Straight Bourbon')
      ]
    });

    expect(matching.matched).toEqual([
      {
        imageId: 'image-1',
        secondaryImageId: null,
        row: expect.objectContaining({ id: 'row-1' }),
        source: 'order'
      }
    ]);
    expect(matching.ambiguous).toHaveLength(0);
    expect(matching.unmatchedImageIds).toEqual([]);
    expect(matching.unmatchedRowIds).toEqual(['row-2']);
  });

  it('surfaces unmatched images after order fallback is exhausted', () => {
    const matching = buildBatchMatching({
      images: [
        { id: 'image-1', filename: 'unknown-label.jpg' },
        { id: 'image-2', filename: 'second-label.jpg' }
      ],
      rows: [csvRow('row-1', 1, 'known-label.jpg', 'Known Label', 'Straight Rye')]
    });

    expect(matching.matched).toEqual([
      {
        imageId: 'image-1',
        secondaryImageId: null,
        row: expect.objectContaining({ id: 'row-1' }),
        source: 'order'
      }
    ]);
    expect(matching.ambiguous).toHaveLength(0);
    expect(matching.unmatchedImageIds).toEqual(['image-2']);
    expect(matching.unmatchedRowIds).toEqual([]);
  });

  it('falls back to row order when filename hints do not match any uploaded image', () => {
    const matching = buildBatchMatching({
      images: [
        { id: 'image-1', filename: 'actual-front.jpg' },
        { id: 'image-2', filename: 'actual-back.jpg' }
      ],
      rows: [
        csvRow('row-1', 1, 'legacy-front.jpg', 'Front Label', 'Straight Bourbon'),
        csvRow('row-2', 2, 'legacy-back.jpg', 'Back Label', 'Straight Rye')
      ]
    });

    expect(matching.matched).toEqual([
      {
        imageId: 'image-1',
        secondaryImageId: null,
        row: expect.objectContaining({ id: 'row-1' }),
        source: 'order'
      },
      {
        imageId: 'image-2',
        secondaryImageId: null,
        row: expect.objectContaining({ id: 'row-2' }),
        source: 'order'
      }
    ]);
    expect(matching.ambiguous).toEqual([]);
    expect(matching.unmatchedImageIds).toEqual([]);
    expect(matching.unmatchedRowIds).toEqual([]);
  });

  it('does not reuse ambiguous csv rows during order fallback', () => {
    const matching = buildBatchMatching({
      images: [
        { id: 'image-1', filename: 'stones-throw-gin.jpg' },
        { id: 'image-2', filename: 'unmatched-label.jpg' }
      ],
      rows: [
        csvRow('row-1', 1, 'stones-throw-gin.jpg', "Stone's Throw Gin", '750 mL'),
        csvRow('row-2', 2, 'stones-throw-gin.PNG', "Stone's Throw Gin", '1.75 L')
      ]
    });

    expect(matching.matched).toEqual([]);
    expect(matching.ambiguous).toEqual([
      {
        imageId: 'image-1',
        candidates: [
          expect.objectContaining({ id: 'row-1' }),
          expect.objectContaining({ id: 'row-2' })
        ]
      }
    ]);
    expect(matching.unmatchedImageIds).toEqual(['image-2']);
    expect(matching.unmatchedRowIds).toEqual([]);
  });

  it('treats blank filename hints as order fallback instead of deterministic filename matches', () => {
    const matching = buildBatchMatching({
      images: [{ id: 'image-1', filename: '' }],
      rows: [csvRow('row-1', 1, '', 'Fallback Label', 'Straight Rye')]
    });

    expect(matching.matched).toEqual([
      {
        imageId: 'image-1',
        secondaryImageId: null,
        row: expect.objectContaining({ id: 'row-1' }),
        source: 'order'
      }
    ]);
    expect(matching.ambiguous).toEqual([]);
    expect(matching.unmatchedImageIds).toEqual([]);
    expect(matching.unmatchedRowIds).toEqual([]);
  });

  it('auto-matches an optional secondary image and excludes it from unmatched images', () => {
    const matching = buildBatchMatching({
      images: [
        { id: 'image-front', filename: 'old-oak-front.jpg' },
        { id: 'image-back', filename: 'old-oak-back.jpg' }
      ],
      rows: [
        csvRow(
          'row-1',
          1,
          'old-oak-front.jpg',
          'Old Oak Bourbon',
          'Kentucky Straight Bourbon',
          'old-oak-back.jpg'
        )
      ]
    });

    expect(matching.matched).toEqual([
      {
        imageId: 'image-front',
        secondaryImageId: 'image-back',
        row: expect.objectContaining({
          id: 'row-1',
          secondaryFilenameHint: 'old-oak-back.jpg'
        }),
        source: 'filename'
      }
    ]);
    expect(matching.unmatchedImageIds).toEqual([]);
    expect(matching.unmatchedRowIds).toEqual([]);
  });
});
