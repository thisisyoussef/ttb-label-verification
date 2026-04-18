import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({ existsSync: vi.fn(() => true) }));

import { reviewExtractionSchema } from '../shared/contracts/review';
import type { ReviewExtractionModelOutput } from './review-extraction';
import type { NormalizedReviewIntake } from './review-intake';
import {
  applyTransformersConfidenceGuardrails,
  createTransformersReviewExtractor,
  readTransformersReviewExtractionConfig,
  type TransformersInferenceFn
} from './transformers-review-extractor';

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

function buildApiModelOutput() {
  return {
    beverageTypeHint: 'wine',
    fields: {
      brandName: { present: true, value: 'Heritage Hill', confidence: 0.96, note: null },
      fancifulName: { present: false, value: null, confidence: 0.18, note: null },
      classType: { present: true, value: 'Red Wine', confidence: 0.94, note: null },
      alcoholContent: { present: true, value: '13.5% Alc./Vol.', confidence: 0.88, note: null },
      netContents: { present: true, value: '750 mL', confidence: 0.91, note: null },
      applicantAddress: { present: true, value: 'Napa, CA', confidence: 0.84, note: null },
      countryOfOrigin: { present: false, value: null, confidence: 0.14, note: null },
      ageStatement: { present: false, value: null, confidence: 0.1, note: null },
      sulfiteDeclaration: { present: false, value: null, confidence: 0.12, note: null },
      appellation: { present: true, value: 'Napa Valley', confidence: 0.79, note: null },
      vintage: { present: true, value: '2021', confidence: 0.74, note: null },
      governmentWarning: { present: true, value: 'GOVERNMENT WARNING: ...', confidence: 0.86, note: null },
      varietals: [{ name: 'Cabernet Sauvignon', percentage: '75%', confidence: 0.80, note: null }]
    },
    warningSignals: {
      prefixAllCaps: { status: 'yes', confidence: 0.94, note: null },
      prefixBold: { status: 'yes', confidence: 0.88, note: null },
      continuousParagraph: { status: 'yes', confidence: 0.92, note: null },
      separateFromOtherContent: { status: 'yes', confidence: 0.91, note: null }
    },
    imageQuality: { score: 0.81, issues: [], noTextDetected: false, note: null },
    summary: 'Structured extraction completed successfully.'
  };
}

function buildGuardrailInput(): ReviewExtractionModelOutput {
  return {
    beverageTypeHint: 'wine',
    fields: {
      brandName: { present: true, value: 'Heritage Hill', confidence: 0.96 },
      fancifulName: { present: false, value: undefined, confidence: 0.18 },
      classType: { present: true, value: 'Red Wine', confidence: 0.94 },
      alcoholContent: { present: true, value: '13.5% Alc./Vol.', confidence: 0.88 },
      netContents: { present: true, value: '750 mL', confidence: 0.91 },
      applicantAddress: { present: true, value: 'Napa, CA', confidence: 0.84 },
      countryOfOrigin: { present: false, value: undefined, confidence: 0.14 },
      ageStatement: { present: false, value: undefined, confidence: 0.1 },
      sulfiteDeclaration: { present: false, value: undefined, confidence: 0.12 },
      appellation: { present: true, value: 'Napa Valley', confidence: 0.60 },
      vintage: { present: true, value: '2021', confidence: 0.74 },
      governmentWarning: { present: true, value: 'GOVERNMENT WARNING: ...', confidence: 0.66 },
      varietals: [
        { name: 'Cabernet Sauvignon', percentage: '75%', confidence: 0.70 }
      ]
    },
    warningSignals: {
      prefixAllCaps: { status: 'yes', confidence: 0.94 },
      prefixBold: { status: 'yes', confidence: 0.88 },
      continuousParagraph: { status: 'yes', confidence: 0.86 },
      separateFromOtherContent: { status: 'yes', confidence: 0.78 }
    },
    imageQuality: {
      score: 0.81,
      issues: [],
      noTextDetected: false
    },
    summary: 'Extraction completed.'
  };
}

