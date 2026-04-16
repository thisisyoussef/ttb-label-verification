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
  totalDurationMs: number;
};

/**
 * Run all boot-time warmup tasks sequentially. Total time is typically
 * 500-1500ms depending on whether tesseract's language data is on hot cache.
 */
export async function runBootWarmup(): Promise<BootWarmupResult> {
  const startedAt = performance.now();
  const tesseract = await warmTesseract();
  const sharpReady = await warmSharp();
  const ocrPipeline = await warmOcrPipeline();

  return {
    tesseract,
    sharp: sharpReady,
    ocrPipeline,
    totalDurationMs: Math.round(performance.now() - startedAt)
  };
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
