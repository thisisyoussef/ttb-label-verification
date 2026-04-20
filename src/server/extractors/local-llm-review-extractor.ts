/**
 * Fully-local LLM extractor.
 *
 * Pipeline: Tesseract OCR → local GGUF model (via node-llama-cpp) → structured JSON → ReviewExtraction.
 *
 * Unlike the Gemini/OpenAI extractors, this extractor DOES NOT read pixels directly. It receives
 * OCR text only. Visual signals (bold headings, continuous paragraph, separation) are therefore
 * marked uncertain with low confidence — the downstream rule engine handles that gracefully.
 *
 * Trade-offs vs VLM:
 *   - No image hallucination, no cloud dependency, full on-device privacy.
 *   - Accuracy depends entirely on OCR quality for label text.
 *   - No visual judgement for warning layout — flagged as uncertain instead of inferred.
 *
 * See docs: this is a proof-of-concept extractor added on branch
 * `claude/TTB-000-local-pipeline-poc`.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { ReviewError } from '../../shared/contracts/review';
import { runOcrPrepass, type OcrPrepassResult } from './ocr-prepass';
import {
  createReviewExtractionFailure,
  finalizeReviewExtraction,
  type ReviewExtractionModelOutput,
  type ReviewExtractor,
  type ReviewExtractorContext
} from './review-extraction';

const DEFAULT_LOCAL_LLM_MODEL_PATH = '.models/qwen2.5-1.5b-instruct-q4_k_m.gguf';
const DEFAULT_CONTEXT_SIZE = 4096;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 30000;

/** Minimal schema the LLM is asked to produce. Keeps the prompt focused. */
export interface LocalLlmRawOutput {
  brandName: { present: boolean; value: string | null; confidence: number };
  fancifulName: { present: boolean; value: string | null; confidence: number };
  classType: { present: boolean; value: string | null; confidence: number };
  alcoholContent: { present: boolean; value: string | null; confidence: number };
  netContents: { present: boolean; value: string | null; confidence: number };
  applicantAddress: { present: boolean; value: string | null; confidence: number };
  countryOfOrigin: { present: boolean; value: string | null; confidence: number };
  governmentWarning: { present: boolean; value: string | null; confidence: number };
  appellation: { present: boolean; value: string | null; confidence: number };
  vintage: { present: boolean; value: string | null; confidence: number };
  summary: string;
}

const LOCAL_LLM_JSON_SCHEMA = {
  type: 'object',
  properties: {
    brandName: fieldSchema(),
    fancifulName: fieldSchema(),
    classType: fieldSchema(),
    alcoholContent: fieldSchema(),
    netContents: fieldSchema(),
    applicantAddress: fieldSchema(),
    countryOfOrigin: fieldSchema(),
    governmentWarning: fieldSchema(),
    appellation: fieldSchema(),
    vintage: fieldSchema(),
    summary: { type: 'string' }
  },
  required: [
    'brandName',
    'fancifulName',
    'classType',
    'alcoholContent',
    'netContents',
    'applicantAddress',
    'countryOfOrigin',
    'governmentWarning',
    'appellation',
    'vintage',
    'summary'
  ],
  additionalProperties: false
} as const;

