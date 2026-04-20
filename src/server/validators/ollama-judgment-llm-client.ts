/**
 * Ollama-backed judgment client — a local drop-in for createGeminiJudgmentClient.
 *
 * Same interface:
 *   { complete: (system: string, user: string) => Promise<string> }
 *
 * Same semantics: temperature 0, JSON-constrained output, short timeout, used
 * only for ambiguous field checks. Runs against a small text-only model
 * (`OLLAMA_JUDGMENT_MODEL`, default `qwen2.5:1.5b-instruct`) that is fast on
 * Apple Silicon (~300-800ms per call warm).
 *
 * We set format:"json" so Ollama constrains the output to valid JSON. We do
 * not pin a strict JSON schema here because the judgment prompt enumerates
 * its own schema in the system prompt — looser constraints give the model
 * flexibility to emit the correct keys (`disposition`, `confidence`,
 * `reasoning`, `ruleApplied`).
 */

type JudgmentLlmClient = {
  complete: (system: string, user: string) => Promise<string>;
};

const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_JUDGMENT_MODEL = 'qwen2.5:1.5b-instruct';
const DEFAULT_OLLAMA_JUDGMENT_TIMEOUT_MS = 10000;
// Keep the small judgment LLM resident between calls so alternating between
// the VLM and the judgment model does not trigger a 10-20s reload each time.
// Override with OLLAMA_JUDGMENT_KEEP_ALIVE (e.g. "30m", "-1" for always).
const DEFAULT_OLLAMA_JUDGMENT_KEEP_ALIVE = '30m';

export function createOllamaJudgmentClient(
  env: Record<string, string | undefined> = process.env
): JudgmentLlmClient | null {
  if (env.LLM_JUDGMENT?.trim().toLowerCase() === 'disabled') {
    return null;
  }

  const host = env.OLLAMA_HOST?.trim() || DEFAULT_OLLAMA_HOST;
  const model =
    env.OLLAMA_JUDGMENT_MODEL?.trim() || DEFAULT_OLLAMA_JUDGMENT_MODEL;
  const timeoutMs = readPositiveInt(
    env.OLLAMA_JUDGMENT_TIMEOUT_MS,
    DEFAULT_OLLAMA_JUDGMENT_TIMEOUT_MS
  );
  const keepAlive =
    env.OLLAMA_JUDGMENT_KEEP_ALIVE?.trim() || DEFAULT_OLLAMA_JUDGMENT_KEEP_ALIVE;

  return {
    async complete(system: string, user: string): Promise<string> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(
          `${host.replace(/\/$/, '')}/api/chat`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
              ],
              stream: false,
              format: 'json',
              keep_alive: keepAlive,
              options: {
                temperature: 0,
                num_predict: 512
              }
            })
          }
        );

        if (!response.ok) {
          return '';
        }

        const body = (await response.json()) as {
          message?: { content?: string };
        };
        return body.message?.content ?? '';
      } catch {
        // Client returns empty string on any failure; the executor falls
        // back to the deterministic review verdict (safer than guessing).
        return '';
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

function readPositiveInt(raw: string | undefined, fallback: number) {
  const n = Number(raw?.trim());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}
