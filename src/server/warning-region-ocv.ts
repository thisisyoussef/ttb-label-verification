/**
 * Government Warning OCV (Optical Character Verification).
 *
 * Instead of asking the VLM "is the warning present and correct?" (which
 * returns uninformative 0.38 confidence), we:
 * 1. Ask the VLM where the warning region is (or use the full OCR text)
 * 2. Crop + upscale + binarize just that region
 * 3. Run Tesseract on the crop
 * 4. Compare deterministically against the known canonical text
 *
 * This is OCV (verification against known text), not OCR (unknown text).
 * The decision is fully deterministic — no VLM confidence needed.
 */

import sharp from 'sharp';
import { exec } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import { CANONICAL_GOVERNMENT_WARNING } from '../shared/contracts/review';
import type { NormalizedUploadedLabel } from './review-intake';

const execAsync = promisify(exec);
const TESSERACT_TIMEOUT_MS = 5000;

export type WarningOcvResult = {
  /** Whether the warning text was found and verified. */
  status: 'verified' | 'partial' | 'not-found' | 'error';
  /** Normalized Levenshtein similarity (0-1). 1.0 = exact match. */
  similarity: number;
  /** The raw OCR text extracted from the warning region. */
  extractedText: string;
  /** Character-level edit distance from canonical. */
  editDistance: number;
  /** Whether the heading "GOVERNMENT WARNING" was found in all caps. */
  headingAllCaps: boolean;
  /** Confidence based on OCR quality, not VLM self-assessment. */
  confidence: number;
  /** Duration of the OCV pipeline in ms. */
  durationMs: number;
};

/**
 * Run the government warning OCV pipeline.
 *
 * Tries two approaches in order:
 * 1. If full-label OCR text is available (from pre-pass), extract the
 *    warning section from it — zero latency, high accuracy on clean labels
 * 2. If no pre-pass text, crop the bottom third of the label (where
 *    warnings typically appear), enhance, and run Tesseract on the crop
 */
export async function runWarningOcv(input: {
  label: NormalizedUploadedLabel;
  prepassOcrText?: string;
  /**
   * Optional abort signal. The orchestrator (llm-trace.ts) wires this to
   * VLM completion — once the VLM returns, any still-in-flight OCV
   * rotation fallbacks are cancelled so they can't extend wall-clock.
   * The fast (bottom-crop) path always runs to completion because it's
   * the primary signal; only the multi-rotation fallbacks honor the
   * abort.
   */
  signal?: AbortSignal;
}): Promise<WarningOcvResult> {
  const startedAt = performance.now();

  // Approach 1: Extract from pre-pass OCR text (fast path)
  if (input.prepassOcrText) {
    const warningText = extractWarningSection(input.prepassOcrText);
    if (warningText) {
      const result = compareWarningText(warningText);
      return {
        ...result,
        durationMs: Math.round(performance.now() - startedAt)
      };
    }
    // Pre-pass didn't find warning text — fall through to cropped OCR
  }

  // Approach 2: Crop bottom region + enhanced Tesseract OCR
  try {
    const croppedText = await runCroppedWarningOcr(input.label, input.signal);
    if (croppedText) {
      const warningText = extractWarningSection(croppedText);
      if (warningText) {
        const result = compareWarningText(warningText);
        return {
          ...result,
          durationMs: Math.round(performance.now() - startedAt)
        };
      }

      // Got text from bottom crop but no warning found there
      return {
        status: 'not-found',
        similarity: 0,
        extractedText: '',
        editDistance: 999,
        headingAllCaps: false,
        confidence: 0.7, // We tried hard and didn't find it
        durationMs: Math.round(performance.now() - startedAt)
      };
    }

    return {
      status: 'error',
      similarity: 0,
      extractedText: '',
      editDistance: 999,
      headingAllCaps: false,
      confidence: 0.1,
      durationMs: Math.round(performance.now() - startedAt)
    };
  } catch {
    return {
      status: 'error',
      similarity: 0,
      extractedText: '',
      editDistance: 999,
      headingAllCaps: false,
      confidence: 0.1,
      durationMs: Math.round(performance.now() - startedAt)
    };
  }
}

/**
 * Multi-region, multi-angle warning OCR.
 *
 * Government warnings appear in various positions and orientations:
 * - Bottom of front label (horizontal)
 * - Right edge (rotated 90° CW — read bottom to top)
 * - Left edge (rotated 90° CCW — read top to bottom)
 * - Back label (not visible in front-only images)
 *
 * Tries bottom crop (horizontal), then right/left edge strips
 * at 90° and 270° rotation. Returns the first result that
 * contains recognizable warning text.
 *
 * Performance note: OCV always runs in parallel with the Gemini VLM call
 * (see llm-trace.ts). The VLM is the long pole at ~2.8-3.4s, so even the
 * 5-region fallback's worst case (~1s) finishes well inside the VLM
 * window. Trimming the fallback to 2 regions was measured on 2026-04-17
 * and rejected: it saved ~400ms of OCV stage time but cost 2 labels their
 * warning-found fallback (+2 false rejects), and the stage-time saving
 * doesn't move wall-clock because OCV is already parallel with VLM.
 */
