/**
 * Government-warning VERIFICATION track (27 CFR Part 16).
 *
 * Framing shift per the briefing: this is VERIFICATION, not
 * extraction. We know the exact 260-character canonical text (§ 16.21)
 * — we're confirming it's present on the label, not reading unknown
 * text. That reframes the pipeline:
 *
 *   1. Anchor-based region detection (no VLM). Run Tesseract on the
 *      full image once, find the token "GOVERNMENT" / "WARNING" /
 *      "SURGEON" to locate the warning paragraph. Crop generously
 *      around it.
 *   2. Aggressive preprocessing on just the cropped region:
 *      grayscale → CLAHE (via sharp normalize) → upscale 3x with
 *      lanczos3 → optional invert for dark-on-light.
 *   3. Guided Tesseract with a user-word vocabulary containing ONLY
 *      the ~45 words in the canonical warning. This tips ambiguous
 *      reads toward the correct word ("GOVERNMNET" → "GOVERNMENT")
 *      because Tesseract's language model prefers vocabulary
 *      matches.
 *   4. Multi-signal compare against the hard-coded canonical
 *      (Levenshtein + critical-word presence), not against the VLM.
 *      LLMs silently "correct" warning text — catastrophic for
 *      verification.
 *
 * This module contains the pure-OCR verification helpers. Wiring
 * into government-warning-validator.ts follows.
 */

import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import sharp from 'sharp';

import type { NormalizedUploadedLabel } from '../review-intake';

const execAsync = promisify(exec);

/**
 * The statute-prescribed text per 27 CFR § 16.21 and the Alcoholic
 * Beverage Labeling Act of 1988 (27 U.S.C. 215). Every word is
 * required verbatim — no paraphrases, no beverage-specific variants.
 */
export const CANONICAL_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

/**
 * Words that MUST appear in any compliant warning. Per the briefing:
 * "Missing any critical word → REJECT regardless of overall
 * similarity." A warning that scores 0.90 Levenshtein similarity but
 * is missing "pregnancy" is not compliant — targeted omissions don't
 * move the aggregate score enough to flag under pure similarity but
 * are legally disqualifying.
 */
export const CRITICAL_WARNING_WORDS = [
  'GOVERNMENT',
  'WARNING',
  'Surgeon General',
  'women',
  'pregnancy',
  'birth defects',
  'impairs',
  'machinery',
  'health problems'
] as const;

/**
 * The full vocabulary of the canonical warning — every unique word,
 * lowercased, deduplicated. Tesseract's `--user-words` flag accepts a
 * file path containing a newline-separated word list; constraining
 * the decoder to this vocabulary tips ambiguous characters toward
 * the statute's actual words. This is the mechanism that turns
 * OCR-level noise (character transpositions, substitutions that
 * produce non-words) into productive signal for verification.
 */
export const WARNING_VOCABULARY: readonly string[] = Array.from(
  new Set(
    CANONICAL_WARNING
      .replace(/[().,:]/g, ' ')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 0)
  )
);

export interface AnchorRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface VerificationResult {
  /** The text OCR extracted from the cropped region (raw). */
  extractedText: string;
  /** Levenshtein-based similarity in [0, 1] vs CANONICAL_WARNING. */
  similarity: number;
  /**
   * Missing critical words. Non-empty means the warning is
   * non-compliant regardless of similarity — the 27 CFR § 16.21
   * required wording includes every word in CRITICAL_WARNING_WORDS.
   */
  missingCriticalWords: string[];
  /** Which anchor region was used (null if we fell back to full image). */
  regionUsed: AnchorRegion | null;
  /** Total wall clock of the verification pass. */
  durationMs: number;
}

/**
 * Run a Tesseract pass on the full image (fast, PSM 3), locate a
 * bounding box around the first anchor token, and return it with a
 * generous margin. Returns null if no anchor found.
 */
export async function findWarningAnchor(
  label: NormalizedUploadedLabel
): Promise<AnchorRegion | null> {
  const meta = await sharp(label.buffer).metadata();
  const width = meta.width ?? 1000;
  const height = meta.height ?? 1000;

  // Extract word-level TSV from Tesseract so we get (word, bbox)
  // tuples instead of flat text. --tsv is a built-in output mode.
  const tmpIn = path.join(tmpdir(), `warn-anchor-${randomBytes(6).toString('hex')}.png`);
  try {
    const prepped = await sharp(label.buffer)
      .resize({ width: Math.min(2400, width * 2), kernel: 'lanczos3' })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
    writeFileSync(tmpIn, prepped);
    const { stdout } = await execAsync(
      `tesseract ${tmpIn} stdout -l eng --psm 3 --oem 1 tsv 2>/dev/null`,
      { timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
    );
    const scale = prepped.length > 0 && meta.width ? Math.min(2400, width * 2) / width : 1;
    const anchor = findAnchorInTsv(stdout);
    if (!anchor) return null;
    // Rescale bbox back to the original image space and pad generously.
    const box = {
      left: Math.max(0, Math.floor((anchor.left - 40) / scale)),
      top: Math.max(0, Math.floor((anchor.top - 40) / scale)),
      width: Math.min(width, Math.floor((anchor.width + 1200) / scale)),
      height: Math.min(height, Math.floor((anchor.height + 600) / scale))
    };
    // Clamp so extract() never runs off the image.
    box.width = Math.min(box.width, width - box.left);
    box.height = Math.min(box.height, height - box.top);
    return box;
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmpIn); } catch { /* ignore */ }
  }
}

