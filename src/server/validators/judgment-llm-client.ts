/**
 * Gemini Flash judgment client — a lightweight LLM client for resolving
 * ambiguous field checks that survive deterministic normalization.
 *
 * Uses `gemini-2.5-flash-lite` (or whatever `GEMINI_JUDGMENT_MODEL` is set
 * to) for speed. Temperature 0 for reproducibility. Only sends text — never
 * an image — because judgment is a structured-data-comparison task, not a
 * pixel-reading task.
 *
 * Designed to be called in parallel across multiple field comparisons per
 * label. Typical latency on Gemini Flash: 300-700ms per call. Running 2-3
 * judgment calls in parallel stays under 1s total added latency.
 */

import { GoogleGenAI } from '@google/genai';

type JudgmentLlmClient = {
  complete: (system: string, user: string) => Promise<string>;
};

/** Build a judgment client bound to Gemini Flash. Returns null if disabled. */
export function createGeminiJudgmentClient(
  env: Record<string, string | undefined> = process.env
): JudgmentLlmClient | null {
  // Opt-out: set LLM_JUDGMENT=disabled to run deterministic-only
  if (env.LLM_JUDGMENT?.trim().toLowerCase() === 'disabled') {
    return null;
  }

  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    // No Gemini key — LLM judgment is optional, fall back to deterministic
    return null;
  }

  const model = env.GEMINI_JUDGMENT_MODEL?.trim() || 'gemini-2.5-flash-lite';
  const timeoutMs = Number.parseInt(env.GEMINI_JUDGMENT_TIMEOUT_MS ?? '', 10) || 3000;

  const ai = new GoogleGenAI({ apiKey });

  return {
    async complete(system: string, user: string): Promise<string> {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [{ text: user }]
            }
          ],
          config: {
            systemInstruction: system,
            temperature: 0,
            // Structured output isn't required here because the prompt
            // enforces strict JSON, but we ask for JSON mime type to
            // reduce markdown-fencing on flash models.
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          },
          // @ts-expect-error — signal passthrough for abort
          signal: abort.signal
        });
        return response.text ?? '';
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
