/**
 * Boot-time warmup for latency-sensitive subsystems.
 *
 * Motivation: the first request in any pipeline run pays a hidden cold-start
 * penalty because:
 *   - Tesseract has not loaded its language data files (eng.traineddata)
 *   - sharp has not JIT-initialized its image pipelines
 *   - Ollama may not have the VLM resident if the Mac just booted
 *
 * Each of those only matters once, but they show up as an outlier in the p95
 * of the first few labels in a batch. Running the warmup before `app.listen()`
 * shifts that cost off the request path.
 *
 * Safe to call multiple times. Each sub-warmup catches its own errors — the
 * server must still boot even if tesseract is not installed or Ollama is down.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type BootWarmupResult = {
  tesseract: { ok: boolean; durationMs: number; note?: string };
  sharp: { ok: boolean; durationMs: number; note?: string };
  ocrPipeline: { ok: boolean; durationMs: number; note?: string };
  ollamaVlm: { ok: boolean; durationMs: number; note?: string };
  ollamaJudgment: { ok: boolean; durationMs: number; note?: string };
  gemini: { ok: boolean; durationMs: number; note?: string };
  totalDurationMs: number;
};

/**
 * Run all boot-time warmup tasks. CPU-bound steps (tesseract, sharp) run
 * sequentially because they're fast. Ollama model warmups run IN PARALLEL
 * with each other, because a cold load of each ~1GB (judgment) or ~3GB
 * (VLM) model from disk takes ~3-8s and there's no reason to serialize
 * them at boot time.
 *
 * Goal: at the end of warmup, both the VLM and the judgment model are
 * resident with `keep_alive` set to a long horizon, so the first real
 * request pays zero model-load time. When `AI_PROVIDER=cloud`, the
 * OLLAMA_* env vars are unset and both Ollama warmups no-op.
 */
export async function runBootWarmup(): Promise<BootWarmupResult> {
  const startedAt = performance.now();
  const tesseract = await warmTesseract();
  const sharpReady = await warmSharp();
  const ocrPipeline = await warmOcrPipeline();
  // Fire all remote warmups in parallel — they're all optional, their
  // timeouts cap their worst case, and none depends on the others.
  const [ollamaVlm, ollamaJudgment, gemini] = await Promise.all([
    warmOllamaVlm(),
    warmOllamaJudgment(),
    warmGemini()
  ]);

  return {
    tesseract,
    sharp: sharpReady,
    ocrPipeline,
    ollamaVlm,
    ollamaJudgment,
    gemini,
    totalDurationMs: Math.round(performance.now() - startedAt)
  };
}

/**
 * Establish a warm HTTPS connection to generativelanguage.googleapis.com and
 * verify GEMINI_API_KEY is valid. Uses a tiny text-only prompt that returns
 * a bounded response, so the warmup's worst case is a few hundred ms.
 *
 * Benefit: the first real review request inherits a warm TLS session and
 * a validated API key. Without this, the first VLM call pays ~100-200ms of
 * handshake and opens the pool from cold.
 */
async function warmGemini(): Promise<BootWarmupResult['gemini']> {
  const startedAt = performance.now();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, durationMs: 0, note: 'GEMINI_API_KEY not set; skipping' };
  }
  const model = process.env.GEMINI_VISION_MODEL?.trim() || 'gemini-2.5-flash-lite';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4_000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
          generationConfig: { maxOutputTokens: 1, temperature: 0 }
        })
      }
    );
    clearTimeout(timer);
    return {
      ok: res.ok,
      durationMs: Math.round(performance.now() - startedAt),
      note: res.ok ? undefined : `http=${res.status}`
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      note: (error as Error).message.slice(0, 120)
    };
  }
}

/**
 * Fire a trivial prompt at the VLM with `keep_alive: "60m"` to force the
 * model into VRAM. No image — that would bloat warmup time with vision
 * tower compute. The first real request will still do vision preproc,
 * but the attention weights are already loaded.
 *
 * Safe to no-op in environments without Ollama (returns ok=false, which
 * is fine — the server still boots).
 */
