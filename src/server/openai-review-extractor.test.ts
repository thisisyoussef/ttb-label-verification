import { describe, expect, it, vi } from 'vitest';

import { reviewExtractionSchema } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import {
  buildReviewExtractionRequest,
  createOpenAIReviewExtractor,
  readReviewExtractionConfig
} from './openai-review-extractor';

function buildIntake(
  overrides: Partial<NormalizedReviewIntake> = {}
): NormalizedReviewIntake {
  return {
    label: {
      originalName: 'label.png',
      mimeType: 'image/png',
      bytes: 4,
      buffer: Buffer.from([1, 2, 3, 4])
    },
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

function requestContent(request: ReturnType<typeof buildReviewExtractionRequest>) {
  const firstInput = request.input?.[0];

  if (!firstInput || typeof firstInput === 'string' || !('content' in firstInput)) {
    throw new Error('Expected the request to include a user content block.');
  }

  if (!firstInput.content) {
    throw new Error('Expected the request to include content parts.');
  }

  return firstInput.content;
}

describe('OpenAI review extractor', () => {
  it('fails config loading when the API key is missing', () => {
    const result = readReviewExtractionConfig({
      OPENAI_API_KEY: '',
      OPENAI_VISION_MODEL: 'gpt-5.4',
      OPENAI_STORE: 'false'
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected config loading to fail.');
    }

    expect(result.error.kind).toBe('adapter');
    expect(result.status).toBe(503);
  });

  it('defaults to the lower-latency OpenAI fallback profile and parses optional knobs', () => {
    const result = readReviewExtractionConfig({
      OPENAI_API_KEY: 'test-key',
      OPENAI_STORE: 'false',
      OPENAI_VISION_DETAIL: 'auto',
      OPENAI_SERVICE_TIER: 'priority'
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected config loading to succeed.');
    }

    expect(result.value.visionModel).toBe('gpt-5.4-mini');
    expect(result.value.imageDetail).toBe('auto');
    expect(result.value.serviceTier).toBe('priority');
  });

  it('builds an image extraction request with store disabled and structured output parsing', () => {
    const request = buildReviewExtractionRequest({
      intake: buildIntake(),
      config: {
        apiKey: 'test-key',
        visionModel: 'gpt-5.4',
        store: false,
        imageDetail: 'auto',
        serviceTier: 'priority'
      }
    });

    expect(request.store).toBe(false);
    expect(request.model).toBe('gpt-5.4');
    expect(request.service_tier).toBe('priority');
    expect(request.text).toBeDefined();
    const content = requestContent(request);

    expect(content[1]).toMatchObject({
      type: 'input_image',
      detail: 'auto'
    });
    expect((content[1] as { image_url: string }).image_url).toContain('data:image/png;base64,');
  });

  it('builds an image extraction request even when the original was a PDF (converted upstream)', () => {
    // PDFs are converted to PNG by pdf-label-converter.ts at the intake
    // boundary, so the extractor always receives an image buffer.
    const request = buildReviewExtractionRequest({
      intake: buildIntake({
        label: {
          originalName: 'label.png',
          mimeType: 'image/png',
          bytes: 4,
          buffer: Buffer.from('PNG!')
        }
      }),
      config: {
        apiKey: 'test-key',
        visionModel: 'gpt-5.4',
        store: false
      }
    });

    const content = requestContent(request);

    expect(content[1]).toMatchObject({
      type: 'input_image'
    });
    expect((content[1] as { image_url: string }).image_url).toContain(
      'data:image/png;base64,'
    );
  });

  it('parses the model output and resolves the final beverage type', async () => {
    const client = {
      parse: vi.fn().mockResolvedValue({
        output_parsed: buildModelOutput()
      })
    };

    const extractor = createOpenAIReviewExtractor({
      client,
      config: {
        apiKey: 'test-key',
        visionModel: 'gpt-5.4',
        store: false
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

    expect(client.parse).toHaveBeenCalledTimes(1);
    expect(payload.beverageType).toBe('wine');
    expect(payload.beverageTypeSource).toBe('class-type');
    expect(reviewExtractionSchema.parse(payload).summary).toContain('Structured extraction');
  });
});
