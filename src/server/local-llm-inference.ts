/**
 * Thin wrapper around node-llama-cpp that exposes a single-call inference function
 * with JSON-schema-constrained decoding. Model is loaded once (lazy) and reused
 * for subsequent calls.
 *
 * Lazy-imported to keep the factory bundle small on workstations that don't use
 * local mode.
 */

import type {
  LocalLlmInferenceFn,
  LocalLlmReviewExtractionConfig
} from './local-llm-review-extractor';

// node-llama-cpp is an optional dependency — only installed on workstations
// that run the node-llama-cpp-based local LLM pipeline. Production deployments
// use Ollama (src/server/ollama-vlm-review-extractor.ts) and don't need this
// module. The type is kept loose so the file type-checks even when the
// package isn't installed in CI.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LlamaModule = any;

interface CachedInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llama: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  modelPath: string;
  contextSize: number;
}

let cached: CachedInstance | null = null;
let loading: Promise<CachedInstance> | null = null;

async function getOrCreateInstance(
  config: LocalLlmReviewExtractionConfig
): Promise<CachedInstance> {
  if (
    cached &&
    cached.modelPath === config.modelPath &&
    cached.contextSize === config.contextSize
  ) {
    return cached;
  }

  if (loading) {
    return loading;
  }

  loading = (async () => {
    const llamaMod = (await (await import('node-llama-cpp' as any)) ) as LlamaModule;
    const llama = await llamaMod.getLlama();
    const model = await llama.loadModel({ modelPath: config.modelPath });
    cached = {
      llama,
      model,
      modelPath: config.modelPath,
      contextSize: config.contextSize
    };
    return cached;
  })();

  try {
    const instance = await loading;
    return instance;
  } finally {
    loading = null;
  }
}

export function createLocalLlmInferenceFn(
  config: LocalLlmReviewExtractionConfig
): LocalLlmInferenceFn {
  return async ({ prompt, maxTokens, jsonSchema }) => {
    const instance = await getOrCreateInstance(config);
    const llamaMod = (await (await import('node-llama-cpp' as any)) ) as LlamaModule;
    const { LlamaChatSession } = llamaMod;

    // Build a grammar from the JSON schema so the model is forced to return valid JSON.
    const grammar = await instance.llama.createGrammarForJsonSchema(
      jsonSchema as Parameters<typeof instance.llama.createGrammarForJsonSchema>[0]
    );

    // Fresh context per call — cheaper than restoring state between very different prompts.
    const context = await instance.model.createContext({
      contextSize: config.contextSize
    });
    try {
      const session = new LlamaChatSession({
        contextSequence: context.getSequence()
      });
      const raw = await session.prompt(prompt, {
        maxTokens,
        temperature: 0,
        grammar
      });
      return { text: raw };
    } finally {
      await context.dispose().catch(() => {
        /* ignore */
      });
    }
  };
}

/** Explicit disposal for tests/scripts that want to free memory. */
export async function disposeLocalLlmCache(): Promise<void> {
  if (!cached) return;
  try {
    await cached.model.dispose();
  } catch {
    /* ignore */
  }
  cached = null;
}
