/**
 * Ollama VLM review extractor — local, on-device replacement for the Gemini VLM.
 *
 * Reads the label image directly with an on-device vision-language model
 * (qwen2.5vl:3b by default, moondream:1.8b as a lighter fallback) via the
 * Ollama HTTP API. Reuses the SAME extraction prompt policy as the cloud
 * path (`buildReviewExtractionPrompt`) so the contract and downstream
 * pipeline are identical.
 *
 * Why Ollama and not node-llama-cpp?
 *   - node-llama-cpp v3.18 does not expose multimodal (mmproj/CLIP) APIs in
 *     its TypeScript bindings yet. Ollama has robust, stable vision support
 *     on Apple Silicon and is the fastest path to a working local VLM.
 *   - The model runs natively with Metal acceleration (llama.cpp backend).
 *   - Ollama caches the loaded model in memory between calls — warm calls
 *     avoid the 3-5s cold-start penalty.
 *
 * JSON compliance:
 *   - Ollama supports a `format` parameter that constrains output to JSON
 *     (either "json" or a full JSON schema). We pass the Zod-derived schema
 *     so the model produces exactly the shape the pipeline expects.
 */

import type { ReviewError } from '../shared/contracts/review';
import type { ExtractionMode } from './ai-provider-policy';
import { applyReviewExtractorGuardrails } from './review-extractor-guardrails';
import {
  buildReviewExtractionPrompt,
  normalizeReviewExtractionModelOutput,
  reviewExtractionModelOutputJsonSchema,
  reviewExtractionModelOutputSchema
} from './review-extraction-model-output';
import {
  createReviewExtractionFailure,
  finalizeReviewExtraction,
  type ReviewExtractor,
  type ReviewExtractorContext
} from './review-extraction';

const DEFAULT_OLLAMA_VISION_MODEL = 'qwen2.5vl:3b';
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
// Local VLMs are much slower than cloud; allow a generous ceiling but give up
// rather than stall the whole batch. Override with OLLAMA_VLM_TIMEOUT_MS.
const DEFAULT_OLLAMA_VLM_TIMEOUT_MS = 120000;
// Keep the VLM resident between calls so the next image does not pay the
// model-load tax. Override with OLLAMA_VLM_KEEP_ALIVE (e.g. "30m", "-1" for
// always, "0" to unload immediately).
const DEFAULT_OLLAMA_VLM_KEEP_ALIVE = '30m';

export interface OllamaVlmReviewExtractionConfig {
  host: string;
  visionModel: string;
  timeoutMs: number;
  keepAlive: string;
}

type ConfigFailure = {
  success: false;
  status: number;
  error: ReviewError;
};

type ConfigSuccess = {
  success: true;
  value: OllamaVlmReviewExtractionConfig;
};

export type OllamaVlmReviewExtractionConfigResult =
  | ConfigFailure
  | ConfigSuccess;

export function readOllamaVlmReviewExtractionConfig(
  env: Record<string, string | undefined>
): OllamaVlmReviewExtractionConfigResult {
  // Gate the provider behind an explicit opt-in so it does not mask other
  // local providers or claim support when Ollama isn't actually running.
  // Enabled when AI_PROVIDER signals local Ollama, or when the opt-in flag
  // is set directly.
  const aiProvider = env.AI_PROVIDER?.trim().toLowerCase();
  const explicitEnable = env.OLLAMA_VLM_ENABLED?.trim().toLowerCase();
  const enabled =
    aiProvider === 'local' ||
    aiProvider === 'ollama' ||
    aiProvider === 'ollama-vlm' ||
    explicitEnable === '1' ||
    explicitEnable === 'true' ||
    explicitEnable === 'yes' ||
    explicitEnable === 'on';

  if (!enabled) {
    return {
      success: false,
      status: 503,
      error: {
        kind: 'adapter',
        message:
          'Ollama VLM is not enabled on this workstation. Set AI_PROVIDER=local or OLLAMA_VLM_ENABLED=true.',
        retryable: false
      }
    };
  }

  const host = env.OLLAMA_HOST?.trim() || DEFAULT_OLLAMA_HOST;
  const visionModel =
    env.OLLAMA_VISION_MODEL?.trim() || DEFAULT_OLLAMA_VISION_MODEL;
  const timeoutMs = readPositiveInt(
    env.OLLAMA_VLM_TIMEOUT_MS,
    DEFAULT_OLLAMA_VLM_TIMEOUT_MS
  );
  const keepAlive =
    env.OLLAMA_VLM_KEEP_ALIVE?.trim() || DEFAULT_OLLAMA_VLM_KEEP_ALIVE;

  return {
    success: true,
    value: { host, visionModel, timeoutMs, keepAlive }
  };
}