interface AnchorHit {
  left: number;
  top: number;
  width: number;
  height: number;
  token: string;
}

/**
 * Parse Tesseract TSV and return the bbox of the first "anchor" word.
 * TSV columns: level, page_num, block_num, par_num, line_num, word_num,
 * left, top, width, height, conf, text
 */
function findAnchorInTsv(tsv: string): AnchorHit | null {
  const anchorWords = new Set(['government', 'warning', 'surgeon', 'general']);
  const rows = tsv.split('\n').slice(1);
  for (const row of rows) {
    const cols = row.split('\t');
    if (cols.length < 12) continue;
    const text = cols[11]?.trim().toLowerCase();
    if (!text || !anchorWords.has(text)) continue;
    const left = Number.parseInt(cols[6]!, 10);
    const top = Number.parseInt(cols[7]!, 10);
    const width = Number.parseInt(cols[8]!, 10);
    const height = Number.parseInt(cols[9]!, 10);
    if (
      Number.isFinite(left) && Number.isFinite(top) &&
      Number.isFinite(width) && Number.isFinite(height) &&
      width > 0 && height > 0
    ) {
      return { left, top, width, height, token: text };
    }
  }
  return null;
}

/**
 * Aggressive preprocessing for a cropped warning region. Runs BEFORE
 * the vocabulary-constrained Tesseract pass. On the full label this
 * treatment would over-process; on the cropped region it dramatically
 * helps Tesseract on small low-contrast text.
 */
async function preprocessCrop(
  imageBuffer: Buffer,
  region: AnchorRegion | null
): Promise<Buffer> {
  let pipeline = sharp(imageBuffer, { failOn: 'none' });
  if (region) pipeline = pipeline.extract(region);
  return pipeline
    .resize({ width: 2400, kernel: 'lanczos3' })
    .grayscale()
    .normalize() // sharp's normalize ≈ contrast stretching (CLAHE-ish)
    .sharpen({ sigma: 1.4, m1: 1, m2: 2 })
    .png()
    .toBuffer();
}

/**
 * Run Tesseract with the warning-vocabulary user-words list. The
 * user-words file is written once per pass to avoid races on parallel
 * calls.
 */
async function runTesseractWithVocabulary(buffer: Buffer): Promise<string> {
  const tmpIn = path.join(tmpdir(), `warn-in-${randomBytes(6).toString('hex')}.png`);
  const tmpWords = path.join(tmpdir(), `warn-words-${randomBytes(6).toString('hex')}.txt`);
  try {
    writeFileSync(tmpIn, buffer);
    writeFileSync(tmpWords, WARNING_VOCABULARY.join('\n') + '\n');
    const { stdout } = await execAsync(
      `tesseract ${tmpIn} stdout -l eng --psm 6 --oem 1 --user-words ${tmpWords} 2>/dev/null`,
      { timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout.trim();
  } catch {
    return '';
  } finally {
    try { unlinkSync(tmpIn); } catch { /* ignore */ }
    try { unlinkSync(tmpWords); } catch { /* ignore */ }
  }
}

/**
 * Full verification pass: anchor → crop → preprocess → guided OCR →
 * compare to canonical. The caller gets similarity + missing-critical-
 * words in one shape they can feed into the 2-of-3 voting.
 */
export async function verifyWarningPresenceByOcr(
  label: NormalizedUploadedLabel
): Promise<VerificationResult> {
  const startedAt = performance.now();
  const region = await findWarningAnchor(label);
  const prepped = await preprocessCrop(label.buffer, region);
  const text = await runTesseractWithVocabulary(prepped);
  const similarity = computeSimilarity(text, CANONICAL_WARNING);
  const missingCriticalWords = findMissingCriticalWords(text);
  return {
    extractedText: text,
    similarity,
    missingCriticalWords,
    regionUsed: region,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

/**
 * Return the critical warning words that do NOT appear in the
 * extracted text (case-insensitive substring). An empty array means
 * every required word is present — necessary (not sufficient) for
 * the warning to be compliant under 27 CFR § 16.21.
 */
export function findMissingCriticalWords(extractedText: string): string[] {
  const norm = extractedText.toLowerCase();
  return CRITICAL_WARNING_WORDS.filter(
    (word) => !norm.includes(word.toLowerCase())
  );
}

/**
 * Normalized Levenshtein-based similarity in [0, 1]. Strips
 * punctuation + whitespace jitter before comparing so OCR
 * punctuation noise doesn't tank the score for an otherwise-valid
 * warning.
 */
export function computeSimilarity(extracted: string, required: string): number {
  if (!extracted) return 0;
  const norm = (s: string) =>
    s.replace(/[().,:]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const a = norm(extracted);
  const b = norm(required);
  if (!a) return 0;
  // Try to locate the warning within a longer OCR blob so embedding
  // doesn't tank the score.
  const anchorIdx = a.indexOf('government');
  const slice = anchorIdx >= 0 ? a.slice(anchorIdx, anchorIdx + Math.floor(b.length * 1.5)) : a;
  const dist = levenshtein(slice, b);
  return 1 - dist / Math.max(b.length, slice.length);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0);
  const curr = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}
