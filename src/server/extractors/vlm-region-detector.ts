/**
 * VLM-guided region detection + per-region OCR.
 *
 * Stage 1: VLM identifies WHERE each field is on the label (no text extraction)
 * Stage 2: Sharp crops each detected region, upscales 3-4x, enhances
 * Stage 3: Tesseract OCR reads each region independently (verified text)
 *
 * The VLM never extracts text — it only provides spatial hints.
 * All text comes from OCR, eliminating hallucination.
 */

import sharp from 'sharp';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { GoogleGenAI } from '@google/genai';

import type { NormalizedUploadedLabel } from '../review/review-intake';

const execAsync = promisify(exec);

export type RegionHint = {
  field: string;
  found: boolean;
  quadrant: string;
  approximateYPercent: number;
};

export type RegionOcrResult = {
  field: string;
  found: boolean;
  ocrText: string | null;
  verified: boolean;
  source: 'vlm-guided-ocr';
};

export type VlmRegionDetectionResult = {
  regions: RegionOcrResult[];
  durationMs: number;
};

const REGION_PROMPT = `Analyze this alcohol label image. For each field, tell me if it's visible and where.

Respond with ONLY valid JSON array:
[
  {"field":"government_warning","found":bool,"quadrant":"position","approximateYPercent":0-100},
  {"field":"alcohol_content","found":bool,"quadrant":"position","approximateYPercent":0-100},
  {"field":"net_contents","found":bool,"quadrant":"position","approximateYPercent":0-100},
  {"field":"brand_name","found":bool,"quadrant":"position","approximateYPercent":0-100}
]

Quadrant values: "top-left","top-right","top-center","bottom-left","bottom-right","bottom-center","center","right-edge-rotated","left-edge-rotated"
For rotated text on edges, use "right-edge-rotated" or "left-edge-rotated".
approximateYPercent: 0=top of image, 100=bottom.
If a field is not visible, set found=false.`;

/**
 * Run VLM region detection followed by per-region OCR.
 *
 * Returns verified OCR text for each field the VLM located.
 * Falls back gracefully — if VLM or OCR fails for a field,
 * that field is marked as not found.
 */
export async function runVlmRegionDetection(
  label: NormalizedUploadedLabel,
  env: Record<string, string | undefined> = process.env
): Promise<VlmRegionDetectionResult> {
  const startedAt = performance.now();
  const apiKey = env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return { regions: [], durationMs: Math.round(performance.now() - startedAt) };
  }

  const meta = await sharp(label.buffer).metadata();
  if (!meta.width || !meta.height) {
    return { regions: [], durationMs: Math.round(performance.now() - startedAt) };
  }

  // Stage 1: VLM detects regions
  let hints: RegionHint[];
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: env.GEMINI_VISION_MODEL || 'gemini-2.5-flash-lite',
      contents: [
        { text: REGION_PROMPT },
        { inlineData: { mimeType: label.mimeType, data: label.buffer.toString('base64') } }
      ],
      config: { responseMimeType: 'application/json' }
    });
    hints = JSON.parse(res.text?.trim() ?? '[]');
  } catch {
    return { regions: [], durationMs: Math.round(performance.now() - startedAt) };
  }

  // Stage 2+3: Crop + enhance + OCR each detected region
  const regions: RegionOcrResult[] = [];

  for (const hint of hints) {
    if (!hint.found) {
      regions.push({ field: hint.field, found: false, ocrText: null, verified: false, source: 'vlm-guided-ocr' });
      continue;
    }

    try {
      const ocrText = await ocrDetectedRegion(label.buffer, hint, meta.width, meta.height);

      // Verify: did we get recognizable content for this field?
      const verified = verifyFieldOcr(hint.field, ocrText);

      regions.push({
        field: hint.field,
        found: true,
        ocrText: ocrText && ocrText.length > 3 ? ocrText : null,
        verified,
        source: 'vlm-guided-ocr'
      });
    } catch {
      regions.push({ field: hint.field, found: true, ocrText: null, verified: false, source: 'vlm-guided-ocr' });
    }
  }

  return { regions, durationMs: Math.round(performance.now() - startedAt) };
}

