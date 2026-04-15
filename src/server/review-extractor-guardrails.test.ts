import { describe, expect, it } from 'vitest';

import { buildRawReviewModelOutput } from './testing/llm-fixture-builders';
import { applyReviewExtractorGuardrails } from './review-extractor-guardrails';

describe('review extractor guardrails', () => {
  it('sanitizes contradictory no-text outputs into explicit uncertainty', () => {
    const result = applyReviewExtractorGuardrails({
      surface: '/api/review/extraction',
      extractionMode: 'cloud',
      output: buildRawReviewModelOutput({
        imageQuality: {
          noTextDetected: true,
          score: 0.05,
          issues: ['blur']
        }
      })
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected guardrails to sanitize contradictory no-text output.');
    }

    expect(result.value.fields.brandName.present).toBe(false);
    expect(result.value.fields.governmentWarning.present).toBe(false);
    expect(result.value.warningSignals.prefixAllCaps.status).toBe('uncertain');
  });

  it('preserves genuine warning absence while downgrading unsupported warning-signal certainty', () => {
    const result = applyReviewExtractorGuardrails({
      surface: '/api/review/warning',
      extractionMode: 'cloud',
      output: buildRawReviewModelOutput({
        fields: {
          governmentWarning: {
            present: false,
            value: null,
            confidence: 0.93,
            note: null
          }
        },
        warningSignals: {
          prefixAllCaps: {
            status: 'yes',
            confidence: 0.94,
            note: null
          },
          prefixBold: {
            status: 'yes',
            confidence: 0.92,
            note: null
          }
        }
      })
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected guardrails to preserve warning absence.');
    }

    expect(result.value.fields.governmentWarning.present).toBe(false);
    expect(result.value.warningSignals.prefixAllCaps.status).toBe('uncertain');
    expect(result.value.warningSignals.prefixBold.status).toBe('uncertain');
  });

  it('downgrades local-only formatting and spatial certainty', () => {
    const result = applyReviewExtractorGuardrails({
      surface: '/api/review',
      extractionMode: 'local',
      output: buildRawReviewModelOutput({
        warningSignals: {
          prefixBold: {
            status: 'yes',
            confidence: 0.95,
            note: null
          },
          continuousParagraph: {
            status: 'yes',
            confidence: 0.93,
            note: null
          },
          separateFromOtherContent: {
            status: 'no',
            confidence: 0.88,
            note: null
          }
        }
      })
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected local-mode guardrails to downgrade instead of fail.');
    }

    expect(result.value.warningSignals.prefixBold.status).toBe('uncertain');
    expect(result.value.warningSignals.continuousParagraph.status).toBe(
      'uncertain'
    );
    expect(result.value.warningSignals.separateFromOtherContent.status).toBe(
      'uncertain'
    );
  });
});
