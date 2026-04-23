import { describe, expect, it } from 'vitest';

import { resolvePersistedToolbenchTab } from './useToolbenchState';

describe('resolvePersistedToolbenchTab', () => {
  it('maps the removed assets tab back to samples', () => {
    expect(resolvePersistedToolbenchTab('assets')).toBe('samples');
  });

  it('keeps supported tabs and rejects unknown values', () => {
    expect(resolvePersistedToolbenchTab('samples')).toBe('samples');
    expect(resolvePersistedToolbenchTab('actions')).toBe('actions');
    expect(resolvePersistedToolbenchTab('something-else')).toBe('samples');
  });
});
