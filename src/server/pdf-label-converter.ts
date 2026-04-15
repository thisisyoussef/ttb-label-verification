import type { NormalizedUploadedLabel } from './review-intake';

/**
 * If the uploaded label is a PDF, convert the first page to a PNG buffer
 * so all downstream extractors receive a standard image.
 *
 * Uses pdf-to-img (pdfjs-dist under the hood) — no native system
 * dependencies, which keeps the deployment story clean for restricted
 * government networks.
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
  const document = await pdf(label.buffer, { scale: 2 });

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
