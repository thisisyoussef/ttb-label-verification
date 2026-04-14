import { describe, expect, it, vi } from 'vitest';

import { reviewExtractionSchema } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import { createReviewExtractionFailure } from './review-extraction';
import {
  createConfiguredReviewExtractor,
  type ReviewExtractorProvider,
  type ReviewExtractorProviderFactories
} from './review-extractor-factory';

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

function buildExtractionPayload() {
  return reviewExtractionSchema.parse({
    id: 'extract-factory-001',
    model: 'gpt-5.4',
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

describe('review extractor factory', () => {
  it('falls back within cloud mode when the first provider has a retryable network failure', async () => {
    const openAiExecute = vi.fn().mockRejectedValue(
      createReviewExtractionFailure({
        status: 502,
        kind: 'network',
        message: 'OpenAI is temporarily unavailable.',
        retryable: true
      })
    );
    const geminiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());

    const providers: ReviewExtractorProviderFactories = {
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      }),
      gemini: () => ({
        success: true,
        provider: provider({
          provider: 'gemini',
          execute: geminiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {
        AI_CAPABILITY_LABEL_EXTRACTION_ORDER: 'openai,gemini'
      },
      providers
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    const extraction = await resolution.value.extractor(buildIntake());

    expect(openAiExecute).toHaveBeenCalledTimes(1);
    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(extraction.id).toBe('extract-factory-001');
  });

  it('fails closed when local mode is explicitly selected and no local provider is available', () => {
    const resolution = createConfiguredReviewExtractor({
      env: {
        AI_EXTRACTION_MODE_ALLOW_LOCAL: 'true'
      },
      requestedMode: 'local',
      providers: {}
    });

    expect(resolution.success).toBe(false);
    if (resolution.success) {
      throw new Error('Expected local-only extractor resolution to fail.');
    }

    expect(resolution.extractionMode).toBe('local');
    expect(resolution.status).toBe(503);
    expect(resolution.error.kind).toBe('adapter');
    expect(resolution.error.message).toContain('Local extraction');
  });

  it('keeps the current OpenAI-first live path when later cloud fallbacks are unavailable', () => {
    const openAiExecute = vi.fn().mockResolvedValue(buildExtractionPayload());
    const providers: ReviewExtractorProviderFactories = {
      openai: () => ({
        success: true,
        provider: provider({
          provider: 'openai',
          execute: openAiExecute
        })
      })
    };

    const resolution = createConfiguredReviewExtractor({
      env: {
        AI_CAPABILITY_LABEL_EXTRACTION_ORDER: 'openai,gemini'
      },
      providers
    });

    expect(resolution.success).toBe(true);
    if (!resolution.success) {
      throw new Error('Expected extractor resolution to succeed.');
    }

    expect(resolution.value.providers).toEqual(['openai']);
  });
});
