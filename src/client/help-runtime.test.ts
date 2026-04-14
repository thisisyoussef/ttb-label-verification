import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_HELP_MANIFEST } from '../shared/help-fixture';
import { findInfoPopover, getTourSteps, resetHelpManifest } from './helpManifest';
import { loadRemoteHelpManifest } from './help-runtime';

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('help runtime', () => {
  afterEach(() => {
    resetHelpManifest();
  });

  it('loads the remote help manifest and updates the active client manifest', async () => {
    const remoteManifest = {
      ...LOCAL_HELP_MANIFEST,
      version: 99,
      tourSteps: [
        {
          ...LOCAL_HELP_MANIFEST.tourSteps[0],
          title: 'Remote orientation',
        },
        ...LOCAL_HELP_MANIFEST.tourSteps.slice(1),
      ],
      infoPopovers: LOCAL_HELP_MANIFEST.infoPopovers.map((popover) =>
        popover.anchorKey === 'warning-evidence'
          ? {
              ...popover,
              body: 'Remote warning evidence guidance.',
            }
          : popover,
      ),
    };
    const fetcher = vi.fn(async () => createJsonResponse(remoteManifest));

    const result = await loadRemoteHelpManifest({ fetcher });

    expect(fetcher).toHaveBeenCalledWith('/api/help/manifest?locale=en');
    expect(result.source).toBe('remote');
    expect(getTourSteps()[0]?.title).toBe('Remote orientation');
    expect(findInfoPopover('warning-evidence')?.body).toBe(
      'Remote warning evidence guidance.',
    );
  });

  it('falls back to the local fixture when the remote manifest is unavailable', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down');
    });

    const result = await loadRemoteHelpManifest({ fetcher });

    expect(result.source).toBe('fixture');
    expect(getTourSteps()).toEqual(LOCAL_HELP_MANIFEST.tourSteps);
    expect(findInfoPopover('warning-evidence')).toEqual(
      LOCAL_HELP_MANIFEST.infoPopovers.find(
        (popover) => popover.anchorKey === 'warning-evidence',
      ),
    );
  });

  it('uses the plain-language warning help copy in the local fixture', () => {
    expect(
      getTourSteps().find((step) => step.anchorKey === 'warning-evidence')?.body,
    ).toContain('highlights the exact wording, punctuation, or capitalization');
    expect(findInfoPopover('warning-evidence')?.body).toContain(
      'The text comparison below highlights the exact words, letters, or punctuation',
    );
  });

  it('falls back to the local fixture when the remote manifest payload is invalid', async () => {
    const fetcher = vi.fn(async () =>
      createJsonResponse({
        version: 1,
        locale: 'en',
        tourSteps: [],
        infoPopovers: [],
      }),
    );

    const result = await loadRemoteHelpManifest({ fetcher });

    expect(result.source).toBe('fixture');
    expect(getTourSteps()).toEqual(LOCAL_HELP_MANIFEST.tourSteps);
  });
});
