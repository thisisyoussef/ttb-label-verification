import { describe, expect, it } from 'vitest';

import type {
  BatchDashboardResponse,
  BatchPreflightResponse
} from '../../shared/contracts/review';
import {
  buildBatchCsvModel,
  buildBatchMatchingState,
  buildBatchResolutions,
  buildDashboardSeedFromResponse,
  buildStreamItem
} from './batch-runtime';
import type { BatchLabelImage, BatchMatchingState } from './batchTypes';

function image(id: string, filename: string, previewUrl = `blob:${id}`): BatchLabelImage {
  return {
    id,
    file: null,
    filename,
    previewUrl,
    sizeLabel: '2.8 MB',
    isPdf: false
  };
}

describe('batch runtime helpers', () => {
  it('builds a csv preview and matching state from preflight payloads', () => {
    const preflight: BatchPreflightResponse = {
      batchSessionId: 'batch-1',
      csvHeaders: ['filename', 'brand_name', 'class_type'],
      csvRows: [
        {
          id: 'row-1',
          rowIndex: 1,
          filenameHint: 'old-oak-bourbon.jpg',
          secondaryFilenameHint: 'old-oak-bourbon-back.jpg',
          brandName: 'Old Oak Bourbon',
          classType: 'Kentucky Straight Bourbon'
        },
        {
          id: 'row-2',
          rowIndex: 2,
          filenameHint: '',
          secondaryFilenameHint: '',
          brandName: 'Second Label',
          classType: 'Straight Rye'
        }
      ],
      matching: {
        matched: [
          {
            imageId: 'image-1',
            secondaryImageId: 'image-1b',
            row: {
              id: 'row-1',
              rowIndex: 1,
              filenameHint: 'old-oak-bourbon.jpg',
              secondaryFilenameHint: 'old-oak-bourbon-back.jpg',
              brandName: 'Old Oak Bourbon',
              classType: 'Kentucky Straight Bourbon'
            },
            source: 'filename'
          }
        ],
        ambiguous: [],
        unmatchedImageIds: ['image-2'],
        unmatchedRowIds: ['row-2']
      },
      fileErrors: []
    };

    const csv = buildBatchCsvModel(
      new File(['filename,brand_name,class_type'], 'applications.csv', {
        type: 'text/csv'
      }),
      preflight
    );
    const matching = buildBatchMatchingState({
      preflight,
      images: [
        image('image-1', 'old-oak-bourbon.jpg'),
        image('image-1b', 'old-oak-bourbon-back.jpg'),
        image('image-2', 'second-label.jpg')
      ]
    });

    expect(csv.rows[0]?.brandName).toBe('Old Oak Bourbon');
    expect(csv.rows[0]?.secondaryFilenameHint).toBe('old-oak-bourbon-back.jpg');
    expect(matching.matched[0]?.row.id).toBe('row-1');
    expect(matching.matched[0]?.secondaryImage?.id).toBe('image-1b');
    expect(matching.unmatchedRows[0]?.row.id).toBe('row-2');
  });

  it('derives run resolutions from resolved matching groups only', () => {
    const matching: BatchMatchingState = {
      matched: [],
      ambiguous: [
        {
          image: image('image-1', 'ambiguous.jpg'),
          candidates: [],
          chosenRowId: 'row-1',
          dropped: false
        }
      ],
      unmatchedImages: [
        {
          image: image('image-2', 'drop-me.jpg'),
          pairedRowId: null,
          dropped: true
        }
      ],
      unmatchedRows: []
    };

    expect(buildBatchResolutions(matching)).toEqual([
      {
        imageId: 'image-1',
        action: {
          kind: 'matched',
          rowId: 'row-1'
        }
      },
      {
        imageId: 'image-2',
        action: {
          kind: 'dropped'
        }
      }
    ]);
  });

  it('overlays local previews onto dashboard rows and stream items', () => {
    const response: BatchDashboardResponse = {
      batchSessionId: 'batch-1',
      phase: 'complete',
      totals: {
        started: 1,
        done: 1
      },
      summary: {
        pass: 0,
        review: 1,
        fail: 0,
        error: 0
      },
      rows: [
        {
          rowId: 'row-1',
          reportId: 'report-1',
          imageId: 'image-1',
          secondaryImageId: 'image-1b',
          filename: 'brand-pass.png',
          secondaryFilename: 'brand-pass-back.png',
          brandName: 'Submitted Brand Pass',
          classType: 'Straight Rye',
          beverageType: 'distilled-spirits',
          status: 'review',
          previewUrl: null,
          secondaryPreviewUrl: null,
          isPdf: false,
          secondaryIsPdf: false,
          sizeLabel: '2.8 MB',
          secondarySizeLabel: '1.4 MB',
          issues: {
            blocker: 0,
            major: 1,
            minor: 0,
            note: 0
          },
          confidenceState: 'ok',
          errorMessage: null,
          completedOrder: 1
        }
      ]
    };

    const dashboard = buildDashboardSeedFromResponse({
      batchSessionId: 'batch-1',
      response,
      images: [
        image('image-1', 'brand-pass.png', 'blob:preview-1'),
        image('image-1b', 'brand-pass-back.png', 'blob:preview-1b')
      ]
    });
    const streamItem = buildStreamItem({
      frame: {
        type: 'item',
        itemId: 'item-image-1',
        imageId: 'image-1',
        secondaryImageId: 'image-1b',
        filename: 'brand-pass.png',
        identity: 'Submitted Brand Pass — Straight Rye',
        status: 'review',
        reportId: 'report-1'
      },
      images: [
        image('image-1', 'brand-pass.png', 'blob:preview-1'),
        image('image-1b', 'brand-pass-back.png', 'blob:preview-1b')
      ]
    });

    expect(dashboard.rows[0]?.brandName).toBe('Submitted Brand Pass');
    expect(dashboard.rows[0]?.previewUrl).toBe('blob:preview-1');
    expect(dashboard.rows[0]?.secondaryPreviewUrl).toBe('blob:preview-1b');
    expect(streamItem.previewUrl).toBe('blob:preview-1');
    expect(streamItem.secondaryPreviewUrl).toBe('blob:preview-1b');
    expect(streamItem.id).toBe('image-1');
  });
});
