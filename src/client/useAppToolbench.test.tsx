import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { SingleReviewFlow } from './singleReviewFlowSupport';
import { useAppToolbench } from './useAppToolbench';
import type { BatchWorkflow } from './useBatchWorkflow';

describe('useAppToolbench', () => {
  it('routes toolbench batch pack loads into the live batch workflow', () => {
    const setMode = vi.fn();
    const setView = vi.fn();
    const batch = {
      onLoadLiveBatch: vi.fn(),
      onSelectBatchSeed: vi.fn(),
      onSelectMode: vi.fn()
    } as unknown as BatchWorkflow;
    const single = {
      onImagesChange: vi.fn(),
      onLoadToolbenchSample: vi.fn(),
      onSelectScenario: vi.fn(),
      reset: vi.fn()
    } as unknown as SingleReviewFlow;

    let handlers!: ReturnType<typeof useAppToolbench>;

    function Harness() {
      handlers = useAppToolbench({
        mode: 'single',
        setMode,
        setView,
        single,
        batch
      });

      return null;
    }

    renderToStaticMarkup(<Harness />);

    const images = [
      new File(['front'], 'front.png', { type: 'image/png' }),
      new File(['back'], 'back.png', { type: 'image/png' })
    ];
    const csv = new File(
      ['filename,secondary_filename\nfront.png,back.png\n'],
      'cola-cloud-all.csv',
      { type: 'text/csv' }
    );

    handlers.handleToolbenchLoadBatch(images, csv);

    expect(batch.onLoadLiveBatch).toHaveBeenCalledWith(images, csv);
    expect(batch.onSelectBatchSeed).not.toHaveBeenCalled();
    expect(batch.onSelectMode).toHaveBeenCalledWith('batch', 'single');
    expect(setView).toHaveBeenCalledWith('batch-intake');
  });
});
