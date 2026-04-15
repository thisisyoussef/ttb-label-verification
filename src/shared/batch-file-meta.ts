import {
  MAX_LABEL_UPLOAD_BYTES,
  SUPPORTED_LABEL_MIME_TYPES,
  type BatchFileError,
  type BatchFileErrorReason
} from './contracts/review';

export const SUPPORTED_LABEL_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf'
] as const;

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  }

  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function hasSupportedLabelFileType(input: {
  filename: string;
  mimeType: string;
}) {
  return (
    SUPPORTED_LABEL_MIME_TYPES.includes(
      input.mimeType as (typeof SUPPORTED_LABEL_MIME_TYPES)[number]
    ) ||
    SUPPORTED_LABEL_EXTENSIONS.some((ext) =>
      input.filename.toLowerCase().endsWith(ext)
    )
  );
}

export function normalizeFilenameForComparison(value: string) {
  const trimmed = value.trim().replace(/\\/g, '/');
  const basename = (
    trimmed.includes('/') ? trimmed.split('/').at(-1) ?? trimmed : trimmed
  ).trim();
  const lower = basename.toLowerCase();
  const dotIndex = lower.lastIndexOf('.');
  const withoutExtension = dotIndex <= 0 ? lower : lower.slice(0, dotIndex);

  return withoutExtension.trim();
}

export function buildBatchFileError(input: {
  filename: string;
  reason: BatchFileErrorReason;
}): BatchFileError {
  switch (input.reason) {
    case 'unsupported-type':
      return {
        filename: input.filename,
        reason: input.reason,
        message: `${input.filename} isn't a supported image type.`
      };
    case 'oversized':
      return {
        filename: input.filename,
        reason: input.reason,
        message: `${input.filename} is larger than ${formatFileSize(
          MAX_LABEL_UPLOAD_BYTES
        )}.`
      };
    case 'duplicate':
      return {
        filename: input.filename,
        reason: input.reason,
        message: `${input.filename} matches an image already in this batch.`
      };
    case 'over-cap':
      return {
        filename: input.filename,
        reason: input.reason,
        message:
          'The batch limit is 50 labels. Remove some to continue.'
      };
  }
}
