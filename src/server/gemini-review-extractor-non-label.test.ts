import { describe, expect, it, vi } from 'vitest';

import { createGeminiReviewExtractor } from './gemini-review-extractor';
import type { NormalizedReviewIntake } from './review-intake';

function buildIntake(
  overrides: Partial<NormalizedReviewIntake> = {}
): NormalizedReviewIntake {
  const defaultLabel = {
    originalName: 'artwork.png',
    mimeType: 'image/png',
    bytes: 4,
    buffer: Buffer.from([1, 2, 3, 4])
  };
  const label = overrides.label ?? defaultLabel;
  const labels = overrides.labels ?? [label];

  return {
    label,
    labels,
    fields: {
      beverageTypeHint: 'auto',
      origin: 'domestic',
      varietals: []
    },
    hasApplicationData: false,
    standalone: true,
    ...overrides
  };
}

describe('Gemini review extractor non-label guardrails', () => {
  it('returns unknown for auto-detect when the model cannot support a beverage type on a non-label image', async () => {
    const client = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          beverageTypeHint: null,
          fields: {
            brandName: {
              present: true,
              value: 'Sunset Dreams',
              confidence: 0.61,
              note: null
            },
            fancifulName: {
              present: false,
              value: null,
              confidence: 0.08,
              note: null
            },
            classType: {
              present: false,
              value: null,
              confidence: 0.12,
              note: null
            },
            alcoholContent: {
              present: false,
              value: null,
              confidence: 0.11,
              note: null
            },
            netContents: {
              present: false,
              value: null,
              confidence: 0.1,
              note: null
            },
            applicantAddress: {
              present: false,
              value: null,
              confidence: 0.09,
              note: null
            },
            countryOfOrigin: {
              present: false,
              value: null,
              confidence: 0.08,
              note: null
            },
            ageStatement: {
              present: false,
              value: null,
              confidence: 0.07,
              note: null
            },
            sulfiteDeclaration: {
              present: false,
              value: null,
              confidence: 0.07,
              note: null
            },
            appellation: {
              present: false,
              value: null,
              confidence: 0.07,
              note: null
            },
            vintage: {
              present: false,
              value: null,
              confidence: 0.07,
              note: null
            },
            governmentWarning: {
              present: false,
              value: null,
              confidence: 0.08,
              note: null
            },
            varietals: []
          },
          warningSignals: {
            prefixAllCaps: {
              status: 'uncertain',
              confidence: 0.12,
              note: null
            },
            prefixBold: {
              status: 'uncertain',
              confidence: 0.11,
              note: null
            },
            continuousParagraph: {
              status: 'uncertain',
              confidence: 0.12,
              note: null
            },
            separateFromOtherContent: {
              status: 'uncertain',
              confidence: 0.11,
              note: null
            }
          },
          imageQuality: {
            score: 0.62,
            issues: ['Image appears to contain decorative artwork rather than a label.'],
            noTextDetected: false,
            note: null
          },
          summary: 'Sparse extraction from non-label artwork.'
        })
      })
    };

    const extractor = createGeminiReviewExtractor({
      client,
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite'
      }
    });

    const payload = await extractor(buildIntake());

    expect(payload.beverageType).toBe('unknown');
    expect(payload.beverageTypeSource).toBe('strict-fallback');
  });
});
