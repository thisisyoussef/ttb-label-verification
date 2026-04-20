import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { MAX_LABEL_UPLOAD_BYTES } from '../../shared/contracts/review';
import {
  createNormalizedReviewIntake,
  parseOptionalReviewFields,
  type MemoryUploadedLabel
} from './review-intake';

function buildUploadedLabel(
  overrides: Partial<MemoryUploadedLabel> = {}
): MemoryUploadedLabel {
  return {
    fieldname: 'label',
    originalname: 'label.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 8,
    stream: Readable.from([]),
    destination: '',
    filename: '',
    path: '',
    buffer: Buffer.from([1, 2, 3, 4]),
    ...overrides
  };
}

describe('review intake normalization', () => {
  it('accepts omitted fields and marks the request standalone', () => {
    const parsed = parseOptionalReviewFields(undefined);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Expected fields parsing to succeed.');
    }

    expect(parsed.value.hasApplicationData).toBe(false);
    expect(parsed.value.fields.beverageTypeHint).toBe('auto');
    expect(parsed.value.fields.varietals).toEqual([]);
  });

  it('normalizes blank strings to missing values and trims provided values', () => {
    const parsed = parseOptionalReviewFields(
      JSON.stringify({
        beverageType: 'wine',
        brandName: '  Heritage Hill  ',
        fancifulName: '   ',
        classType: ' Red Wine ',
        alcoholContent: '',
        netContents: ' 750 mL ',
        applicantAddress: '',
        origin: 'imported',
        country: ' France ',
        formulaId: '',
        appellation: ' Napa Valley ',
        vintage: ' 2021 ',
        varietals: [
          { name: ' Cabernet Sauvignon ', percentage: ' 75 ' },
          { name: ' ', percentage: ' ' }
        ]
      })
    );

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Expected fields parsing to succeed.');
    }

    expect(parsed.value.hasApplicationData).toBe(true);
    expect(parsed.value.fields.brandName).toBe('Heritage Hill');
    expect(parsed.value.fields.fancifulName).toBeUndefined();
    expect(parsed.value.fields.country).toBe('France');
    expect(parsed.value.fields.varietals).toEqual([
      { name: 'Cabernet Sauvignon', percentage: '75' }
    ]);
  });

  it('returns a bounded normalized request shape without filesystem paths', () => {
    const parsed = parseOptionalReviewFields(undefined);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Expected fields parsing to succeed.');
    }

    const request = createNormalizedReviewIntake({
      file: buildUploadedLabel({
        size: MAX_LABEL_UPLOAD_BYTES
      }),
      fields: parsed.value
    });

    expect(request.label.originalName).toBe('label.png');
    expect(request.label.bytes).toBe(MAX_LABEL_UPLOAD_BYTES);
    expect(request.label.mimeType).toBe('image/png');
    expect(request.label).not.toHaveProperty('path');
    expect(request.labels).toHaveLength(1);
    expect(request.labels[0]?.originalName).toBe('label.png');
    expect(request.standalone).toBe(true);
  });

  it('keeps an optional second uploaded image while preserving the primary label alias', () => {
    const parsed = parseOptionalReviewFields(undefined);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Expected fields parsing to succeed.');
    }

    const request = createNormalizedReviewIntake({
      files: [
        buildUploadedLabel({
          originalname: 'front.png',
          buffer: Buffer.from([1, 2, 3, 4])
        }),
        buildUploadedLabel({
          originalname: 'back.png',
          buffer: Buffer.from([5, 6, 7, 8])
        })
      ],
      fields: parsed.value
    });

    expect(request.label.originalName).toBe('front.png');
    expect(request.labels).toHaveLength(2);
    expect(request.labels[1]?.originalName).toBe('back.png');
  });

  it('rejects malformed JSON before normalization', () => {
    const parsed = parseOptionalReviewFields('{not-valid-json');

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error('Expected fields parsing to fail.');
    }

    expect(parsed.error.kind).toBe('validation');
    expect(parsed.error.message).toContain('application fields');
  });

  it('does not treat the beverage type hint by itself as application data', () => {
    const parsed = parseOptionalReviewFields(
      JSON.stringify({
        beverageType: 'wine',
        brandName: '',
        fancifulName: '',
        classType: '',
        alcoholContent: '',
        netContents: '',
        applicantAddress: '',
        origin: 'domestic',
        country: '',
        formulaId: '',
        appellation: '',
        vintage: '',
        varietals: []
      })
    );

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Expected fields parsing to succeed.');
    }

    expect(parsed.value.fields.beverageTypeHint).toBe('wine');
    expect(parsed.value.hasApplicationData).toBe(false);
  });

  it('rejects non-string field payloads before parsing', () => {
    const parsed = parseOptionalReviewFields({ beverageType: 'wine' });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error('Expected fields parsing to fail.');
    }

    expect(parsed.error.kind).toBe('validation');
    expect(parsed.error.retryable).toBe(false);
  });
});
