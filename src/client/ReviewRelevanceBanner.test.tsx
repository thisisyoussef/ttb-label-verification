import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ReviewRelevanceBanner } from './ReviewRelevanceBanner';

describe('ReviewRelevanceBanner', () => {
  it('renders nothing when the quick scan thinks the image is likely relevant', () => {
    const html = renderToStaticMarkup(
      <ReviewRelevanceBanner
        pending={false}
        relevance={{
          decision: 'likely-label',
          confidence: 0.9,
          summary: 'Quick scan found alcohol-label signals on this upload.',
          shouldPrefetchExtraction: true,
          continueAllowed: true,
          noPersistence: true,
          signals: {
            scannedImageCount: 1,
            textLength: 120,
            alcoholKeywordHits: 3,
            hasAlcoholContent: true,
            hasNetContents: true,
            hasGovernmentWarning: false,
            hasClassType: true,
            hasApplicantAddress: false,
            hasCountryOfOrigin: false
          }
        }}
        onTryAnotherImage={vi.fn()}
        onContinueAnyway={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('renders the quick-break warning when the image looks unlikely to be a readable label', () => {
    const html = renderToStaticMarkup(
      <ReviewRelevanceBanner
        pending={false}
        relevance={{
          decision: 'unlikely-label',
          confidence: 0.82,
          summary: 'Quick scan found text, but it does not look like a readable alcohol label yet.',
          shouldPrefetchExtraction: false,
          continueAllowed: true,
          noPersistence: true,
          signals: {
            scannedImageCount: 1,
            textLength: 18,
            alcoholKeywordHits: 0,
            hasAlcoholContent: false,
            hasNetContents: false,
            hasGovernmentWarning: false,
            hasClassType: false,
            hasApplicantAddress: false,
            hasCountryOfOrigin: false
          }
        }}
        onTryAnotherImage={vi.fn()}
        onContinueAnyway={vi.fn()}
      />
    );

    expect(html).toContain('This doesn&#x27;t look like a readable alcohol label yet.');
    expect(html).toContain('Try another image');
    expect(html).toContain('Continue anyway');
  });
});