async function runCroppedWarningOcr(
  label: NormalizedUploadedLabel,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const meta = await sharp(label.buffer).metadata();
    if (!meta.width || !meta.height) return null;
    const w = meta.width;
    const h = meta.height;

    // Strategy 1: Bottom 40% (most common placement). Always runs to
    // completion — this is the primary signal. On our corpus this catches
    // ~82% of labels in ~300-500ms.
    const bottomText = await ocrRegion(label.buffer, {
      left: 0, top: Math.floor(h * 0.6), width: w, height: h - Math.floor(h * 0.6)
    }, 0, w * 2);
    if (bottomText && /GOVERNMENT\s*WARNING/i.test(bottomText)) return bottomText;

    // Fallbacks below are only needed for wrap-around labels where the
    // warning runs up the side. They're cancellable — once the VLM
    // returns (main pipeline's long pole), we short-circuit out with
    // whatever bottom text we already have. This preserves the edge-case
    // coverage on slow VLM responses while guaranteeing OCV never extends
    // wall-clock when the VLM is fast.
    if (signal?.aborted) return bottomText ?? null;

    // Strategy 2: Right edge strip at 90° rotation (wrap-around labels)
    const stripW = Math.floor(w * 0.15);
    const rightText = await ocrRegion(label.buffer, {
      left: w - stripW, top: 0, width: stripW, height: h
    }, 90, h * 3);
    if (rightText && /GOVERNMENT\s*WARNING/i.test(rightText)) return rightText;
    if (signal?.aborted) return rightText ?? bottomText ?? null;

    // Strategy 3: Right edge at 270°
    const right270 = await ocrRegion(label.buffer, {
      left: w - stripW, top: 0, width: stripW, height: h
    }, 270, h * 3);
    if (right270 && /GOVERNMENT\s*WARNING/i.test(right270)) return right270;
    if (signal?.aborted) return right270 ?? rightText ?? bottomText ?? null;

    // Strategy 4: Left edge strip at 90° and 270°
    const leftText90 = await ocrRegion(label.buffer, {
      left: 0, top: 0, width: stripW, height: h
    }, 90, h * 3);
    if (leftText90 && /GOVERNMENT\s*WARNING/i.test(leftText90)) return leftText90;
    if (signal?.aborted) return leftText90 ?? right270 ?? rightText ?? bottomText ?? null;

    const leftText270 = await ocrRegion(label.buffer, {
      left: 0, top: 0, width: stripW, height: h
    }, 270, h * 3);
    if (leftText270 && /GOVERNMENT\s*WARNING/i.test(leftText270)) return leftText270;

    // No warning found in any region/angle
    return bottomText ?? rightText ?? null;
  } catch {
    return null;
  }
}

/** Crop a region, optionally rotate, upscale, enhance, then OCR. */
async function ocrRegion(
  imageBuffer: Buffer,
  region: { left: number; top: number; width: number; height: number },
  rotateDeg: number,
  targetWidth: number
): Promise<string | null> {
  try {
    const cropped = await sharp(imageBuffer, { failOn: 'none' })
      .extract(region)
      .toBuffer();

    const rotated = rotateDeg === 0
      ? cropped
      : await sharp(cropped).rotate(rotateDeg).toBuffer();

    const rMeta = await sharp(rotated).metadata();
    const enhanced = await sharp(rotated)
      .resize({ width: Math.max(targetWidth, (rMeta.width ?? 500) * 2), kernel: 'lanczos3' })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .png()
      .toBuffer();

    return await runTesseractOnBuffer(enhanced);
  } catch {
    return null;
  }
}

function extractWarningSection(text: string): string | null {
  // Look for "GOVERNMENT WARNING" heading
  const match = text.match(/GOVERNMENT\s*WARNING[\s\S]*/i);
  if (!match) return null;

  // Clean up the extracted section
  return match[0]
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareWarningText(extractedWarning: string): Omit<WarningOcvResult, 'durationMs'> {
  const normalizedExtracted = normalizeForComparison(extractedWarning);
  const normalizedCanonical = normalizeForComparison(CANONICAL_GOVERNMENT_WARNING);

  const editDistance = levenshteinDistance(normalizedExtracted, normalizedCanonical);
  const maxLen = Math.max(normalizedExtracted.length, normalizedCanonical.length);
  const similarity = maxLen > 0 ? 1 - editDistance / maxLen : 0;

  // Check if heading is in all caps
  const headingMatch = extractedWarning.match(/^(GOVERNMENT\s*WARNING)/i);
  const headingAllCaps = headingMatch
    ? headingMatch[1] === headingMatch[1].toUpperCase()
    : false;

  // Determine status and confidence based on similarity
  // Real Tesseract OCR on small warning text typically achieves 85-95%
  // similarity due to character noise. 0.85 is the pass threshold;
  // below that we still have partial text to work with.
  if (similarity >= 0.85) {
    return {
      status: 'verified',
      similarity,
      extractedText: extractedWarning,
      editDistance,
      headingAllCaps,
      // High confidence — deterministic OCR comparison, not VLM guess
      confidence: 0.93
    };
  }

  if (similarity >= 0.65) {
    return {
      status: 'partial',
      similarity,
      extractedText: extractedWarning,
      editDistance,
      headingAllCaps,
      confidence: 0.70
    };
  }

  return {
    status: 'partial',
    similarity,
    extractedText: extractedWarning,
    editDistance,
    headingAllCaps,
    confidence: 0.50
  };
}

function normalizeForComparison(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase();
}

async function runTesseractOnBuffer(buffer: Buffer): Promise<string | null> {
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const tmpPath = `${tmpdir()}/ttb-warning-ocv-${Date.now()}.png`;

  try {
    writeFileSync(tmpPath, buffer);
    const { stdout } = await execAsync(
      `tesseract ${tmpPath} stdout -l eng --psm 6 --oem 1 2>/dev/null`,
      { timeout: TESSERACT_TIMEOUT_MS, encoding: 'utf-8' }
    );
    return stdout;
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let previous = new Array<number>(n + 1);
  let current = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) previous[j] = j;
  for (let i = 1; i <= m; i++) {
    current[0] = i;
    for (let j = 1; j <= n; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[n];
}
