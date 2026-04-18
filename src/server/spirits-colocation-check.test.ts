import { describe, expect, it } from 'vitest';

import {
  checkSpiritsColocation,
  parseColocationResponse
} from './spirits-colocation-check';
import type { NormalizedUploadedLabel } from './review-intake';

const FAKE_LABEL: NormalizedUploadedLabel = {
  originalName: 'fake.png',
  mimeType: 'image/png',
  bytes: 4,
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47])
};

describe('parseColocationResponse', () => {
  it('parses a clean colocated response', () => {
    const result = parseColocationResponse(
      JSON.stringify({
        colocated: true,
        primaryPanelDescription: 'large dark front panel with brand logo',
        missingFromPrimary: [],
        confidence: 0.92,
        reason: 'All three pieces are visible together on the front panel.'
      })
    );

    expect(result).toEqual({
      colocated: true,
      primaryPanelDescription: 'large dark front panel with brand logo',
      missingFromPrimary: [],
      confidence: 0.92,
      reason: 'All three pieces are visible together on the front panel.'
    });
  });

  it('parses a non-colocated response with missing pieces', () => {
    const result = parseColocationResponse(
      JSON.stringify({
        colocated: false,
        primaryPanelDescription: 'front panel with brand and class',
        missingFromPrimary: ['alcohol-content'],
        confidence: 0.85,
        reason: 'Alcohol content statement appears only on the back panel.'
      })
    );

    expect(result?.colocated).toBe(false);
    expect(result?.missingFromPrimary).toEqual(['alcohol-content']);
  });

  it('overrides colocated=true to false when missing list is non-empty', () => {
    // Sometimes the model self-contradicts. The missing list is the
    // more concrete signal so we trust it over the boolean.
    const result = parseColocationResponse(
      JSON.stringify({
        colocated: true,
        primaryPanelDescription: 'front',
        missingFromPrimary: ['class-type'],
        confidence: 0.7,
        reason: ''
      })
    );

    expect(result?.colocated).toBe(false);
  });

  it('strips Markdown code fences the model occasionally emits', () => {
    const result = parseColocationResponse(
      '```json\n{"colocated":true,"primaryPanelDescription":"front","missingFromPrimary":[],"confidence":0.9,"reason":""}\n```'
    );
    expect(result?.colocated).toBe(true);
  });

  it('filters out unknown identifiers in the missing list', () => {
    const result = parseColocationResponse(
      JSON.stringify({
        colocated: false,
        primaryPanelDescription: '',
        missingFromPrimary: ['alcohol-content', 'spam', 'class-type'],
        confidence: 0.6,
        reason: ''
      })
    );
    expect(result?.missingFromPrimary).toEqual([
      'alcohol-content',
      'class-type'
    ]);
  });

  it('returns null on malformed JSON', () => {
    expect(parseColocationResponse('not json')).toBeNull();
  });

  it('returns null when the colocated field is missing', () => {
    expect(
      parseColocationResponse(
        JSON.stringify({ primaryPanelDescription: 'front' })
      )
    ).toBeNull();
  });
});

describe('checkSpiritsColocation', () => {
  it('returns the parsed result from the injected VLM caller', async () => {
    const result = await checkSpiritsColocation(FAKE_LABEL, {
      callVlm: async () =>
        JSON.stringify({
          colocated: true,
          primaryPanelDescription: 'front',
          missingFromPrimary: [],
          confidence: 0.9,
          reason: 'all visible'
        })
    });
    expect(result?.colocated).toBe(true);
    expect(result?.confidence).toBe(0.9);
  });

  it('returns null silently when the VLM call throws', async () => {
    const result = await checkSpiritsColocation(FAKE_LABEL, {
      callVlm: async () => {
        throw new Error('rate limited');
      }
    });
    expect(result).toBeNull();
  });
});
