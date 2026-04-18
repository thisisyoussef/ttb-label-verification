import { MediaResolution, ServiceTier } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';

import { reviewExtractionSchema } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import { createReviewLatencyCapture } from './review-latency';
import {
  buildGeminiReviewExtractionRequest,
  createGeminiReviewExtractor,
  readGeminiReviewExtractionConfig
} from './gemini-review-extractor';

function buildIntake(
  overrides: Partial<NormalizedReviewIntake> = {}
): NormalizedReviewIntake {
  const defaultLabel = {
    originalName: 'label.png',
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

function buildModelOutput() {
  return {
    beverageTypeHint: 'wine',
    fields: {
      brandName: {
        present: true,
        value: 'Heritage Hill',
        confidence: 0.96,
        note: null
      },
      fancifulName: {
        present: false,
        value: null,
        confidence: 0.18,
        note: null
      },
      classType: {
        present: true,
        value: 'Red Wine',
        confidence: 0.94,
        note: null
      },
      alcoholContent: {
        present: true,
        value: '13.5% Alc./Vol.',
        confidence: 0.88,
        note: null
      },
      netContents: {
        present: true,
        value: '750 mL',
        confidence: 0.91,
        note: null
      },
      applicantAddress: {
        present: true,
        value: 'Heritage Hill Cellars, Napa, CA',
        confidence: 0.84,
        note: null
      },
      countryOfOrigin: {
        present: false,
        value: null,
        confidence: 0.14,
        note: null
      },
      ageStatement: {
        present: false,
        value: null,
        confidence: 0.1,
        note: null
      },
      sulfiteDeclaration: {
        present: false,
        value: null,
        confidence: 0.12,
        note: null
      },
      appellation: {
        present: true,
        value: 'Napa Valley',
        confidence: 0.79,
        note: null
      },
      vintage: {
        present: true,
        value: '2021',
        confidence: 0.74,
        note: null
      },
      governmentWarning: {
        present: true,
        value: 'GOVERNMENT WARNING: ...',
        confidence: 0.66,
        note: null
      },
      varietals: [
        {
          name: 'Cabernet Sauvignon',
          percentage: '75%',
          confidence: 0.7,
          note: null
        }
      ]
    },
    warningSignals: {
      prefixAllCaps: {
        status: 'yes',
        confidence: 0.94,
        note: null
      },
      prefixBold: {
        status: 'uncertain',
        confidence: 0.43,
        note: null
      },
      continuousParagraph: {
        status: 'yes',
        confidence: 0.86,
        note: null
      },
      separateFromOtherContent: {
        status: 'yes',
        confidence: 0.78,
        note: null
      }
    },
    imageQuality: {
      score: 0.81,
      issues: [],
      noTextDetected: false,
      note: null
    },
    summary: 'Structured extraction completed successfully.'
  };
}

describe('Gemini review extractor', () => {
  it('fails config loading when the API key is missing', () => {
    const result = readGeminiReviewExtractionConfig({
      GEMINI_API_KEY: '',
      GEMINI_VISION_MODEL: 'gemini-2.5-flash-lite'
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected config loading to fail.');
    }

    expect(result.error.kind).toBe('adapter');
    expect(result.status).toBe(503);
  });

  it('defaults to the PDF-capable Gemini vision model', () => {
    const result = readGeminiReviewExtractionConfig({
      GEMINI_API_KEY: 'test-key'
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected config loading to succeed.');
    }

    expect(result.value.visionModel).toBe('gemini-2.5-flash-lite');
  });

  it('parses optional Gemini latency profile knobs from env', () => {
    const result = readGeminiReviewExtractionConfig({
      GEMINI_API_KEY: 'test-key',
      GEMINI_VISION_MODEL: 'gemini-2.5-flash',
      GEMINI_MEDIA_RESOLUTION: 'medium',
      GEMINI_SERVICE_TIER: 'priority',
      GEMINI_THINKING_BUDGET: '-1'
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected config loading to succeed.');
    }

    expect(result.value.visionModel).toBe('gemini-2.5-flash');
    expect(result.value.mediaResolution).toBe('medium');
    expect(result.value.serviceTier).toBe('priority');
    expect(result.value.thinkingBudget).toBe(-1);
  });

  it('defaults Gemini 2.5 Flash-family models to thinkingBudget=0 for extraction', () => {
    const result = readGeminiReviewExtractionConfig({
      GEMINI_API_KEY: 'test-key',
      GEMINI_VISION_MODEL: 'gemini-2.5-flash'
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected config loading to succeed.');
    }

    expect(result.value.thinkingBudget).toBe(0);
  });

  it('builds an image extraction request with inline image bytes and structured output config', () => {
    const request = buildGeminiReviewExtractionRequest({
      intake: buildIntake(),
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite',
        mediaResolution: 'high',
        serviceTier: 'priority',
        thinkingBudget: 0
      },
      context: {
        surface: '/api/batch/run',
        extractionMode: 'local'
      }
    });

    expect(request.model).toBe('gemini-2.5-flash-lite');
    expect(request.config).toMatchObject({
      responseMimeType: 'application/json',
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
      serviceTier: ServiceTier.PRIORITY,
      thinkingConfig: {
        thinkingBudget: 0
      }
    });
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    expect(contents[0]).toMatchObject({
      text: expect.stringContaining(
        'Keep degradation item-local and concise so one weak label does not inflate session-wide noise.'
      )
    });
    expect(contents[1]).toMatchObject({
      inlineData: {
        mimeType: 'image/png'
      }
    });
  });

  it('includes both uploaded label images in order when a second image is present', () => {
    const request = buildGeminiReviewExtractionRequest({
      intake: buildIntake({
        labels: [
          {
            originalName: 'front.png',
            mimeType: 'image/png',
            bytes: 4,
            buffer: Buffer.from([1, 2, 3, 4])
          },
          {
            originalName: 'back.png',
            mimeType: 'image/png',
            bytes: 4,
            buffer: Buffer.from([5, 6, 7, 8])
          }
        ]
      }),
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite'
      }
    });

    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const images = contents.filter(
      (entry): entry is { inlineData: { mimeType: string; data: string } } =>
        typeof entry === 'object' && entry !== null && 'inlineData' in entry
    );

    expect(images).toHaveLength(2);
    expect(images[0].inlineData.mimeType).toBe('image/png');
    expect(images[1].inlineData.mimeType).toBe('image/png');
  });

  it('builds a pdf extraction request without durable uploads', () => {
    const request = buildGeminiReviewExtractionRequest({
      intake: buildIntake({
        label: {
          originalName: 'label.pdf',
          mimeType: 'application/pdf',
          bytes: 4,
          buffer: Buffer.from('%PDF')
        }
      }),
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite'
      }
    });

    expect(request.config?.mediaResolution).toBe(
      MediaResolution.MEDIA_RESOLUTION_MEDIUM
    );

    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    expect(contents[1]).toMatchObject({
      inlineData: {
        mimeType: 'application/pdf'
      }
    });
  });

  it('defaults raster image requests to low media resolution when no override is set', () => {
    const request = buildGeminiReviewExtractionRequest({
      intake: buildIntake(),
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite'
      }
    });

    expect(request.config?.mediaResolution).toBe(
      MediaResolution.MEDIA_RESOLUTION_LOW
    );
  });

  it('parses the model output and resolves the final beverage type', async () => {
    const client = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify(buildModelOutput())
      })
    };

    const extractor = createGeminiReviewExtractor({
      client,
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite'
      }
    });

    const payload = await extractor(
      buildIntake({
        fields: {
          beverageTypeHint: 'auto',
          origin: 'domestic',
          varietals: []
        }
      })
    );

    expect(client.generateContent).toHaveBeenCalledTimes(1);
    expect(payload.beverageType).toBe('wine');
    expect(payload.beverageTypeSource).toBe('class-type');
    expect(payload.model).toBe('gemini-2.5-flash-lite');
    expect(reviewExtractionSchema.parse(payload).summary).toContain('Structured extraction');
  });

  it('records Gemini service-tier and usage metadata in the latency summary', async () => {
    const client = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify(buildModelOutput()),
        sdkHttpResponse: {
          headers: {
            'x-gemini-service-tier': 'priority'
          }
        },
        usageMetadata: {
          promptTokenCount: 258,
          thoughtsTokenCount: 0
        }
      })
    };

    const extractor = createGeminiReviewExtractor({
      client,
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite'
      }
    });
    const latencyCapture = createReviewLatencyCapture({
      surface: '/api/review/extraction'
    });

    await extractor(buildIntake(), {
      latencyAttempt: 'primary',
      latencyCapture
    });

    const summary = latencyCapture.finalize();

    expect(summary.providerMetadata).toEqual([
      {
        provider: 'gemini',
        attempt: 'primary',
        serviceTier: 'priority',
        promptTokenCount: 258,
        thoughtsTokenCount: 0
      }
    ]);
  });

  it('treats malformed JSON as a retryable adapter failure', async () => {
    const client = {
      generateContent: vi.fn().mockResolvedValue({
        text: '{not-json'
      })
    };

    const extractor = createGeminiReviewExtractor({
      client,
      config: {
        apiKey: 'test-key',
        visionModel: 'gemini-2.5-flash-lite'
      }
    });

    await expect(extractor(buildIntake())).rejects.toMatchObject({
      status: 502,
      error: {
        kind: 'adapter',
        retryable: true
      }
    });
  });
});
