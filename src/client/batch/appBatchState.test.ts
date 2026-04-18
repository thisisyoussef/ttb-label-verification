import { describe, expect, it } from 'vitest';

import {
  LIVE_BATCH_SEED_ID,
  nextBatchWorkflowSource,
  usesFixtureBatchSource
} from './appBatchState';

describe('batch workflow source helpers', () => {
  it('defaults to the live batch source with no fixture selection', () => {
    expect(LIVE_BATCH_SEED_ID).toBe('live-batch');
    expect(usesFixtureBatchSource('live')).toBe(false);
  });

  it('switches to fixture mode only after explicit fixture selections', () => {
    expect(
      nextBatchWorkflowSource({
        current: 'live',
        event: 'fixture-selected'
      })
    ).toBe('fixture');

    expect(
      nextBatchWorkflowSource({
        current: 'fixture',
        event: 'stream-seed-selected'
      })
    ).toBe('fixture');
  });

  it('returns to live mode when live input or reset actions occur', () => {
    expect(
      nextBatchWorkflowSource({
        current: 'fixture',
        event: 'live-input-selected'
      })
    ).toBe('live');

    expect(
      nextBatchWorkflowSource({
        current: 'fixture',
        event: 'reset'
      })
    ).toBe('live');
  });
});
