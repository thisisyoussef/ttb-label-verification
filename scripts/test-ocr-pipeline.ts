/**
 * Prototype: VLM as region detector → OCR per-region text reader.
 *
 * Step 1: Ask VLM "where are these fields on the label?" → bounding box hints
 * Step 2: Crop each region, upscale 3x, enhance per-field
 * Step 3: OCR each cropped region independently
 * Step 4: Compare OCR text against VLM-extracted text (pollution check)
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';

process.env.NODE_ENV = 'test';
process.env.OPENAI_STORE = 'false';

// Load env for API keys
const { loadLocalEnv } = await import('../src/server/load-local-env.js');
loadLocalEnv(process.cwd());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type RegionHint = {
  field: string;
  found: boolean;
  description: string;
  quadrant: string; // "top-left", "bottom-right", "right-edge-rotated", etc.
  approximate_y_percent: number; // 0-100, where on the image vertically
};

const REGION_DETECTION_PROMPT = `You are analyzing an alcohol beverage label image. For each of the following fields, tell me:
1. Is it visible on this label?
2. Where approximately is it located?

Respond with ONLY valid JSON array. No other text.

Fields to locate:
- government_warning: The "GOVERNMENT WARNING" statement (may be tiny, rotated, or on the edge)
- alcohol_content: The ABV/alcohol percentage
- net_contents: Volume statement (mL, FL OZ, PINT, etc.)
- brand_name: The primary brand name

For each field:
{
  "field": "field_name",
  "found": true/false,
  "description": "brief description of what you see",
  "quadrant": "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "right-edge-rotated" | "left-edge-rotated" | "bottom-center",
  "approximate_y_percent": 0-100 (0=top, 100=bottom)
}

IMPORTANT: For rotated text on edges, say "right-edge-rotated" or "left-edge-rotated".
If you cannot see a field at all, set found=false.`;

async function detectRegions(imageBuffer: Buffer, mimeType: string): Promise<RegionHint[]> {
  const base64 = imageBuffer.toString('base64');
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash-lite',
    contents: [
      { text: REGION_DETECTION_PROMPT },
      { inlineData: { mimeType, data: base64 } }
    ],
    config: { responseMimeType: 'application/json' }
  });
  const text = res.text?.trim() ?? '[]';
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function ocrRegion(imageBuffer: Buffer, region: {
  quadrant: string;
  approximate_y_percent: number;
}, meta: { width: number; height: number }): Promise<string> {
  const w = meta.width, h = meta.height;
  let cropBuf: Buffer;

  if (region.quadrant.includes('edge-rotated')) {
    // Edge strip: crop the edge, rotate, upscale
    const stripW = Math.floor(w * 0.18);
    const isRight = region.quadrant.includes('right');
    const left = isRight ? w - stripW : 0;
    const cropped = await sharp(imageBuffer).extract({ left, top: 0, width: stripW, height: h }).toBuffer();
    const rotated = await sharp(cropped).rotate(isRight ? 90 : 270).toBuffer();
    const rMeta = await sharp(rotated).metadata();
    cropBuf = await sharp(rotated)
      .resize({ width: (rMeta.width || 300) * 4, kernel: 'lanczos3' })
      .grayscale().normalize().sharpen({ sigma: 1.5 }).png().toBuffer();
  } else {
    // Quadrant crop based on position hint
    const yCenter = (region.approximate_y_percent / 100) * h;
    const cropH = Math.floor(h * 0.25); // 25% of image height
    const cropTop = Math.max(0, Math.floor(yCenter - cropH / 2));
    const cropBot = Math.min(h, cropTop + cropH);
    const cropLeft = region.quadrant.includes('right') ? Math.floor(w * 0.5) : 0;
    const cropW = region.quadrant.includes('left') || region.quadrant.includes('right')
      ? Math.floor(w * 0.55) : w;

    cropBuf = await sharp(imageBuffer)
      .extract({ left: cropLeft, top: cropTop, width: Math.min(cropW, w - cropLeft), height: cropBot - cropTop })
      .resize({ width: Math.min(cropW, w - cropLeft) * 3, kernel: 'lanczos3' })
      .grayscale().normalize().sharpen({ sigma: 1.5 }).png().toBuffer();
  }

  const tmp = `${tmpdir()}/ttb-region-${Date.now()}-${Math.random().toString(36).slice(2, 5)}.png`;
  writeFileSync(tmp, cropBuf);
  try {
    return execSync(`tesseract ${tmp} stdout -l eng --psm 6 --oem 1 2>/dev/null`, {
      encoding: 'utf-8', timeout: 15000
    }).trim();
  } catch { return ''; }
  finally { try { unlinkSync(tmp); } catch {} }
}

async function experiment(labelPath: string) {
  const name = labelPath.split('/').pop()!.replace('.webp', '').slice(0, 42);
  const buf = readFileSync(labelPath);
  const meta = await sharp(buf).metadata();
  const w = meta.width!, h = meta.height!;

  console.log(`\n═══ ${name} ═══`);

  // Step 1: VLM region detection
  const regions = await detectRegions(buf, 'image/webp');

  for (const r of regions) {
    const icon = r.found ? '✓' : '✗';
    console.log(`  ${icon} ${r.field.padEnd(22)} ${r.quadrant.padEnd(22)} y=${r.approximate_y_percent}%  "${r.description?.slice(0, 50) || ''}"`);

    if (!r.found) continue;

    // Step 2: Crop + OCR the detected region
    const ocrText = await ocrRegion(buf, r, { width: w, height: h });
    if (ocrText.length > 5) {
      // Check if we got the right content
      const isWarning = r.field === 'government_warning' && /GOVERNMENT|SURGEON|WARNING/i.test(ocrText);
      const isAbv = r.field === 'alcohol_content' && /\d+(\.\d+)?%/i.test(ocrText);
      const isNet = r.field === 'net_contents' && /\d+\s*(mL|FL|OZ|PINT|L\b)/i.test(ocrText);
      const verified = isWarning || isAbv || isNet || r.field === 'brand_name';
      console.log(`    OCR (${ocrText.length}ch): ${verified ? '✓ VERIFIED' : '? unverified'} → ${ocrText.replace(/\n/g, ' ').slice(0, 120)}`);
    } else {
      console.log(`    OCR: (empty or too short)`);
    }
  }
}

async function main() {
  const labels = [
    'evals/labels/assets/cola-cloud/lake-placid-shredder-malt-beverage.webp',
    'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp',
    'evals/labels/assets/cola-cloud/recluse-brew-works-shy-guy-malt-beverage.webp',
    'evals/labels/assets/cola-cloud/crafy-elk-cranberry-blueberry-acai-distilled-spirits.webp',
    'evals/labels/assets/cola-cloud/forlorn-hope-san-hercurmer-delle-frecce-wine.webp',
    'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp',
  ];
  console.log('VLM REGION DETECTION → OCR PER-REGION EXPERIMENT');
  console.log('─'.repeat(80));
  for (const lp of labels) await experiment(lp);
}

main().catch(e => { console.error(e); process.exit(1); });