function fieldSchema() {
  return {
    type: 'object',
    properties: {
      present: { type: 'boolean' },
      value: { type: ['string', 'null'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 }
    },
    required: ['present', 'value', 'confidence'],
    additionalProperties: false
  } as const;
}

export interface LocalLlmReviewExtractionConfig {
  modelPath: string;
  contextSize: number;
  maxTokens: number;
  timeoutMs: number;
}

type ConfigFailure = { success: false; status: number; error: ReviewError };
type ConfigSuccess = { success: true; value: LocalLlmReviewExtractionConfig };
export type LocalLlmReviewExtractionConfigResult = ConfigFailure | ConfigSuccess;

export function readLocalLlmReviewExtractionConfig(
  env: Record<string, string | undefined>
): LocalLlmReviewExtractionConfigResult {
  const modelPath = env.LOCAL_LLM_MODEL_PATH?.trim() || DEFAULT_LOCAL_LLM_MODEL_PATH;
  const resolvedPath = path.isAbsolute(modelPath)
    ? modelPath
    : path.resolve(process.cwd(), modelPath);

  if (!existsSync(resolvedPath)) {
    return {
      success: false,
      status: 503,
      error: {
        kind: 'adapter',
        message: `Local LLM GGUF model not found at ${resolvedPath}. Download it or set LOCAL_LLM_MODEL_PATH.`,
        retryable: false
      }
    };
  }

  return {
    success: true,
    value: {
      modelPath: resolvedPath,
      contextSize: readPositiveInt(env.LOCAL_LLM_CONTEXT_SIZE, DEFAULT_CONTEXT_SIZE),
      maxTokens: readPositiveInt(env.LOCAL_LLM_MAX_TOKENS, DEFAULT_MAX_TOKENS),
      timeoutMs: readPositiveInt(env.LOCAL_LLM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
    }
  };
}

/** Abstract inference interface — in production this is backed by node-llama-cpp. */
export type LocalLlmInferenceFn = (input: {
  prompt: string;
  maxTokens: number;
  jsonSchema: Record<string, unknown>;
}) => Promise<{ text: string }>;

export function createLocalLlmReviewExtractor(input: {
  config: LocalLlmReviewExtractionConfig;
  inferenceFn: LocalLlmInferenceFn;
}): ReviewExtractor {
  return async (intake, context) => {
    const ocrStart = performance.now();

    // Use pre-supplied OCR text if already run upstream. Otherwise run it now.
    let ocrText = intake.ocrText;
    let ocrResult: OcrPrepassResult | null = null;
    if (!ocrText) {
      ocrResult = await runOcrPrepass(intake.label);
      if (ocrResult.status === 'failed') {
        throw createReviewExtractionFailure({
          status: 502,
          kind: 'adapter',
          message: `OCR pre-pass failed: ${ocrResult.reason}`,
          retryable: true
        });
      }
      ocrText = ocrResult.text;
    }

    const ocrDurationMs = Math.round(performance.now() - ocrStart);
    recordSpan(context, 'ocr-prepass', 'success', ocrDurationMs);

    const prompt = buildLocalLlmExtractionPrompt(ocrText);
    const inferenceStart = performance.now();

    let inferenceText: string;
    try {
      const result = await Promise.race<{ text: string }>([
        input.inferenceFn({
          prompt,
          maxTokens: input.config.maxTokens,
          jsonSchema: LOCAL_LLM_JSON_SCHEMA as unknown as Record<string, unknown>
        }),
        timeoutPromise(input.config.timeoutMs)
      ]);
      inferenceText = result.text.trim();
    } catch (error) {
      recordSpan(context, 'provider-wait', 'fast-fail', performance.now() - inferenceStart);
      throw normalizeLocalLlmFailure(error);
    }

    const inferenceDurationMs = Math.round(performance.now() - inferenceStart);

    let rawOutput: LocalLlmRawOutput;
    try {
      rawOutput = JSON.parse(inferenceText) as LocalLlmRawOutput;
      validateRawOutput(rawOutput);
    } catch (parseError) {
      recordSpan(context, 'provider-wait', 'fast-fail', inferenceDurationMs);
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: `Local LLM returned malformed JSON: ${(parseError as Error).message}. Output: ${truncate(inferenceText, 200)}`,
        retryable: true
      });
    }

    recordSpan(context, 'provider-wait', 'success', inferenceDurationMs);

    const modelOutput = toReviewExtractionModelOutput({
      raw: rawOutput,
      ocrTextLength: ocrText.length,
      ocrDegraded: ocrResult?.status === 'degraded'
    });

    return finalizeReviewExtraction({
      intake,
      model: 'qwen2.5-1.5b-instruct-q4_k_m',
      extracted: modelOutput
    });
  };
}

export function buildLocalLlmExtractionPrompt(ocrText: string): string {
  return [
    'You are a label data structuring engine for TTB alcohol-beverage label compliance review.',
    'Below is OCR text extracted from an alcohol beverage label.',
    '',
    'Extract the following fields and return STRICT JSON ONLY (no markdown, no prose).',
    '',
    'Rules:',
    '- If a field is NOT clearly present in the OCR text, set present=false, value=null, confidence=0.',
    '- Do NOT infer values from knowledge — only use what is visible in the OCR text.',
    '- confidence reflects how clearly the OCR text supports the answer, 0.0 to 1.0.',
    '- brandName is the brand logo/name (often the largest or most prominent phrase).',
    '- fancifulName is the specific product name that is NOT the brand (e.g. a cuvée or cocktail name).',
    '- classType is the class of beverage such as "whisky", "vodka", "red wine", "lager", "brandy", etc.',
    '- alcoholContent is percent ABV (e.g. "40% Alc./Vol.", "12.5% ABV").',
    '- netContents is container volume (e.g. "750 mL", "12 fl oz", "1 L").',
    '- applicantAddress is the physical address of the bottler or importer.',
    '- countryOfOrigin is the country of origin, e.g. "France", "USA", "Product of Italy".',
    '- governmentWarning is the full "GOVERNMENT WARNING:" paragraph if present, otherwise null.',
    '- appellation is a wine geographic designation (e.g. "Napa Valley", "Rheingau"). Null for non-wine.',
    '- vintage is a wine year (e.g. "2019"). Null for non-wine.',
    '- summary is a one-sentence description of the extracted content.',
    '',
    'OCR TEXT:',
    '---',
    ocrText,
    '---',
    '',
    'Return ONLY valid JSON matching the required schema. No explanation, no prose, no markdown fences.'
  ].join('\n');
}