function buildDefaultConfig() {
  return {
    model: 'HuggingFaceTB/SmolVLM-500M-Instruct',
    dtype: 'q4',
    timeoutMs: 15000,
    cacheDir: '.cache/transformers'
  };
}

describe('Transformers review extractor config', () => {
  it('succeeds with all defaults when no env is set', () => {
    const result = readTransformersReviewExtractionConfig({});

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');

    expect(result.value.model).toBe('HuggingFaceTB/SmolVLM-500M-Instruct');
    expect(result.value.dtype).toBe('q4');
    expect(result.value.timeoutMs).toBe(15000);
    expect(result.value.cacheDir).toBe('.cache/transformers');
  });

  it('reads custom model and dtype from env', () => {
    const result = readTransformersReviewExtractionConfig({
      TRANSFORMERS_LOCAL_MODEL: 'onnx-community/SmolVLM-256M-Instruct',
      TRANSFORMERS_DTYPE: 'q8'
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');

    expect(result.value.model).toBe('onnx-community/SmolVLM-256M-Instruct');
    expect(result.value.dtype).toBe('q8');
  });

  it('rejects invalid dtype values', () => {
    const result = readTransformersReviewExtractionConfig({
      TRANSFORMERS_DTYPE: 'invalid'
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');

    expect(result.error.kind).toBe('adapter');
    expect(result.status).toBe(500);
  });

  it('reads custom timeout from env', () => {
    const result = readTransformersReviewExtractionConfig({
      TRANSFORMERS_TIMEOUT_MS: '20000'
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');

    expect(result.value.timeoutMs).toBe(20000);
  });

  it('falls back to default timeout for invalid values', () => {
    const result = readTransformersReviewExtractionConfig({
      TRANSFORMERS_TIMEOUT_MS: 'not-a-number'
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');

    expect(result.value.timeoutMs).toBe(15000);
  });
});

describe('Transformers confidence guardrails', () => {
  it('degrades prefixBold below the 0.95 threshold to uncertain', () => {
    const result = applyTransformersConfidenceGuardrails(buildGuardrailInput());

    expect(result.warningSignals.prefixBold.status).toBe('uncertain');
    expect(result.warningSignals.prefixBold.confidence).toBeLessThanOrEqual(0.39);
  });

  it('degrades continuousParagraph below the 0.90 threshold to uncertain', () => {
    const result = applyTransformersConfidenceGuardrails(buildGuardrailInput());

    expect(result.warningSignals.continuousParagraph.status).toBe('uncertain');
    expect(result.warningSignals.continuousParagraph.confidence).toBeLessThanOrEqual(0.39);
  });

  it('degrades separateFromOtherContent below the 0.90 threshold to uncertain', () => {
    const result = applyTransformersConfidenceGuardrails(buildGuardrailInput());

    expect(result.warningSignals.separateFromOtherContent.status).toBe('uncertain');
    expect(result.warningSignals.separateFromOtherContent.confidence).toBeLessThanOrEqual(0.39);
  });

  it('does not degrade prefixAllCaps (no guardrail for this signal)', () => {
    const result = applyTransformersConfidenceGuardrails(buildGuardrailInput());

    expect(result.warningSignals.prefixAllCaps.status).toBe('yes');
    expect(result.warningSignals.prefixAllCaps.confidence).toBe(0.94);
  });

  it('preserves signals already marked uncertain', () => {
    const input = buildGuardrailInput();
    input.warningSignals.prefixBold = { status: 'uncertain', confidence: 0.30 };

    const result = applyTransformersConfidenceGuardrails(input);

    expect(result.warningSignals.prefixBold.status).toBe('uncertain');
    expect(result.warningSignals.prefixBold.confidence).toBe(0.30);
  });

  it('caps field confidence below 0.70 to 0.55', () => {
    const result = applyTransformersConfidenceGuardrails(buildGuardrailInput());

    expect(result.fields.appellation.confidence).toBeLessThanOrEqual(0.55);
    expect(result.fields.appellation.note).toContain('Local mode');
  });

  it('does not cap field confidence at or above 0.70', () => {
    const result = applyTransformersConfidenceGuardrails(buildGuardrailInput());

    expect(result.fields.brandName.confidence).toBe(0.96);
  });

  it('caps low-confidence varietals', () => {
    const input = buildGuardrailInput();
    input.fields.varietals = [
      { name: 'Merlot', percentage: '50%', confidence: 0.40 }
    ];

    const result = applyTransformersConfidenceGuardrails(input);

    expect(result.fields.varietals[0].confidence).toBeLessThanOrEqual(0.55);
  });
});

describe('Transformers review extractor', () => {
  it('parses model output and produces a valid ReviewExtraction', async () => {
    const inferenceFn: TransformersInferenceFn = vi.fn().mockResolvedValue({
      text: JSON.stringify(buildApiModelOutput())
    });

    const extractor = createTransformersReviewExtractor({
      config: buildDefaultConfig(),
      inferenceFn
    });

    const result = await extractor(buildIntake(), {
      surface: '/api/review',
      extractionMode: 'local'
    });

    expect(inferenceFn).toHaveBeenCalledTimes(1);
    expect(result.beverageType).toBe('wine');
    expect(result.model).toBe('HuggingFaceTB/SmolVLM-500M-Instruct-q4');
    expect(reviewExtractionSchema.parse(result)).toBeDefined();
  });

  it('passes the image as base64 and the prompt to the inference function', async () => {
    const inferenceFn: TransformersInferenceFn = vi.fn().mockResolvedValue({
      text: JSON.stringify(buildApiModelOutput())
    });

    const extractor = createTransformersReviewExtractor({
      config: buildDefaultConfig(),
      inferenceFn
    });

    await extractor(buildIntake(), {
      surface: '/api/review',
      extractionMode: 'local'
    });

    expect(inferenceFn).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: expect.any(String),
        imageMimeType: 'image/png',
        prompt: expect.stringContaining('Extract label facts')
      })
    );
  });

  it('treats malformed JSON as a retryable adapter failure', async () => {
    const inferenceFn: TransformersInferenceFn = vi.fn().mockResolvedValue({
      text: '{not-json'
    });

    const extractor = createTransformersReviewExtractor({
      config: buildDefaultConfig(),
      inferenceFn
    });

    await expect(extractor(buildIntake(), { surface: '/api/review', extractionMode: 'local' })).rejects.toMatchObject({
      status: 502,
      error: { kind: 'adapter', retryable: true }
    });
  });

  it('treats an empty response as a retryable adapter failure', async () => {
    const inferenceFn: TransformersInferenceFn = vi.fn().mockResolvedValue({
      text: '   '
    });

    const extractor = createTransformersReviewExtractor({
      config: buildDefaultConfig(),
      inferenceFn
    });

    await expect(extractor(buildIntake(), { surface: '/api/review', extractionMode: 'local' })).rejects.toMatchObject({
      status: 502,
      error: { kind: 'adapter', retryable: true }
    });
  });

  it('treats inference function errors as retryable network failures', async () => {
    const inferenceFn: TransformersInferenceFn = vi.fn().mockRejectedValue(
      new Error('Worker crashed')
    );

    const extractor = createTransformersReviewExtractor({
      config: buildDefaultConfig(),
      inferenceFn
    });

    await expect(extractor(buildIntake(), { surface: '/api/review', extractionMode: 'local' })).rejects.toMatchObject({
      status: 503,
      error: { kind: 'network', retryable: true }
    });
  });

  it('treats AbortError as a retryable timeout', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    const inferenceFn: TransformersInferenceFn = vi.fn().mockRejectedValue(abortError);

    const extractor = createTransformersReviewExtractor({
      config: buildDefaultConfig(),
      inferenceFn
    });

    await expect(extractor(buildIntake(), { surface: '/api/review', extractionMode: 'local' })).rejects.toMatchObject({
      status: 504,
      error: { kind: 'timeout', retryable: true }
    });
  });
});
