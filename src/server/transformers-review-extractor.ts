import { existsSync } from 'node:fs';

import type { ReviewError } from '../shared/contracts/review';
import {
  buildReviewExtractionPrompt,
  normalizeReviewExtractionModelOutput,
  reviewExtractionModelOutputSchema
} from './review-extraction-model-output';
import {
  createReviewExtractionFailure,
  finalizeReviewExtraction,
  type ReviewExtractionModelOutput,
  type ReviewExtractor,
  type ReviewExtractorContext
} from './review-extraction';

const DEFAULT_TRANSFORMERS_MODEL = 'HuggingFaceTB/SmolVLM-500M-Instruct';
const DEFAULT_TRANSFORMERS_DTYPE = 'q4';
const DEFAULT_TRANSFORMERS_TIMEOUT_MS = 15000;
const DEFAULT_TRANSFORMERS_CACHE_DIR = '.cache/transformers';
const VALID_DTYPES = new Set(['q4', 'q8', 'fp16', 'fp32']);

const TRANSFORMERS_SIGNAL_THRESHOLDS = {
  prefixBold: 0.95,
  continuousParagraph: 0.90,
  separateFromOtherContent: 0.90
} as const;

const TRANSFORMERS_FIELD_CONFIDENCE_THRESHOLD = 0.70;
const TRANSFORMERS_FIELD_CONFIDENCE_CAP = 0.55;
const TRANSFORMERS_SIGNAL_CONFIDENCE_CAP = 0.39;

export interface TransformersReviewExtractionConfig {
  model: string;
  dtype: string;
  timeoutMs: number;
  cacheDir: string;
}

type TransformersConfigFailure = {
  success: false;
  status: number;
  error: ReviewError;
};

type TransformersConfigSuccess = {
  success: true;
  value: TransformersReviewExtractionConfig;
};

export type TransformersReviewExtractionConfigResult =
  | TransformersConfigFailure
  | TransformersConfigSuccess;

export function readTransformersReviewExtractionConfig(
  env: Record<string, string | undefined>
): TransformersReviewExtractionConfigResult {
  const model = env.TRANSFORMERS_LOCAL_MODEL?.trim() || DEFAULT_TRANSFORMERS_MODEL;
  const cacheDir = env.TRANSFORMERS_CACHE_DIR?.trim() || DEFAULT_TRANSFORMERS_CACHE_DIR;

  const dtypeResult = readDtype(env.TRANSFORMERS_DTYPE);
  if (!dtypeResult.success) {
    return dtypeResult;
  }

  if (!existsSync(cacheDir)) {
    return {
      success: false,
      status: 503,
      error: {
        kind: 'adapter',
        message: `Local model cache not found at ${cacheDir}. Run "npm run model:cache" to download the model.`,
        retryable: false
      }
    };
  }

  return {
    success: true,
    value: {
      model,
      dtype: dtypeResult.value,
      timeoutMs: readTimeoutMs(env.TRANSFORMERS_TIMEOUT_MS),
      cacheDir
    }
  };
}

export type TransformersInferenceFn = (input: {
  prompt: string;
  imageBase64: string;
  imageMimeType: string;
}) => Promise<{ text: string }>;

export function createTransformersReviewExtractor(input: {
  config: TransformersReviewExtractionConfig;
  inferenceFn: TransformersInferenceFn;
}): ReviewExtractor {
  return async (intake, context) => {
    const requestAssemblyStartedAt = performance.now();

    const prompt = buildReviewExtractionPrompt({
      surface: context?.surface ?? '/api/review',
      extractionMode: context?.extractionMode ?? 'local'
    });
    const imageBase64 = intake.label.buffer.toString('base64');

    recordTransformersLatency(context, 'request-assembly', 'success', requestAssemblyStartedAt);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.config.timeoutMs
    );
    const providerWaitStartedAt = performance.now();

    let responseText: string;
    try {
      const result = await input.inferenceFn({
        prompt,
        imageBase64,
        imageMimeType: intake.label.mimeType
      });
      responseText = result.text.trim();
    } catch (error) {
      clearTimeout(timeout);
      recordTransformersLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw normalizeTransformersInferenceFailure(error);
    }
    clearTimeout(timeout);

    if (!responseText) {
      recordTransformersLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'The local model returned an empty response.',
        retryable: true
      });
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(responseText);
    } catch {
      recordTransformersLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'The local model returned malformed structured output.',
        retryable: true
      });
    }

    const normalizedOutput = reviewExtractionModelOutputSchema.safeParse(parsedOutput);
    if (!normalizedOutput.success) {
      recordTransformersLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'The local model returned malformed structured output.',
        retryable: true
      });
    }

    try {
      const extraction = finalizeReviewExtraction({
        intake,
        model: `${input.config.model}-${input.config.dtype}`,
        extracted: applyTransformersConfidenceGuardrails(
          normalizeReviewExtractionModelOutput(normalizedOutput.data)
        )
      });
      recordTransformersLatency(context, 'provider-wait', 'success', providerWaitStartedAt);
      return extraction;
    } catch {
      recordTransformersLatency(context, 'provider-wait', 'fast-fail', providerWaitStartedAt);
      throw createReviewExtractionFailure({
        status: 500,
        kind: 'adapter',
        message: 'We could not normalize the local extraction output.',
        retryable: false
      });
    }
  };
}