function toReviewExtractionModelOutput(input: {
  raw: LocalLlmRawOutput;
  ocrTextLength: number;
  ocrDegraded: boolean;
}): ReviewExtractionModelOutput {
  const { raw } = input;

  const toField = (f: { present: boolean; value: string | null; confidence: number }) => {
    // The LLM occasionally returns present=true with null/empty value. Treat those as absent
    // so the downstream Zod schema (which requires present ⇒ non-empty value) passes.
    const trimmed = (f.value ?? '').trim();
    const effectivelyPresent = f.present && trimmed.length > 0;
    return {
      present: effectivelyPresent,
      value: effectivelyPresent ? trimmed : undefined,
      confidence: clamp01(f.confidence ?? 0)
    };
  };

  const qualityScore = input.ocrDegraded ? 0.55 : 0.78;

  return {
    beverageTypeHint: undefined,
    fields: {
      brandName: toField(raw.brandName),
      fancifulName: toField(raw.fancifulName),
      classType: toField(raw.classType),
      alcoholContent: toField(raw.alcoholContent),
      netContents: toField(raw.netContents),
      applicantAddress: toField(raw.applicantAddress),
      countryOfOrigin: toField(raw.countryOfOrigin),
      ageStatement: absentField(),
      sulfiteDeclaration: absentField(),
      appellation: toField(raw.appellation),
      vintage: toField(raw.vintage),
      governmentWarning: toField(raw.governmentWarning),
      varietals: []
    },
    warningSignals: {
      // No pixel access → we cannot judge visual layout. Return uncertain.
      prefixAllCaps: {
        status: 'uncertain',
        confidence: 0.3,
        note: 'Local text-only pipeline: no pixel access to judge visual layout.'
      },
      prefixBold: {
        status: 'uncertain',
        confidence: 0.3,
        note: 'Local text-only pipeline: no pixel access to judge visual layout.'
      },
      continuousParagraph: {
        status: 'uncertain',
        confidence: 0.3,
        note: 'Local text-only pipeline: no pixel access to judge visual layout.'
      },
      separateFromOtherContent: {
        status: 'uncertain',
        confidence: 0.3,
        note: 'Local text-only pipeline: no pixel access to judge visual layout.'
      }
    },
    imageQuality: {
      score: qualityScore,
      issues: input.ocrDegraded ? ['OCR extracted minimal text'] : [],
      noTextDetected: input.ocrTextLength === 0,
      note: input.ocrDegraded
        ? 'OCR pre-pass flagged as degraded (minimal text extracted).'
        : undefined
    },
    summary:
      raw.summary && raw.summary.length > 0
        ? raw.summary
        : 'Local LLM extraction completed from OCR text.'
  };
}

function absentField() {
  return { present: false, confidence: 0 } as const;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function recordSpan(
  context: ReviewExtractorContext | undefined,
  stage: 'request-assembly' | 'provider-wait' | 'ocr-prepass',
  outcome: 'success' | 'fast-fail',
  durationMs: number
) {
  context?.latencyCapture?.recordSpan({
    stage: stage as 'request-assembly' | 'provider-wait',
    attempt: context.latencyAttempt,
    outcome,
    durationMs
  });
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

function readPositiveInt(raw: string | undefined, fallback: number) {
  const n = Number(raw?.trim());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function timeoutPromise<T>(ms: number): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => {
      const err = new Error('Local LLM inference timed out');
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });
}

function validateRawOutput(value: unknown): asserts value is LocalLlmRawOutput {
  if (!value || typeof value !== 'object') {
    throw new Error('LLM output is not an object');
  }
  const requiredFields = [
    'brandName',
    'fancifulName',
    'classType',
    'alcoholContent',
    'netContents',
    'applicantAddress',
    'countryOfOrigin',
    'governmentWarning',
    'appellation',
    'vintage'
  ];
  const obj = value as Record<string, unknown>;
  for (const key of requiredFields) {
    const field = obj[key];
    if (!field || typeof field !== 'object') {
      throw new Error(`missing field "${key}"`);
    }
    const f = field as Record<string, unknown>;
    if (typeof f.present !== 'boolean') {
      throw new Error(`field ${key}.present is not a boolean`);
    }
    if (typeof f.confidence !== 'number') {
      throw new Error(`field ${key}.confidence is not a number`);
    }
  }
}

function normalizeLocalLlmFailure(error: unknown) {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return createReviewExtractionFailure({
      status: 504,
      kind: 'timeout',
      message: 'The local LLM extraction timed out.',
      retryable: true
    });
  }

  return createReviewExtractionFailure({
    status: 503,
    kind: 'adapter',
    message: `The local LLM could not complete extraction: ${(error as Error).message}`,
    retryable: true
  });
}
