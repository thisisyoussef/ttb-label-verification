/**
 * Judgment client factory — returns a local or cloud judgment LLM client
 * based on env. Keeps the pipeline in `llm-trace.ts` unchanged: the trace
 * calls `createJudgmentLlmClient()` and gets either the Gemini client, the
 * Ollama local client, or `null` if judgment is disabled.
 *
 * Selection:
 *   - LLM_JUDGMENT=disabled                 → null (no judgment layer)
 *   - LLM_JUDGMENT_PROVIDER=ollama          → Ollama local client
 *   - AI_PROVIDER=local                     → Ollama local client
 *   - AI_EXTRACTION_MODE_DEFAULT=local      → Ollama local client
 *   - otherwise                             → Gemini client (cloud default)
 *
 * If a cloud client is requested but GEMINI_API_KEY is missing, returns
 * null — same as the existing behavior. The pipeline then skips the
 * judgment layer.
 */

import { createGeminiJudgmentClient } from './judgment-llm-client';
import { createOllamaJudgmentClient } from './ollama-judgment-llm-client';

type JudgmentLlmClient = {
  complete: (system: string, user: string) => Promise<string>;
};

export function createJudgmentLlmClient(
  env: Record<string, string | undefined> = process.env
): JudgmentLlmClient | null {
  if (env.LLM_JUDGMENT?.trim().toLowerCase() === 'disabled') {
    return null;
  }

  const provider = env.LLM_JUDGMENT_PROVIDER?.trim().toLowerCase();
  const aiProvider = env.AI_PROVIDER?.trim().toLowerCase();
  const modeDefault = env.AI_EXTRACTION_MODE_DEFAULT?.trim().toLowerCase();

  // Explicit override wins: if the operator specifically asked for a
  // judgment provider, honor that regardless of what extraction uses.
  // This is the key to the "local extraction + cloud judgment" combo,
  // which on measured pods cuts total request time by ~3-5s because
  // Gemini Flash Lite has no cold-start and no GPU-swap cost.
  if (provider === 'gemini' || provider === 'openai') {
    return createGeminiJudgmentClient(env);
  }
  if (provider === 'ollama' || provider === 'local') {
    return createOllamaJudgmentClient(env);
  }

  // Fallback: infer from the extraction provider. Local extraction →
  // local judgment (data-locality default); otherwise use cloud.
  const wantsLocal =
    aiProvider === 'local' ||
    aiProvider === 'ollama' ||
    aiProvider === 'ollama-vlm' ||
    modeDefault === 'local';

  if (wantsLocal) {
    return createOllamaJudgmentClient(env);
  }

  return createGeminiJudgmentClient(env);
}
