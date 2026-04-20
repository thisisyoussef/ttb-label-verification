import { describe, expect, it } from 'vitest';

import { resolveToolbenchSampleSectionIds } from './toolbenchSamplePanelState';

describe('resolveToolbenchSampleSectionIds', () => {
  it('keeps a stable capability placeholder in place while probes are still loading', () => {
    expect(
      resolveToolbenchSampleSectionIds({
        liveAvailability: 'loading',
        synthAvailability: 'loading'
      })
    ).toEqual([
      'random-sample',
      'capabilities-placeholder',
      'batch-sample',
      'sample-catalog'
    ]);
  });

  it('replaces the placeholder with the resolved live and synthetic sections once probes settle', () => {
    expect(
      resolveToolbenchSampleSectionIds({
        liveAvailability: 'available',
        synthAvailability: 'unavailable'
      })
    ).toEqual([
      'random-sample',
      'live-sample',
      'batch-sample',
      'sample-catalog'
    ]);

    expect(
      resolveToolbenchSampleSectionIds({
        liveAvailability: 'available',
        synthAvailability: 'available'
      })
    ).toEqual([
      'random-sample',
      'live-sample',
      'synthetic-sample',
      'batch-sample',
      'sample-catalog'
    ]);
  });
});
