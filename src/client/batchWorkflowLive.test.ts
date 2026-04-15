import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prepareLiveBatchPreflightMock } = vi.hoisted(() => ({
  prepareLiveBatchPreflightMock: vi.fn()
}));

vi.mock('./appBatchPreflight', () => ({
  prepareLiveBatchPreflight: prepareLiveBatchPreflightMock
}));

import { emptyBatchSeedState } from './appBatchState';
import { selectLiveImages } from './batchWorkflowLive';
import type { SeedBatch } from './batchScenarios';
import type { BatchLabelImage } from './batchTypes';

function image(id: string, filename: string, previewUrl = `blob:${id}`): BatchLabelImage {
  return {
    id,
    file: new File(['existing'], filename, { type: 'image/png' }),
    filename,
    previewUrl,
    sizeLabel: '1 KB',
    isPdf: false
  };
}

describe('selectLiveImages', () => {
  beforeEach(() => {
    prepareLiveBatchPreflightMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends newly selected images instead of replacing the current batch', () => {
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:new-image');
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const existingImage = image('image-existing', 'existing.png');
    const previousSeed: SeedBatch = {
      ...emptyBatchSeedState(),
      images: [existingImage]
    };

    let nextSeed: SeedBatch | null = null;

    selectLiveImages({
      files: [new File(['next'], 'added.png', { type: 'image/png' })],
      batchSeedImages: previousSeed.images,
      batchCsvFile: null,
      batchPreflightRequestRef: { current: 0 },
      setBatchSessionId: vi.fn(),
      setBatchSeed: (updater) => {
        nextSeed = updater(previousSeed);
      },
      setBatchItems: vi.fn(),
      setBatchProgress: vi.fn(),
      setBatchPhase: vi.fn(),
      setPreviewImage: vi.fn(),
      resetDashboardSeed: vi.fn()
    });

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(nextSeed).not.toBeNull();
    expect(nextSeed!.images.map((entry) => entry.filename)).toEqual([
      'existing.png',
      'added.png'
    ]);
    expect(revokeObjectUrl).not.toHaveBeenCalledWith(existingImage.previewUrl);
  });

  it('re-preflights against the appended image set when a csv is already loaded', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    prepareLiveBatchPreflightMock.mockResolvedValue('batch-session-1');

    const existingImage = image('image-existing', 'existing.png');
    const csvFile = new File(['filename,brand_name'], 'applications.csv', {
      type: 'text/csv'
    });

    selectLiveImages({
      files: [new File(['next'], 'added.png', { type: 'image/png' })],
      batchSeedImages: [existingImage],
      batchCsvFile: csvFile,
      batchPreflightRequestRef: { current: 0 },
      setBatchSessionId: vi.fn(),
      setBatchSeed: vi.fn(),
      setBatchItems: vi.fn(),
      setBatchProgress: vi.fn(),
      setBatchPhase: vi.fn(),
      setPreviewImage: vi.fn(),
      resetDashboardSeed: vi.fn()
    });

    await Promise.resolve();

    expect(prepareLiveBatchPreflightMock).toHaveBeenCalledTimes(1);
    expect(
      prepareLiveBatchPreflightMock.mock.calls[0]?.[0].nextImages.map(
        (entry: BatchLabelImage) => entry.filename
      )
    ).toEqual(['existing.png', 'added.png']);
  });
});
