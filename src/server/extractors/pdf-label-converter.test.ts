import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pdf } from 'pdf-to-img';

import { convertPdfLabelToImage } from './pdf-label-converter';
import type { NormalizedUploadedLabel } from '../review/review-intake';

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.0\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'
);
const RENDERED_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

vi.mock('pdf-to-img', () => ({
  pdf: vi.fn(async function* () {
    yield RENDERED_PNG;
  })
}));

const pdfMock = vi.mocked(pdf);

describe('convertPdfLabelToImage', () => {
  beforeEach(() => {
    pdfMock.mockClear();
  });

  it('returns image labels unchanged', async () => {
    const label: NormalizedUploadedLabel = {
      originalName: 'test.png',
      mimeType: 'image/png',
      bytes: 100,
      buffer: Buffer.from('fake-png-data')
    };

    const result = await convertPdfLabelToImage(label);
    expect(result).toBe(label); // same reference, not a copy
    expect(pdfMock).not.toHaveBeenCalled();
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
    expect(result.buffer).toEqual(RENDERED_PNG);
    expect(pdfMock).toHaveBeenCalledWith(MINIMAL_PDF, { scale: 4 });
    // PNG magic bytes
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50); // P
    expect(result.buffer[2]).toBe(0x4e); // N
    expect(result.buffer[3]).toBe(0x47); // G
  });
});