async function warmOllamaVlm(): Promise<BootWarmupResult['ollamaVlm']> {
  const startedAt = performance.now();
  const host = (process.env.OLLAMA_HOST ?? '').trim();
  const model = (process.env.OLLAMA_VISION_MODEL ?? '').trim();
  if (!host || !model) {
    return { ok: false, durationMs: 0, note: 'ollama env not set; skipping' };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(`${host.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'ok',
        stream: false,
        keep_alive: '60m',
        options: { num_predict: 1, temperature: 0 }
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    return {
      ok: res.ok,
      durationMs: Math.round(performance.now() - startedAt),
      note: res.ok ? undefined : `http=${res.status}`
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      note: (error as Error).message.slice(0, 120)
    };
  }
}

/**
 * Same pattern for the judgment model. Uses `/api/chat` to match the
 * client's real request shape, so the first post-warmup judgment call
 * sees a hot path from the very first message.
 */
async function warmOllamaJudgment(): Promise<BootWarmupResult['ollamaJudgment']> {
  const startedAt = performance.now();
  const host = (process.env.OLLAMA_HOST ?? '').trim();
  const model = (process.env.OLLAMA_JUDGMENT_MODEL ?? '').trim();
  if (!host || !model) {
    return { ok: false, durationMs: 0, note: 'ollama env not set; skipping' };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(`${host.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ok' }],
        stream: false,
        keep_alive: '60m',
        options: { num_predict: 1, temperature: 0 }
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    return {
      ok: res.ok,
      durationMs: Math.round(performance.now() - startedAt),
      note: res.ok ? undefined : `http=${res.status}`
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      note: (error as Error).message.slice(0, 120)
    };
  }
}

async function warmTesseract(): Promise<BootWarmupResult['tesseract']> {
  const startedAt = performance.now();
  try {
    await execAsync('tesseract --version', { timeout: 3000 });
    return {
      ok: true,
      durationMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      note: (error as Error).message.slice(0, 120)
    };
  }
}

async function warmSharp(): Promise<BootWarmupResult['sharp']> {
  const startedAt = performance.now();
  try {
    const sharp = (await import('sharp')).default;
    // 4x4 solid-color PNG through the full metadata + grayscale pipeline.
    // Forces sharp's pipelines to JIT-compile their first invocation.
    const blank = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#fff' }
    })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
    return {
      ok: blank.length > 0,
      durationMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      note: (error as Error).message.slice(0, 120)
    };
  }
}

/**
 * Fire a real end-to-end OCR pass on a tiny synthetic image. This primes
 * both tesseract's language model cache and sharp's pipeline in one shot,
 * which matches how `runOcrPrepass` is called at request time.
 */
async function warmOcrPipeline(): Promise<BootWarmupResult['ocrPipeline']> {
  const startedAt = performance.now();
  try {
    const sharp = (await import('sharp')).default;
    const { tmpdir } = await import('node:os');
    const { writeFileSync, unlinkSync } = await import('node:fs');

    // Synthesize a minimum-viable text PNG via SVG. Cheap, avoids shipping a fixture.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="48">' +
        '<rect width="100%" height="100%" fill="white"/>' +
        '<text x="10" y="32" font-family="sans-serif" font-size="24" fill="black">warmup 12</text>' +
        '</svg>'
    );
    const png = await sharp(svg).png().toBuffer();
    const tmpPath = `${tmpdir()}/ttb-warmup-${Date.now()}.png`;
    writeFileSync(tmpPath, png);
    try {
      await execAsync(
        `tesseract ${tmpPath} stdout -l eng --psm 3 --oem 1 2>/dev/null`,
        { timeout: 5000, encoding: 'utf-8' }
      );
    } finally {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
    return {
      ok: true,
      durationMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      note: (error as Error).message.slice(0, 120)
    };
  }
}
