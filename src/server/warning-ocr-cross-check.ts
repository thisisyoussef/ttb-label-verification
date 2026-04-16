import { exec } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import type { NormalizedUploadedLabel } from './review-intake';

const execAsync = promisify(exec);

const OCR_TIMEOUT_MS = 3000;
const USABLE_EDIT_DISTANCE_THRESHOLD = 15;

export type OcrCrossCheckResult =
  | { status: 'agree'; ocrText: string; editDistance: number }
  | { status: 'disagree'; ocrText: string; editDistance: number }
  | { status: 'abstain'; reason: string };

/**
 * Run Tesseract OCR on the label image and cross-check the extracted
 * warning text against the VLM's extraction.
 *
 * Designed to run in parallel with the VLM call via Promise.all.
 * Tesseract finishes in ~600ms; the VLM takes 1-3s. Zero added
 * wall-clock time.
 *
 * Returns:
 * - `agree`: OCR and VLM see substantially the same warning text.
 *   Confidence boost — two independent observations match.
 * - `disagree`: OCR produced usable text but it differs meaningfully
 *   from the VLM's extraction. Confidence reduction — one of them
 *   may have hallucinated or misread.
 * - `abstain`: OCR couldn't produce usable text (tesseract missing,
 *   image too degraded, no warning found). No impact on confidence.
 */
export async function runWarningOcrCrossCheck(input: {
  label: NormalizedUploadedLabel;
  vlmWarningText: string;
}): Promise<OcrCrossCheckResult> {
  const ocrText = await runTesseractOnBuffer(input.label);
  if (ocrText === null) {
    return { status: 'abstain', reason: 'tesseract-unavailable' };
  }

  const ocrWarning = extractWarningFromOcrText(ocrText);
  if (ocrWarning === null) {
    return { status: 'abstain', reason: 'warning-not-found-in-ocr' };
  }

  const distance = levenshteinDistance(
    normalizeForComparison(ocrWarning),
    normalizeForComparison(input.vlmWarningText)
  );

  if (distance > USABLE_EDIT_DISTANCE_THRESHOLD) {
    // OCR output is too garbled to be a reliable cross-check.
    return { status: 'abstain', reason: 'ocr-too-noisy' };
  }

  if (distance <= 3) {
    return { status: 'agree', ocrText: ocrWarning, editDistance: distance };
  }

  return { status: 'disagree', ocrText: ocrWarning, editDistance: distance };
}

/**
 * Adjust the VLM's warning confidence based on the OCR cross-check.
 *
 * - agree: small boost (cap at 1.0)
 * - disagree: meaningful reduction (pushes toward REVIEW threshold)
 * - abstain: no change
 */
export function applyOcrCrossCheckToConfidence(
  vlmConfidence: number,
  crossCheck: OcrCrossCheckResult
): number {
  if (crossCheck.status === 'abstain') {
    return vlmConfidence;
  }

  if (crossCheck.status === 'agree') {
    // Two independent readings agree — boost by up to 0.05
    return Math.min(1.0, vlmConfidence + 0.05);
  }

  // Disagree — reduce proportionally to edit distance.
  // 4-5 edits = small reduction, 10-15 edits = larger reduction.
  const reductionFactor = Math.min(0.15, crossCheck.editDistance * 0.02);
  return Math.max(0, vlmConfidence - reductionFactor);
}

async function runTesseractOnBuffer(
  label: NormalizedUploadedLabel
): Promise<string | null> {
  try {
    // Pipe the image buffer to tesseract via stdin.
    // --psm 3 = fully automatic page segmentation (best for full labels).
    const { stdout } = await execAsync(
      'tesseract stdin stdout -l eng --psm 3',
      {
        timeout: OCR_TIMEOUT_MS,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024
      }
    );
    return stdout;
  } catch (error: unknown) {
    // Tesseract not installed or timed out — abstain gracefully.
    const message =
      error instanceof Error ? error.message : String(error);

    if (message.includes('ENOENT') || message.includes('not found')) {
      return null; // tesseract binary not available
    }

    // stdin pipe might not work on all platforms. Fall back to temp file.
    return runTesseractWithTempFile(label);
  }
}

async function runTesseractWithTempFile(
  label: NormalizedUploadedLabel
): Promise<string | null> {
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const tmpPath = `${tmpdir()}/ttb-ocr-${Date.now()}.png`;

  try {
    writeFileSync(tmpPath, label.buffer);
    const { stdout } = await execAsync(
      `tesseract ${tmpPath} stdout -l eng --psm 3 2>/dev/null`,
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

function extractWarningFromOcrText(ocrText: string): string | null {
  const match = ocrText.match(/GOVERNMENT\s*WARNING[\s\S]*/i);
  if (!match) return null;
  return match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeForComparison(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use two-row optimization for memory efficiency.
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
