import { describe, expect, it } from 'vitest';

import { resolveToolbenchAssetRoute } from './toolbenchRouteState';

describe('toolbench route state', () => {
  it('keeps direct image loads in single review when single mode is active', () => {
    expect(
      resolveToolbenchAssetRoute({ mode: 'single', kind: 'image' })
    ).toBe('single-image');
  });

  it('routes direct image loads into batch when batch mode is active', () => {
    expect(
      resolveToolbenchAssetRoute({ mode: 'batch', kind: 'image' })
    ).toBe('batch-image');
  });

  it('always routes csv assets into batch', () => {
    expect(
      resolveToolbenchAssetRoute({ mode: 'single', kind: 'csv' })
    ).toBe('batch-csv');
    expect(
      resolveToolbenchAssetRoute({ mode: 'batch', kind: 'csv' })
    ).toBe('batch-csv');
  });
});