export function applyTransformersConfidenceGuardrails(
  output: ReviewExtractionModelOutput
): ReviewExtractionModelOutput {
  return {
    ...output,
    fields: applyFieldConfidenceGuardrails(output.fields),
    warningSignals: {
      ...output.warningSignals,
      prefixBold: degradeWeakVisualSignal({
        signal: output.warningSignals.prefixBold,
        threshold: TRANSFORMERS_SIGNAL_THRESHOLDS.prefixBold,
        note: 'Local mode (embedded model) downgraded boldness certainty.'
      }),
      continuousParagraph: degradeWeakVisualSignal({
        signal: output.warningSignals.continuousParagraph,
        threshold: TRANSFORMERS_SIGNAL_THRESHOLDS.continuousParagraph,
        note: 'Local mode (embedded model) downgraded paragraph-layout certainty.'
      }),
      separateFromOtherContent: degradeWeakVisualSignal({
        signal: output.warningSignals.separateFromOtherContent,
        threshold: TRANSFORMERS_SIGNAL_THRESHOLDS.separateFromOtherContent,
        note: 'Local mode (embedded model) downgraded separation certainty.'
      })
    }
  };
}

function applyFieldConfidenceGuardrails(
  fields: ReviewExtractionModelOutput['fields']
): ReviewExtractionModelOutput['fields'] {
  return {
    brandName: capFieldConfidence(fields.brandName),
    fancifulName: capFieldConfidence(fields.fancifulName),
    classType: capFieldConfidence(fields.classType),
    alcoholContent: capFieldConfidence(fields.alcoholContent),
    netContents: capFieldConfidence(fields.netContents),
    applicantAddress: capFieldConfidence(fields.applicantAddress),
    countryOfOrigin: capFieldConfidence(fields.countryOfOrigin),
    ageStatement: capFieldConfidence(fields.ageStatement),
    sulfiteDeclaration: capFieldConfidence(fields.sulfiteDeclaration),
    appellation: capFieldConfidence(fields.appellation),
    vintage: capFieldConfidence(fields.vintage),
    governmentWarning: capFieldConfidence(fields.governmentWarning),
    varietals: fields.varietals.map((v) => ({
      ...v,
      confidence: v.confidence < TRANSFORMERS_FIELD_CONFIDENCE_THRESHOLD
        ? Math.min(v.confidence, TRANSFORMERS_FIELD_CONFIDENCE_CAP)
        : v.confidence
    }))
  };
}

function capFieldConfidence<T extends { confidence: number; note?: string }>(
  field: T
): T {
  if (field.confidence >= TRANSFORMERS_FIELD_CONFIDENCE_THRESHOLD) {
    return field;
  }

  return {
    ...field,
    confidence: Math.min(field.confidence, TRANSFORMERS_FIELD_CONFIDENCE_CAP),
    note: [field.note, 'Local mode (embedded model) capped low-confidence field.']
      .filter(Boolean)
      .join(' ')
  };
}

function degradeWeakVisualSignal(input: {
  signal: ReviewExtractionModelOutput['warningSignals']['prefixBold'];
  threshold: number;
  note: string;
}) {
  if (
    input.signal.status === 'uncertain' ||
    input.signal.confidence >= input.threshold
  ) {
    return input.signal;
  }

  return {
    status: 'uncertain' as const,
    confidence: Math.min(input.signal.confidence, TRANSFORMERS_SIGNAL_CONFIDENCE_CAP),
    note: [input.signal.note, input.note].filter(Boolean).join(' ')
  };
}

function readDtype(
  rawValue: string | undefined
): { success: true; value: string } | TransformersConfigFailure {
  const value = rawValue?.trim().toLowerCase() || DEFAULT_TRANSFORMERS_DTYPE;

  if (!VALID_DTYPES.has(value)) {
    return {
      success: false,
      status: 500,
      error: {
        kind: 'adapter',
        message: `TRANSFORMERS_DTYPE must be one of: ${[...VALID_DTYPES].join(', ')}. Got "${value}".`,
        retryable: false
      }
    };
  }

  return { success: true, value };
}

function readTimeoutMs(rawValue: string | undefined) {
  const parsedValue = Number(rawValue?.trim());
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_TRANSFORMERS_TIMEOUT_MS;
  }

  return Math.round(parsedValue);
}

function normalizeTransformersInferenceFailure(error: unknown) {
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return createReviewExtractionFailure({
      status: 504,
      kind: 'timeout',
      message: 'The local model extraction timed out.',
      retryable: true
    });
  }

  return createReviewExtractionFailure({
    status: 503,
    kind: 'network',
    message: 'The local model could not complete the extraction.',
    retryable: true
  });
}

function recordTransformersLatency(
  context: ReviewExtractorContext | undefined,
  stage: 'request-assembly' | 'provider-wait',
  outcome: 'success' | 'fast-fail',
  startedAt: number
) {
  context?.latencyCapture?.recordSpan({
    stage,
    provider: 'transformers',
    attempt: context.latencyAttempt,
    outcome,
    durationMs: performance.now() - startedAt
  });
}
