import { afterEach, describe, expect, it, vi } from 'vitest';

import { reviewExtractionSchema } from '../../shared/contracts/review';
import type { NormalizedReviewIntake } from '../review/review-intake';
import {
  createReviewLatencyCapture,
  REVIEW_FALLBACK_DETERMINISTIC_RESERVE_MS
} from '../review/review-latency';
import { createReviewExtractionFailure } from './review-extraction';
import {
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
  attemptBudgetMs?: number;
}): ReviewExtractorProvider {
  return {
    provider: input.provider,
    supports: () => true,
    execute: input.execute,
    attemptBudgetMs: input.attemptBudgetMs
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('review extractor factory first-result deadline', () => {
  it('falls back when enough first-result budget remains for the next provider', async () => {
    vi.useFakeTimers();

    const primaryElapsedMs = 250;
    const fallbackAttemptBudgetMs = 200;
    const geminiExecute = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, primaryElapsedMs));
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
          execute: geminiExecute,
          attemptBudgetMs: 5000
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute,
          attemptBudgetMs: fallbackAttemptBudgetMs
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

    const latencyCapture = createReviewLatencyCapture({
      surface: '/api/review',
      firstResultBudgetMs:
        primaryElapsedMs +
        fallbackAttemptBudgetMs +
        REVIEW_FALLBACK_DETERMINISTIC_RESERVE_MS +
        50
    });

    const extractionPromise = resolution.value.extractor(buildIntake(), {
      latencyCapture
    });

    await vi.advanceTimersByTimeAsync(primaryElapsedMs);
    const extraction = await extractionPromise;

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).toHaveBeenCalledTimes(1);
    expect(extraction.id).toBe('extract-factory-001');
  });

  it('does not fall back when the remaining first-result budget cannot cover the next provider', async () => {
    vi.useFakeTimers();

    const primaryElapsedMs = 250;
    const fallbackAttemptBudgetMs = 200;
    const geminiExecute = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, primaryElapsedMs));
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
          execute: geminiExecute,
          attemptBudgetMs: 5000
        })
      }),
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute,
          attemptBudgetMs: fallbackAttemptBudgetMs
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

    const latencyCapture = createReviewLatencyCapture({
      surface: '/api/review',
      firstResultBudgetMs:
        primaryElapsedMs +
        fallbackAttemptBudgetMs +
        REVIEW_FALLBACK_DETERMINISTIC_RESERVE_MS -
        50
    });

    const extractionPromise = resolution.value.extractor(buildIntake(), {
      latencyCapture
    });
    const rejection = expect(extractionPromise).rejects.toMatchObject({
      status: 504,
      error: {
        kind: 'timeout',
        retryable: true
      }
    });

    await vi.advanceTimersByTimeAsync(primaryElapsedMs);
    await rejection;
    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).not.toHaveBeenCalled();
  });
});