async function ocrDetectedRegion(
  imageBuffer: Buffer,
  hint: RegionHint,
  imgWidth: number,
  imgHeight: number
): Promise<string | null> {
  let cropBuf: Buffer;

  if (hint.quadrant.includes('edge-rotated')) {
    // Edge strip: crop, rotate, upscale 4x
    const stripW = Math.floor(imgWidth * 0.18);
    const isRight = hint.quadrant.includes('right');
    const left = isRight ? imgWidth - stripW : 0;
    const cropped = await sharp(imageBuffer, { failOn: 'none' })
      .extract({ left, top: 0, width: stripW, height: imgHeight })
      .toBuffer();
    const rotDeg = isRight ? 90 : 270;
    const rotated = await sharp(cropped).rotate(rotDeg).toBuffer();
    const rMeta = await sharp(rotated).metadata();
    cropBuf = await sharp(rotated)
      .resize({ width: Math.max((rMeta.width || 300) * 4, 2000), kernel: 'lanczos3' })
      .grayscale().normalize().sharpen({ sigma: 1.5 })
      .png().toBuffer();
  } else {
    // Quadrant crop
    const yCenter = (hint.approximateYPercent / 100) * imgHeight;
    const cropH = Math.floor(imgHeight * 0.3);
    const cropTop = Math.max(0, Math.floor(yCenter - cropH / 2));
    const actualH = Math.min(cropH, imgHeight - cropTop);
    const cropLeft = hint.quadrant.includes('right') ? Math.floor(imgWidth * 0.45) : 0;
    const cropW = hint.quadrant.includes('center')
      ? imgWidth
      : Math.min(Math.floor(imgWidth * 0.6), imgWidth - cropLeft);

    cropBuf = await sharp(imageBuffer)
      .extract({ left: cropLeft, top: cropTop, width: cropW, height: actualH })
      .resize({ width: cropW * 3, kernel: 'lanczos3' })
      .grayscale().normalize().sharpen({ sigma: 1.5 })
      .png().toBuffer();
  }

  return await runTesseract(cropBuf);
}

function verifyFieldOcr(field: string, text: string | null): boolean {
  if (!text || text.length < 5) return false;
  switch (field) {
    case 'government_warning':
      return /GOVERNMENT|SURGEON|WARNING/i.test(text);
    case 'alcohol_content':
      return /\d+(\.\d+)?\s*%/i.test(text);
    case 'net_contents':
      return /\d+\s*(mL|FL|OZ|PINT|L\b|cl)/i.test(text);
    case 'brand_name':
      return text.length >= 3;
    default:
      return text.length >= 3;
  }
}

async function runTesseract(buffer: Buffer): Promise<string | null> {
  const tmp = `${tmpdir()}/ttb-region-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
  try {
    writeFileSync(tmp, buffer);
    const { stdout } = await execAsync(
      `tesseract ${tmp} stdout -l eng --psm 6 --oem 1 2>/dev/null`,
      { timeout: 10000, encoding: 'utf-8' }
    );
    return stdout.trim();
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

/**
 * Check if VLM region detection is enabled.
 *
 * Opt-in only. Region detection adds a second VLM call per label, which on
 * the full golden set produced measurably worse accuracy and latency:
 *   - 4+ errors from API rate-limiting (vs 0 without regions)
 *   - 3 more false rejects (vs 0 without regions)
 *   - Avg latency +4.5s per label, max +25s
 * See docs/reference/accuracy-research-2026-04-15.md for the full comparison.
 */
export function isRegionDetectionEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.REGION_DETECTION?.trim().toLowerCase() === 'enabled';
}
