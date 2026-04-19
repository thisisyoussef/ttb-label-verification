import { describe, expect, it } from 'vitest';

import { resolveVerifyIntent } from './singleReviewFlowSupport';

describe('resolveVerifyIntent', () => {
  it('disables verify when no image is selected', () => {
    expect(
      resolveVerifyIntent({
        hasImage: false,
        relevance: null
      })
    ).toBe('disabled');
  });

  it('requires confirmation when the quick scan marked the image unlikely', () => {
    expect(
      resolveVerifyIntent({
        hasImage: true,
        relevance: {
          decision: 'unlikely-label',
          confidence: 0.8,
          summary: 'Quick scan could not find readable label text on this upload.',
          shouldPrefetchExtraction: false,
          continueAllowed: true,
          noPersistence: true,
          signals: {
            scannedImageCount: 1,
            textLength: 0,
            alcoholKeywordHits: 0,
            hasAlcoholContent: false,
            hasNetContents: false,
            hasGovernmentWarning: false,
            hasClassType: false,
            hasApplicantAddress: false,
            hasCountryOfOrigin: false
          }
        }
      })
    ).toBe('confirm-unlikely');
  });

  it('submits immediately for likely and uncertain images', () => {
    expect(
      resolveVerifyIntent({
        hasImage: true,
        relevance: {
          decision: 'uncertain',
          confidence: 0.57,
          summary:
            'Quick scan found some readable text, but not enough label-specific evidence to trust it yet.',
          shouldPrefetchExtraction: false,
          continueAllowed: true,
          noPersistence: true,
          signals: {
            scannedImageCount: 1,
            textLength: 24,
            alcoholKeywordHits: 1,
            hasAlcoholContent: false,
            hasNetContents: true,
            hasGovernmentWarning: false,
            hasClassType: false,
            hasApplicantAddress: false,
            hasCountryOfOrigin: false
          }
        }
      })
    ).toBe('submit');
  });
});