type OllamaGenerateResponse = {
  response?: string;
  done?: boolean;
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  model?: string;
};


export function createOllamaVlmReviewExtractor(input: {
  config: OllamaVlmReviewExtractionConfig;
  fetchImpl?: typeof fetch;
}): ReviewExtractor {
  const fetchImpl = input.fetchImpl ?? fetch;

  return async (intake, context) => {
    const surface = context?.surface ?? '/api/review';
    const extractionMode: ExtractionMode = 'local';
    const requestAssemblyStartedAt = performance.now();

    // Use the standard (not OCR-augmented) prompt — the VLM reads the pixels
    // directly. OCR-augmented prompts suppress VLM warning detection and
    // produce worse results (see llm-trace.ts rationale).
    const promptText = buildReviewExtractionPrompt({ surface, extractionMode });
    const imageBase64 = intake.label.buffer.toString('base64');

    recordOllamaLatency(
      context,
      'request-assembly',
      'success',
      requestAssemblyStartedAt
    );

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.config.timeoutMs
    );
    const providerWaitStartedAt = performance.now();

    let responseBody: OllamaGenerateResponse;
    try {
      const httpResponse = await fetchImpl(
        `${input.config.host.replace(/\/$/, '')}/api/generate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: input.config.visionModel,
            prompt: promptText,
            images: [imageBase64],
            stream: false,
            format: reviewExtractionModelOutputJsonSchema,
            keep_alive: input.config.keepAlive,
            options: {
              temperature: 0,
              num_predict: 1024
            }
          })
        }
      );

      if (!httpResponse.ok) {
        clearTimeout(timeout);
        recordOllamaLatency(
          context,
          'provider-wait',
          'fast-fail',
          providerWaitStartedAt
        );
        const errorText = await safeReadText(httpResponse);
        throw createReviewExtractionFailure({
          status: 502,
          kind: 'adapter',
          message: `Ollama VLM HTTP ${httpResponse.status}: ${truncate(errorText, 160)}`,
          retryable: true
        });
      }

      responseBody = (await httpResponse.json()) as OllamaGenerateResponse;
    } catch (error) {
      clearTimeout(timeout);
      recordOllamaLatency(
        context,
        'provider-wait',
        'fast-fail',
        providerWaitStartedAt
      );
      throw normalizeOllamaRuntimeFailure(error);
    }
    clearTimeout(timeout);

    const responseText = responseBody.response?.trim();
    if (!responseText) {
      recordOllamaLatency(
        context,
        'provider-wait',
        'fast-fail',
        providerWaitStartedAt
      );
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: 'Ollama VLM returned an empty response.',
        retryable: true
      });
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(responseText);
      sanitizeParsedOutput(parsedOutput);
    } catch {
      recordOllamaLatency(
        context,
        'provider-wait',
        'fast-fail',
        providerWaitStartedAt
      );
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: `Ollama VLM returned malformed JSON: ${truncate(responseText, 160)}`,
        retryable: true
      });
    }

    const normalizedOutput = reviewExtractionModelOutputSchema.safeParse(parsedOutput);
    if (!normalizedOutput.success) {
      recordOllamaLatency(
        context,
        'provider-wait',
        'fast-fail',
        providerWaitStartedAt
      );
      throw createReviewExtractionFailure({
        status: 502,
        kind: 'adapter',
        message: `Ollama VLM output failed schema validation: ${normalizedOutput.error.message.slice(0, 200)}`,
        retryable: true
      });
    }

    const guardrailResult = applyReviewExtractorGuardrails({
      surface,
      extractionMode,
      output: normalizedOutput.data
    });
    if (!guardrailResult.success) {
      recordOllamaLatency(
        context,
        'provider-wait',
        'fast-fail',
        providerWaitStartedAt
      );
      throw createReviewExtractionFailure({
        status: guardrailResult.status,
        kind: guardrailResult.error.kind,
        message: guardrailResult.error.message,
        retryable: guardrailResult.error.retryable
      });
    }

    try {
      const extraction = finalizeReviewExtraction({
        intake,
        model: `ollama:${responseBody.model ?? input.config.visionModel}`,
        extracted: normalizeReviewExtractionModelOutput(guardrailResult.value)
      });
      recordOllamaLatency(
        context,
        'provider-wait',
        'success',
        providerWaitStartedAt
      );
      return extraction;
    } catch (err) {
      recordOllamaLatency(
        context,
        'provider-wait',
        'fast-fail',
        providerWaitStartedAt
      );
      throw createReviewExtractionFailure({
        status: 500,
        kind: 'adapter',
        message: `Local VLM finalize failed: ${(err as Error).message}`,
        retryable: false
      });
    }
  };
}

/**
 * Normalize common local-VLM output quirks in place so the Zod schema
 * accepts them. Local models are more variable than hosted APIs; they often:
 *   - return "" instead of null for absent fields → treat as null
 *   - return present=false together with a non-null/non-empty value
 *     → if value is empty-ish, drop it; otherwise flip present to true
 *   - return present=true with null/empty value → drop the field
 *   - return confidence outside [0,1]
 */
function sanitizeParsedOutput(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const root = value as Record<string, unknown>;

  const fields = root.fields as Record<string, unknown> | undefined;
  if (fields) {
    for (const key of Object.keys(fields)) {
      const field = fields[key];
      if (key === 'varietals' && Array.isArray(field)) {
        for (const v of field) sanitizeVarietal(v);
        continue;
      }
      sanitizeField(field);
    }
  }

  const warnings = root.warningSignals as Record<string, unknown> | undefined;
  if (warnings) {
    for (const key of Object.keys(warnings)) {
      sanitizeWarningSignal(warnings[key]);
    }
  }

  const quality = root.imageQuality as Record<string, unknown> | undefined;
  if (quality) {
    if (typeof quality.score === 'number') {
      quality.score = Math.max(0, Math.min(1, quality.score));
    }
    if (!Array.isArray(quality.issues)) {
      quality.issues = [];
    }
    if (typeof quality.noTextDetected !== 'boolean') {
      quality.noTextDetected = false;
    }
    if (quality.note === '' || quality.note === undefined) {
      quality.note = null;
    }
  }

  if (typeof root.summary !== 'string') {
    root.summary = 'Local VLM extraction.';
  }
  if (!('beverageTypeHint' in root)) {
    root.beverageTypeHint = null;
  }
}

function sanitizeField(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const f = value as Record<string, unknown>;

  if (typeof f.value === 'string') {
    const trimmed = (f.value as string).trim();
    f.value = trimmed.length === 0 ? null : trimmed;
  }
  if (f.value === undefined) f.value = null;

  if (typeof f.confidence === 'number') {
    f.confidence = Math.max(0, Math.min(1, f.confidence));
  } else {
    f.confidence = 0;
  }

  if (f.note === '' || f.note === undefined) f.note = null;

  // Reconcile present/value consistency
  if (f.present === true && (f.value === null || f.value === '')) {
    f.present = false;
    f.value = null;
  }
  if (f.present === false && f.value !== null) {
    // Drop the stray value — prefer the "absent" signal the model emitted.
    f.value = null;
  }
  if (typeof f.present !== 'boolean') {
    f.present = false;
    f.value = null;
  }
}

function sanitizeVarietal(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string') v.name = '';
  if (v.percentage === undefined || v.percentage === '') v.percentage = null;
  if (typeof v.confidence === 'number') {
    v.confidence = Math.max(0, Math.min(1, v.confidence));
  } else {
    v.confidence = 0;
  }
  if (v.note === '' || v.note === undefined) v.note = null;
}

function sanitizeWarningSignal(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const s = value as Record<string, unknown>;
  if (s.status !== 'yes' && s.status !== 'no' && s.status !== 'uncertain') {
    s.status = 'uncertain';
  }
  if (typeof s.confidence === 'number') {
    s.confidence = Math.max(0, Math.min(1, s.confidence));
  } else {
    s.confidence = 0;
  }
  if (s.note === '' || s.note === undefined) s.note = null;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '…';
}

function readPositiveInt(raw: string | undefined, fallback: number) {
  const n = Number(raw?.trim());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function normalizeOllamaRuntimeFailure(error: unknown) {
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return createReviewExtractionFailure({
      status: 504,
      kind: 'timeout',
      message: 'Ollama VLM extraction timed out.',
      retryable: true
    });
  }

  // ECONNREFUSED, DNS, TLS, etc.
  if (
    error instanceof Error &&
    /ECONNREFUSED|ENOTFOUND|fetch failed/i.test(error.message)
  ) {
    return createReviewExtractionFailure({
      status: 503,
      kind: 'network',
      message:
        'Ollama is not running. Start the Ollama app or `ollama serve` before using local mode.',
      retryable: false
    });
  }

  return createReviewExtractionFailure({
    status: 503,
    kind: 'network',
    message: `Ollama VLM call failed: ${(error as Error).message}`,
    retryable: true
  });
}

function recordOllamaLatency(
  context: ReviewExtractorContext | undefined,
  stage: 'request-assembly' | 'provider-wait',
  outcome: 'success' | 'fast-fail',
  startedAt: number
) {
  context?.latencyCapture?.recordSpan({
    stage,
    provider: 'ollama',
    attempt: context.latencyAttempt,
    outcome,
    durationMs: performance.now() - startedAt
  });
}
