import { describe, expect, it } from 'vitest';

import { DEFAULT_FAILURE_MESSAGE } from '../reviewFailureMessage';
import { buildToolbenchSampleLoadState } from './toolbenchSingleSample';

describe('buildToolbenchSampleLoadState', () => {
  it('maps sample fields into intake state and clears stale single-review session state', () => {
    expect(
      buildToolbenchSampleLoadState({
        brandName: 'River Stone',
        fancifulName: 'Private Cask',
        classType: 'Straight Bourbon Whiskey',
        alcoholContent: '45% Alc./Vol.',
        netContents: '750 mL',
        applicantAddress: 'River Stone Distilling, Louisville, KY',
        origin: 'imported',
        country: 'Canada',
        formulaId: 'F-123',
        appellation: 'Napa Valley',
        vintage: '2021'
      })
    ).toEqual({
      beverage: 'auto',
      fields: {
        brandName: 'River Stone',
        fancifulName: 'Private Cask',
        classType: 'Straight Bourbon Whiskey',
        alcoholContent: '45% Alc./Vol.',
        netContents: '750 mL',
        applicantAddress: 'River Stone Distilling, Louisville, KY',
        origin: 'imported',
        country: 'Canada',
        formulaId: 'F-123',
        appellation: 'Napa Valley',
        vintage: '2021',
        varietals: []
      },
      scenarioId: 'blank',
      forceFailure: false,
      variantOverride: 'auto',
      report: null,
      phase: 'running',
      failureMessage: DEFAULT_FAILURE_MESSAGE
    });
  });
});
