import { afterEach, describe, expect, it, vi } from 'vitest';

import { reviewExtractionSchema } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import { createReviewLatencyCapture } from './review-latency';
import { createReviewExtractionFailure } from './review-extraction';
import {
  ReviewProviderFailure,
  createConfiguredReviewExtractor,
  type ReviewExtractorProvider,
  type ReviewExtractorProviderFactories
} from './review-extractor-factory';

function buildIntake(
  overrides: Partial<NormalizedReviewIntake> = {}
): NormalizedReviewIntake {
  const label = overrides.label ?? {
    originalName: 'label.png',
    mimeType: 'image/png',
    bytes: 4,
    buffer: Buffer.from([1, 2, 3, 4])
  };
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

function buildExtractionPayload(model = 'gpt-5.4') {
  return reviewExtractionSchema.parse({
    id: 'extract-factory-001',
    model,
    beverageType: 'distilled-spirits',
    beverageTypeSource: 'class-type',
    modelBeverageTypeHint: 'distilled-spirits',
    standalone: true,
    hasApplicationData: false,
    noPersistence: true,
    imageQuality: {
      score: 0.9,
      state: 'ok',
      issues: []
    },
    warningSignals: {
      prefixAllCaps: {
        status: 'yes',
        confidence: 0.98
      },
      prefixBold: {
        status: 'yes',
        confidence: 0.9
      },
      continuousParagraph: {
        status: 'yes',
        confidence: 0.91
      },
      separateFromOtherContent: {
        status: 'yes',
        confidence: 0.87
      }
    },
    fields: {
      brandName: {
        present: true,
        value: 'Fallback Brand',
        confidence: 0.94
      },
      fancifulName: {
        present: false,
        confidence: 0.08
      },
      classType: {
        present: true,
        value: 'Vodka',
        confidence: 0.92
      },
      alcoholContent: {
        present: true,
        value: '40% Alc./Vol.',
        confidence: 0.9
      },
      netContents: {
        present: true,
        value: '750 mL',
        confidence: 0.91
      },
      applicantAddress: {
        present: false,
        confidence: 0.08
      },
      countryOfOrigin: {
        present: false,
        confidence: 0.07
      },
      ageStatement: {
        present: false,
        confidence: 0.06
      },
      sulfiteDeclaration: {
        present: false,
        confidence: 0.06
      },
      appellation: {
        present: false,
        confidence: 0.05
      },
      vintage: {
        present: false,
        confidence: 0.05
      },
      governmentWarning: {
        present: true,
        value:
          'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
        confidence: 0.95
      },
      varietals: []
    },
    summary: 'Structured extraction completed successfully.'
  });
}

function provider(input: {
  provider: ReviewExtractorProvider['provider'];
  execute: ReviewExtractorProvider['execute'];
}): ReviewExtractorProvider {
  return {
    provider: input.provider,
    supports: () => true,
    execute: input.execute
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('review extractor factory', () => {
  it('uses Gemini first by default in cloud mode when both providers are available', async () => {
    const geminiExecute = vi
      .fn()
      .mockResolvedValue(buildExtractionPayload('gemini-2.5-flash-lite'));
    const openAiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());

    const providers: ReviewExtractorProviderFactories = {
      gemini: () => ({
        success: true,
        provider: provider({
          provider: 'gemini',
          execute: geminiExecute
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {},
      providers
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    expect(resolution.value.providers).toEqual(['gemini', 'openai']);

    const extraction = await resolution.value.extractor(buildIntake());

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).not.toHaveBeenCalled();
    expect(extraction.model).toBe('gemini-2.5-flash-lite');
  });

  it('falls back within cloud mode when Gemini has a retryable network failure', async () => {
    const geminiExecute = vi.fn().mockRejectedValue(
      createReviewExtractionFailure({
        status: 502,
        kind: 'network',
        message: 'Gemini is temporarily unavailable.',
        retryable: true
      })
    );
    const openAiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());

    const providers: ReviewExtractorProviderFactories = {
      gemini: () => ({
        success: true,
        provider: provider({
          provider: 'gemini',
          execute: geminiExecute
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {},
      providers
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    const extraction = await resolution.value.extractor(buildIntake());

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).toHaveBeenCalledTimes(1);
    expect(extraction.id).toBe('extract-factory-001');
  });

  it('falls back within cloud mode when Gemini has a retryable response-parse failure', async () => {
    const geminiExecute = vi.fn().mockRejectedValue(
      createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'We could not read the response from the label reading service. Try again.',
        retryable: true
      })
    );
    const openAiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());

    const providers: ReviewExtractorProviderFactories = {
      gemini: () => ({
        success: true,
        provider: provider({
          provider: 'gemini',
          execute: geminiExecute
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {},
      providers
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    const extraction = await resolution.value.extractor(buildIntake());

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).toHaveBeenCalledTimes(1);
    expect(extraction.id).toBe('extract-factory-001');
  });

  it('keeps OpenAI available when Gemini is missing configuration under the default cloud order', async () => {
    const openAiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());

    const providers: ReviewExtractorProviderFactories = {
      gemini: () => ({
        success: false,
        failure: new ReviewProviderFailure({
          status: 503,
          error: {
            kind: 'adapter',
            message: 'Cloud label reading is not set up on this workstation. Contact your administrator.',
            retryable: false
          },
          provider: 'gemini',
          mode: 'cloud',
          capability: 'label-extraction',
          reason: 'missing-configuration'
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {},
      providers
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    expect(resolution.value.providers).toEqual(['openai']);
    await resolution.value.extractor(buildIntake());
    expect(openAiExecute).toHaveBeenCalledTimes(1);
  });

  it('does not fall back after a late provider timeout once the retry budget is spent', async () => {
    vi.useFakeTimers();

    const geminiExecute = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 101));
      throw createReviewExtractionFailure({
        status: 504,
        kind: 'timeout',
        message: 'Gemini timed out.',
        retryable: true
      });
    });
    const openAiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());

    const providers: ReviewExtractorProviderFactories = {
      gemini: () => ({
        success: true,
        provider: provider({
          provider: 'gemini',
          execute: geminiExecute
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {},
      providers,
      maxRetryableFallbackElapsedMs: 100
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    const extractionPromise = resolution.value.extractor(buildIntake());
    const rejection = expect(extractionPromise).rejects.toMatchObject({
      status: 504,
      error: {
        kind: 'timeout',
        retryable: true
      }
    });

    await vi.advanceTimersByTimeAsync(101);
    await rejection;
    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).not.toHaveBeenCalled();
  });

  it('counts total route elapsed time before allowing fallback', async () => {
    vi.useFakeTimers();

    const geminiExecute = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 401));
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'network',
        message: 'Gemini is temporarily unavailable.',
        retryable: true
      });
    });
    const openAiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());

    const providers: ReviewExtractorProviderFactories = {
      gemini: () => ({
        success: true,
        provider: provider({
          provider: 'gemini',
          execute: geminiExecute
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {},
      providers,
      maxRetryableFallbackElapsedMs: 400
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    const latencyCapture = createReviewLatencyCapture({
      surface: '/api/review'
    });

    const extractionPromise = resolution.value.extractor(buildIntake(), {
      latencyCapture
    });
    const rejection = expect(extractionPromise).rejects.toMatchObject({
      status: 502,
      error: {
        kind: 'network',
        retryable: true
      }
    });

    await vi.advanceTimersByTimeAsync(401);
    await rejection;
    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).not.toHaveBeenCalled();
  });

  it('fails closed when local mode is explicitly selected and no local provider is available', () => {
    const failingFactory = () => ({
      success: false as const,
      failure: new ReviewProviderFailure({
        status: 503,
        error: { kind: 'adapter' as const, message: 'Not configured', retryable: false },
        provider: 'transformers' as const,
        mode: 'local' as const,
        capability: 'label-extraction' as const,
        reason: 'missing-configuration' as const
      })
    });

    const resolution = createConfiguredReviewExtractor({
      env: {
        AI_EXTRACTION_MODE_ALLOW_LOCAL: 'true'
      },
      requestedMode: 'local',
      providers: {
        transformers: failingFactory,
        ollama: failingFactory,
        'ollama-vlm': failingFactory
      }
    });

    expect(resolution.success).toBe(false);
    if (resolution.success) {
      throw new Error('Expected local-only extractor resolution to fail.');
    }

    expect(resolution.extractionMode).toBe('local');
    expect(resolution.status).toBe(503);
  });
});
