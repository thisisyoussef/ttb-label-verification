import type { NormalizedUploadedLabel } from '../review/review-intake';

/**
 * If the uploaded label is a PDF, convert the first page to a PNG buffer
 * so all downstream extractors receive a standard image.
 *
 * Uses pdf-to-img (pdfjs-dist under the hood) — no native system
 * dependencies, which keeps the deployment story clean for restricted
 * government networks.
 *
 * Rasterization scale:
 * - pdfjs renders at `scale * 72 DPI`. We use scale=4 → ~288 DPI, which
 *   lands close to the 300 DPI standard TTB reviewers expect and gives
 *   Tesseract enough pixel density to read small warning text reliably.
 * - Earlier revisions used scale=2 (≈144 DPI), which silently shrank
 *   300-DPI source scans to ~50% resolution and hurt OCR recall. Labels
 *   converted image → PDF → PNG now round-trip close to their original
 *   pixel density.
 *
 * If the label is already an image, returns it unchanged.
 */
export async function convertPdfLabelToImage(
  label: NormalizedUploadedLabel
): Promise<NormalizedUploadedLabel> {
  if (label.mimeType !== 'application/pdf') {
    return label;
  }

  const { pdf } = await import('pdf-to-img');
  const document = await pdf(label.buffer, { scale: 4 });

  let firstPage: Buffer | null = null;
  for await (const page of document) {
    firstPage = Buffer.from(page);
    break; // only need the first page
  }

  if (!firstPage || firstPage.length === 0) {
    throw new Error('PDF contained no renderable pages.');
  }

  return {
    originalName: label.originalName.replace(/\.pdf$/i, '.png'),
    mimeType: 'image/png',
    bytes: firstPage.length,
    buffer: firstPage
  };
}
