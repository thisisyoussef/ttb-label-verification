import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { StreamBlock } from './BatchProcessingSections';
import { TriageTable } from './BatchDashboardTable';
import type { BatchDashboardRow, BatchStreamItem } from './batchTypes';

function makeErroredStreamItem(): BatchStreamItem {
  return {
    id: 'image-retry',
    filename: 'retry-me.png',
    identity: 'Submitted Retry Brand - Straight Rye',
    previewUrl: null,
    isPdf: false,
    status: 'error',
    errorMessage: 'We could not finish this item right now.',
    retryKey: 0
  };
}

function makeErroredDashboardRow(): BatchDashboardRow {
  return {
    rowId: 'row-retry',
    reportId: null,
    imageId: 'image-retry',
    filename: 'retry-me.png',
    brandName: 'Submitted Retry Brand',
    classType: 'Straight Rye',
    beverageType: 'distilled-spirits',
    status: 'error',
    previewUrl: null,
    isPdf: false,
    sizeLabel: '1 KB',
    issues: {
      blocker: 0,
      major: 0,
      minor: 0,
      note: 0
    },
    confidenceState: 'low-confidence',
    errorMessage: 'We could not finish this item right now.',
    completedOrder: 2
  };
}

describe('batch retry visual state', () => {
  it('shows a visible retrying state in the processing stream', () => {
    const html = renderToStaticMarkup(
      <StreamBlock
        items={[makeErroredStreamItem()]}
        retryingItemIds={new Set(['image-retry'])}
        onRetryItem={vi.fn()}
        onPreviewItem={vi.fn()}
        streamEmptyLabel="No items yet."
      />
    );

    expect(html).toContain('Retrying...');
    expect(html).toContain('Retry in progress.');
    expect(html).toContain('disabled=""');
  });

  it('shows a visible retrying state in the dashboard table', () => {
    const html = renderToStaticMarkup(
      <TriageTable
        rows={[makeErroredDashboardRow()]}
        reviewedIds={new Set<string>()}
        retryingRowIds={new Set(['row-retry'])}
        onOpenRow={vi.fn()}
        onRetryRow={vi.fn()}
      />
    );

    expect(html).toContain('Retrying...');
    expect(html).toContain('disabled=""');
  });
});
