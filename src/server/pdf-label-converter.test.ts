import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it, beforeAll } from 'vitest';

import { convertPdfLabelToImage } from './pdf-label-converter';
import type { NormalizedUploadedLabel } from './review-intake';

const PROBE_PDF_PATH = '/tmp/ttb-pdf-probe.pdf';
const SOURCE_PNG_PATH = 'evals/labels/assets/perfect-spirit-label.png';

describe('convertPdfLabelToImage', () => {
  beforeAll(() => {
    if (!existsSync(SOURCE_PNG_PATH)) {
      return;
    }
    execSync(`magick ${SOURCE_PNG_PATH} ${PROBE_PDF_PATH}`);
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
  });

  it('converts a PDF label to a PNG buffer', async () => {
    if (!existsSync(PROBE_PDF_PATH)) {
      return; // skip if magick not available
    }

    const pdfBuffer = readFileSync(PROBE_PDF_PATH);
    const label: NormalizedUploadedLabel = {
      originalName: 'label.pdf',
      mimeType: 'application/pdf',
      bytes: pdfBuffer.length,
      buffer: pdfBuffer
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
