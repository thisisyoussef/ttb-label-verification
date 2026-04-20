import { exec } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import type { NormalizedUploadedLabel } from '../review/review-intake';
import { preprocessImageForOcr } from './ocr-image-preprocessing';

const execAsync = promisify(exec);

const OCR_TIMEOUT_MS = 5000;

export type OcrPrepassResult =
  | {
      status: 'ok';
      text: string;
      durationMs: number;
      preprocessingApplied: string[];
    }
  | {
      status: 'degraded';
      text: string;
      durationMs: number;
      reason: string;
      preprocessingApplied: string[];
    }
  | { status: 'failed'; reason: string; durationMs: number };

/**
 * Run full-label Tesseract OCR with image preprocessing.
 *
 * Pipeline: sharp preprocessing → Tesseract OCR → full raw text.
 *
 * Returns all visible text on the label, not just the government warning.
 * The LLM then structures this pre-read text instead of reading pixels.
 *
 * Designed to run before the VLM call. Typical wall-clock: ~1-2s
 * (50-200ms preprocessing + 600ms-1.5s OCR).
 */
export async function runOcrPrepass(
  label: NormalizedUploadedLabel
): Promise<OcrPrepassResult> {
  const startedAt = performance.now();

  const preprocessed = await preprocessImageForOcr(label);

  // Primary pass: full image, standard orientation.
  // Edge rotation is handled separately by the warning OCV module —
  // merging noisy rotated text into the main OCR pre-pass causes
  // more harm than good (interleaved address/warning lines pollute fields).
  const mergedOcrText = await runTesseractOnBuffer(preprocessed.buffer);

  const durationMs = Math.round(performance.now() - startedAt);

  if (mergedOcrText === null) {
    return { status: 'failed', reason: 'tesseract-unavailable', durationMs };
  }

  const trimmed = mergedOcrText.trim();

  if (trimmed.length === 0) {
    return {
      status: 'failed',
      reason: 'no-text-extracted',
      durationMs
    };
  }

  // If we got very little text, it's likely degraded but still usable.
  if (trimmed.length < 20) {
    return {
      status: 'degraded',
      text: trimmed,
      durationMs,
      reason: 'minimal-text-extracted',
      preprocessingApplied: preprocessed.preprocessingApplied
    };
  }

  return {
    status: 'ok',
    text: trimmed,
    durationMs,
    preprocessingApplied: preprocessed.preprocessingApplied
  };
}

/**
 * Check whether the OCR pre-pass feature is enabled.
 *
 * Default: enabled. Set OCR_PREPASS=disabled to fall back to VLM-only.
 */
export function isOcrPrepassEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.OCR_PREPASS?.trim().toLowerCase() !== 'disabled';
}

async function runTesseractOnBuffer(
  buffer: Buffer
): Promise<string | null> {
  // Use temp file directly — stdin pipe is unreliable across platforms,
  // and /tmp/ is sandboxed on macOS. os.tmpdir() works everywhere.
  return runTesseractWithTempFile(buffer);
}

async function runTesseractWithTempFile(
  buffer: Buffer
): Promise<string | null> {
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const tmpPath = `${tmpdir()}/ttb-ocr-prepass-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;

  try {
    writeFileSync(tmpPath, buffer);
    const { stdout } = await execAsync(
      `tesseract ${tmpPath} stdout -l eng --psm 3 --oem 1 2>/dev/null`,
      { timeout: OCR_TIMEOUT_MS, encoding: 'utf-8' }
    );
    return stdout;
  } catch {
    return null;
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* ignore cleanup failure */
    }
  }
}

/**
 * Run OCR on rotated edge strips to capture sideways text.
 * Tries right and left edges at 90° rotation.
 * Returns merged text from all successful passes.
 */
async function _runEdgeRotationPasses(imageBuffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(imageBuffer).metadata();
    if (!meta.width || !meta.height) return null;

    const w = meta.width;
    const h = meta.height;
    const stripW = Math.floor(w * 0.15);
    const results: string[] = [];

    // Right edge at 90°
    try {
      const cropped = await sharp(imageBuffer, { failOn: 'none' })
        .extract({ left: w - stripW, top: 0, width: stripW, height: h })
        .toBuffer();
      const rotated = await sharp(cropped).rotate(90).toBuffer();
      const rMeta = await sharp(rotated).metadata();
      const enhanced = await sharp(rotated)
        .resize({ width: Math.max(h * 3, (rMeta.width ?? 500) * 2), kernel: 'lanczos3' })
        .grayscale().normalize().sharpen({ sigma: 1.5 }).png().toBuffer();
      const text = await runTesseractOnBuffer(enhanced);
      if (text && text.trim().length > 10) results.push(text.trim());
    } catch { /* skip */ }

    // Left edge at 270° (opposite rotation)
    try {
      const cropped = await sharp(imageBuffer, { failOn: 'none' })
        .extract({ left: 0, top: 0, width: stripW, height: h })
        .toBuffer();
      const rotated = await sharp(cropped).rotate(270).toBuffer();
      const rMeta = await sharp(rotated).metadata();
      const enhanced = await sharp(rotated)
        .resize({ width: Math.max(h * 3, (rMeta.width ?? 500) * 2), kernel: 'lanczos3' })
        .grayscale().normalize().sharpen({ sigma: 1.5 }).png().toBuffer();
      const text = await runTesseractOnBuffer(enhanced);
      if (text && text.trim().length > 10) results.push(text.trim());
    } catch { /* skip */ }

    return results.length > 0 ? results.join('\n') : null;
  } catch {
    return null;
  }
}

/** Merge primary OCR text with edge rotation text, deduplicating. */
function _mergeOcrTexts(primary: string | null, edges: string | null): string | null {
  if (!primary && !edges) return null;
  if (!edges) return primary;
  if (!primary) return edges;
  return primary.trim() + '\n' + edges.trim();
}

export const _unused_ocr_helpers = { runEdgeRotationPasses: _runEdgeRotationPasses, mergeOcrTexts: _mergeOcrTexts };

