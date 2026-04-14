import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  buildBatchFileError,
  formatFileSize,
  hasSupportedLabelFileType,
  normalizeFilenameForComparison
} from './batch-file-meta';

describe('batch file metadata helpers', () => {
  it('normalizes filenames to a lowercase basename without the extension', () => {
    expect(
      normalizeFilenameForComparison('C:\\Uploads\\Nested Folder\\LABEL.Final.PDF')
    ).toBe('label.final');
    expect(normalizeFilenameForComparison('/tmp/review/stone-front.JPG')).toBe(
      'stone-front'
    );
  });

  it('normalizes comparison keys to a trimmed lowercase basename', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeFilenameForComparison(value);
        expect(normalized).toBe(normalized.trim());
        expect(normalized).toBe(normalized.toLowerCase());
        expect(normalized).not.toContain('/');
        expect(normalized).not.toContain('\\');
      })
    );
  });

  it('accepts supported extensions when mime type detection is missing', () => {
    expect(
      hasSupportedLabelFileType({
        filename: 'review-label.PDF',
        mimeType: ''
      })
    ).toBe(true);
    expect(
      hasSupportedLabelFileType({
        filename: 'review-label.txt',
        mimeType: 'text/plain'
      })
    ).toBe(false);
  });

  it('formats batch file errors with the configured upload cap', () => {
    expect(formatFileSize(512)).toBe('1 KB');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(
      buildBatchFileError({
        filename: 'oversized-label.png',
        reason: 'oversized'
      }).message
    ).toContain('10.0 MB');
  });
});
