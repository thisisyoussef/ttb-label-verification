import { describe, expect, it } from 'vitest';

import { helpManifestSchema, tourStepSchema } from './help';

describe('help contracts', () => {
  it('parses a valid help manifest', () => {
    const manifest = helpManifestSchema.parse({
      version: 1,
      locale: 'en',
      tourSteps: [
        {
          anchorKey: 'orientation',
          stepIndex: 1,
          totalSteps: 1,
          title: 'Start here',
          body: 'Use this guided tour to understand the review flow.',
          target: 'tour-launcher',
          interaction: 'passive',
        },
      ],
      infoPopovers: [
        {
          anchorKey: 'warning-evidence',
          title: 'Warning evidence',
          body: 'This explains why the government warning check failed.',
        },
      ],
    });

    expect(manifest.locale).toBe('en');
    expect(manifest.tourSteps).toHaveLength(1);
    expect(manifest.infoPopovers).toHaveLength(1);
  });

  it('rejects tour steps whose index exceeds the declared total', () => {
    expect(() =>
      tourStepSchema.parse({
        anchorKey: 'orientation',
        stepIndex: 2,
        totalSteps: 1,
        title: 'Broken step',
        body: 'This should not parse.',
      }),
    ).toThrow(/total/i);
  });

  it('rejects help manifests with incomplete info popovers', () => {
    expect(() =>
      helpManifestSchema.parse({
        version: 1,
        locale: 'en',
        tourSteps: [
          {
            anchorKey: 'orientation',
            stepIndex: 1,
            totalSteps: 1,
            title: 'Start here',
            body: 'Use this guided tour to understand the review flow.',
          },
        ],
        infoPopovers: [
          {
            anchorKey: 'warning-evidence',
            title: 'Missing body',
          },
        ],
      }),
    ).toThrow(/body/i);
  });
});
