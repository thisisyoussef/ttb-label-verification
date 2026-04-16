import sharp from 'sharp';

import type { NormalizedUploadedLabel } from './review-intake';

const UPSCALE_WIDTH_THRESHOLD = 1500;
const SHARPEN_SIGMA = 1.2;
const BINARIZATION_THRESHOLD = 128;

export type PreprocessedImage = {
  buffer: Buffer;
  mimeType: 'image/png';
  preprocessingApplied: string[];
  durationMs: number;
};

/**
 * Prepare a label image for Tesseract OCR.
 *
 * Pipeline: upscale (if small) → grayscale → normalize → sharpen → threshold → PNG
 *
 * Applied ONLY to the buffer sent to Tesseract. The original image still
 * goes to the VLM for visual signals (bold, layout, color).
 *
 * Runs in ~50-200ms for typical label images.
 */
export async function preprocessImageForOcr(
  label: NormalizedUploadedLabel
): Promise<PreprocessedImage> {
  const startedAt = performance.now();
  const applied: string[] = [];

  try {
    let pipeline = sharp(label.buffer);
    const metadata = await pipeline.metadata();

    // Upscale small images — biggest single win for small-text readability.
    // Research: minimum 300 DPI for text above 8pt; 400-600 DPI for smaller.
    if (metadata.width && metadata.width < UPSCALE_WIDTH_THRESHOLD) {
      pipeline = pipeline.resize({
        width: metadata.width * 2,
        kernel: 'lanczos3'
      });
      applied.push('upscale-2x');
    }

    // Grayscale — removes color noise that confuses OCR.
    pipeline = pipeline.grayscale();
    applied.push('grayscale');

    // Normalize — CLAHE-like histogram stretch, recovers washed-out text.
    pipeline = pipeline.normalize();
    applied.push('normalize');

    // Sharpen — recovers soft edges on small text.
    pipeline = pipeline.sharpen({ sigma: SHARPEN_SIGMA });
    applied.push('sharpen');

    // NOTE: Global threshold binarization (.threshold(128)) was tested and
    // found to DESTROY text on alcohol label images with complex backgrounds.
    // Grayscale + normalize + sharpen gives significantly better OCR than
    // adding binarization. Skipping threshold until adaptive binarization
    // (Sauvola) is available.

    const buffer = await pipeline.png().toBuffer();
    applied.push('png-export');

    return {
      buffer,
      mimeType: 'image/png',
      preprocessingApplied: applied,
      durationMs: Math.round(performance.now() - startedAt)
    };
  } catch {
    // Graceful degradation: return original buffer unchanged.
    return {
      buffer: label.buffer,
      mimeType: 'image/png',
      preprocessingApplied: ['none-sharp-error'],
      durationMs: Math.round(performance.now() - startedAt)
    };
  }
}
