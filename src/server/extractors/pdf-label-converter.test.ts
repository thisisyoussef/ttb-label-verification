import { describe, expect, it } from 'vitest';

import { convertPdfLabelToImage } from './pdf-label-converter';
import type { NormalizedUploadedLabel } from '../review/review-intake';

// Minimal valid single-page PDF that renders a blank page.
// Hand-written to avoid depending on ImageMagick or any system tool in CI.
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 72 72]/Parent 2 0 R>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n' +
    '0000000058 00000 n \n0000000115 00000 n \n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
);

describe('convertPdfLabelToImage', () => {
  it('returns image labels unchanged', async () => {
    const label: NormalizedUploadedLabel = {
      originalName: 'test.png',
      mimeType: 'image/png',
      bytes: 100,
      buffer: Buffer.from('fake-png-data')
    };

    const result = await convertPdfLabelToImage(label);
    expect(result).toBe(label); // same reference, not a copy
  });

  it('converts a PDF label to a PNG buffer', async () => {
    const label: NormalizedUploadedLabel = {
      originalName: 'label.pdf',
      mimeType: 'application/pdf',
      bytes: MINIMAL_PDF.length,
      buffer: MINIMAL_PDF
    };

    const result = await convertPdfLabelToImage(label);

    expect(result.mimeType).toBe('image/png');
    expect(result.originalName).toBe('label.png');
    expect(result.buffer.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50); // P
    expect(result.buffer[2]).toBe(0x4e); // N
    expect(result.buffer[3]).toBe(0x47); // G
  });
});
