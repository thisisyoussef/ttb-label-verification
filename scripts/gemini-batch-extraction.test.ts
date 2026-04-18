import { describe, expect, it } from 'vitest';

import {
  buildGeminiBatchInlineRequests,
  parseGeminiBatchExtractionResponses,
  summarizeGeminiBatchExtractionResults,
  type LoadedGeminiBatchCase
} from './gemini-batch-extraction';

function buildCase(
  overrides: Partial<LoadedGeminiBatchCase> = {}
): LoadedGeminiBatchCase {
  return {
    id: 'cola-cloud-001',
    title: 'Heritage Hill Reserve',
    source: 'cola-cloud',
    beverageType: 'wine',
    expectedRecommendation: 'approve',
    label: {
      originalName: 'heritage-hill.webp',
      mimeType: 'image/webp',
      bytes: 4,
      buffer: Buffer.from([1, 2, 3, 4])
    },
    fields: {
      beverageTypeHint: 'wine',
      origin: 'imported',
      brandName: 'Heritage Hill',
      fancifulName: 'Reserve',
      classType: 'Red Wine',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: undefined,
      country: 'France',
      formulaId: undefined,
      appellation: 'Bordeaux',
      vintage: '2021',
      varietals: []
    },
    hasApplicationData: true,
    standalone: false,
    expectedFields: {
      brandName: 'Heritage Hill',
      fancifulName: 'Reserve',
      classType: 'Red Wine',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      appellation: 'Bordeaux',
      vintage: '2021'
    },
    ...overrides
  };
}

function buildModelOutput(overrides: Record<string, unknown> = {}) {
  return {
    beverageTypeHint: 'wine',
    fields: {
      brandName: {
        present: true,
        value: 'Heritage Hill',
        confidence: 0.95,
        note: null
      },
      fancifulName: {
        present: true,
        value: 'Reserve',
        confidence: 0.9,
        note: null
      },
      classType: {
        present: true,
        value: 'Red Wine',
        confidence: 0.93,
        note: null
      },
      alcoholContent: {
        present: true,
        value: '13.5% Alc./Vol.',
        confidence: 0.91,
        note: null
      },
      netContents: {
        present: true,
        value: '750 mL',
        confidence: 0.92,
        note: null
      },
      applicantAddress: {
        present: false,
        value: null,
        confidence: 0.1,
        note: null
      },
      countryOfOrigin: {
        present: true,
        value: 'France',
        confidence: 0.72,
        note: null
      },
      ageStatement: {
        present: false,
        value: null,
        confidence: 0.05,
        note: null
      },
      sulfiteDeclaration: {
        present: false,
        value: null,
        confidence: 0.05,
        note: null
      },
      appellation: {
        present: true,
        value: 'Bordeaux',
        confidence: 0.83,
        note: null
      },
      vintage: {
        present: true,
        value: '2021',
        confidence: 0.88,
        note: null
      },
      governmentWarning: {
        present: true,
        value: 'GOVERNMENT WARNING: test',
        confidence: 0.8,
        note: null
      },
      varietals: []
    },
    warningSignals: {
      prefixAllCaps: { status: 'yes', confidence: 0.9, note: null },
      prefixBold: { status: 'uncertain', confidence: 0.4, note: null },
      continuousParagraph: { status: 'yes', confidence: 0.9, note: null },
      separateFromOtherContent: { status: 'yes', confidence: 0.9, note: null }
    },
    imageQuality: {
      score: 0.9,
      issues: [],
      noTextDetected: false,
      note: null
    },
    summary: 'Structured extraction completed successfully.',
    ...overrides
  };
}

describe('gemini batch extraction helpers', () => {
  it('builds inline requests with case metadata and inline image parts', () => {
    const { requests, estimatedBytes } = buildGeminiBatchInlineRequests({
      cases: [buildCase()],
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite',
        mediaResolution: 'low',
        thinkingBudget: 0
      },
      maxBytes: 1024 * 1024
    });

    expect(requests).toHaveLength(1);
    expect(estimatedBytes).toBeGreaterThan(0);
    expect(requests[0]?.metadata).toMatchObject({
      caseId: 'cola-cloud-001',
      source: 'cola-cloud'
    });
    expect(requests[0]?.contents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inlineData: expect.objectContaining({
            mimeType: 'image/webp'
          })
        })
      ])
    );
  });

  it('fails closed when the inline batch payload exceeds the configured ceiling', () => {
    expect(() =>
      buildGeminiBatchInlineRequests({
        cases: [
          buildCase({
            label: {
              originalName: 'huge.webp',
              mimeType: 'image/webp',
              bytes: 512,
              buffer: Buffer.alloc(512, 7)
            }
          })
        ],
        config: {
          apiKey: 'test-key',
          visionModel: 'gemini-2.5-flash-lite'
        },
        maxBytes: 100
      })
    ).toThrow(/inline batch payload/i);
  });

  it('parses batch success, request-local error, malformed json, and schema failure', () => {
    const cases = [
      buildCase({ id: 'success-case' }),
      buildCase({ id: 'error-case' }),
      buildCase({ id: 'parse-case' }),
      buildCase({ id: 'schema-case' })
    ];

    const results = parseGeminiBatchExtractionResponses({
      cases,
      responses: [
        {
          metadata: { caseId: 'success-case' },
          response: {
            text: JSON.stringify(buildModelOutput())
          }
        },
        {
          metadata: { caseId: 'error-case' },
          error: {
            message: 'quota'
          }
        },
        {
          metadata: { caseId: 'parse-case' },
          response: {
            text: '{not-json'
          }
        },
        {
          metadata: { caseId: 'schema-case' },
          response: {
            text: JSON.stringify({ invalid: true })
          }
        }
      ]
    });

    expect(results.map((result) => result.status)).toEqual([
      'success',
      'request-error',
      'parse-error',
      'schema-error'
    ]);
    expect(results[0]).toMatchObject({
      caseId: 'success-case',
      output: {
        fields: {
          brandName: {
            value: 'Heritage Hill'
          }
        }
      }
    });
  });

  it('summarizes success-only field metrics from parsed results', () => {
    const results = parseGeminiBatchExtractionResponses({
      cases: [
        buildCase({ id: 'exact-case' }),
        buildCase({
          id: 'cosmetic-case',
          expectedFields: {
            brandName: 'heritage hill',
            fancifulName: 'reserve',
            classType: 'red wine',
            alcoholContent: '13.5% alc./vol.',
            netContents: '750 ml',
            appellation: 'bordeaux',
            vintage: '2021'
          }
        }),
        buildCase({ id: 'missing-case' })
      ],
      responses: [
        {
          metadata: { caseId: 'exact-case' },
          response: {
            text: JSON.stringify(buildModelOutput())
          }
        },
        {
          metadata: { caseId: 'cosmetic-case' },
          response: {
            text: JSON.stringify(buildModelOutput())
          }
        },
        {
          metadata: { caseId: 'missing-case' },
          response: {
            text: JSON.stringify(
              buildModelOutput({
                fields: {
                  ...buildModelOutput().fields,
                  brandName: {
                    present: false,
                    value: null,
                    confidence: 0.1,
                    note: null
                  }
                }
              })
            )
          }
        }
      ]
    });

    const summary = summarizeGeminiBatchExtractionResults(results);

    expect(summary.successCount).toBe(3);
    expect(summary.fieldMetrics.brandName.exact).toBe(1);
    expect(summary.fieldMetrics.brandName.cosmetic).toBe(1);
    expect(summary.fieldMetrics.brandName.missing).toBe(1);
  });
});
