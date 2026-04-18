/**
 * Guardrail: reject URL/web-address values from the
 * applicantAddress field.
 *
 * Background: the VLM sometimes returns a marketing URL (e.g.
 * "www.harpoonbrewery.com") as applicantAddress because a web URL
 * is semantically an "address" too. Downstream judgment then flags
 * a mismatch vs the actual postal address and the reviewer sees a
 * useless false-negative. The guard downgrades such values to
 * `present=false` before the report is shaped.
 */
import { describe, expect, it } from 'vitest';

import {
  applyReviewExtractorGuardrails,
  isUrlOnlyAddress
} from './review-extractor-guardrails';
import { reviewExtractionModelOutputSchema } from './review-extraction-model-output';

function buildOutput(addressValue: string | null = null) {
  const base = reviewExtractionModelOutputSchema.parse({
    beverageTypeHint: 'unknown',
    imageQuality: { score: 0.9, issues: [], noTextDetected: false, note: null },
    warningSignals: {
      prefixAllCaps: { status: 'yes', confidence: 0.9, note: null },
      prefixBold: { status: 'yes', confidence: 0.9, note: null },
      continuousParagraph: { status: 'yes', confidence: 0.9, note: null },
      separateFromOtherContent: { status: 'yes', confidence: 0.9, note: null }
    },
    fields: {
      brandName: { present: false, value: null, confidence: 0.1, note: null },
      fancifulName: { present: false, value: null, confidence: 0.1, note: null },
      classType: { present: false, value: null, confidence: 0.1, note: null },
      alcoholContent: { present: false, value: null, confidence: 0.1, note: null },
      netContents: { present: false, value: null, confidence: 0.1, note: null },
      applicantAddress: addressValue
        ? { present: true, value: addressValue, confidence: 0.9, note: null }
        : { present: false, value: null, confidence: 0.1, note: null },
      countryOfOrigin: { present: false, value: null, confidence: 0.1, note: null },
      ageStatement: { present: false, value: null, confidence: 0.1, note: null },
      sulfiteDeclaration: { present: false, value: null, confidence: 0.1, note: null },
      appellation: { present: false, value: null, confidence: 0.1, note: null },
      vintage: { present: false, value: null, confidence: 0.1, note: null },
      governmentWarning: { present: false, value: null, confidence: 0.1, note: null },
      varietals: []
    },
    summary: 'test'
  });
  return base;
}

describe('isUrlOnlyAddress', () => {
  it('rejects obvious URLs with schemes', () => {
    expect(isUrlOnlyAddress('http://harpoonbrewery.com')).toBe(true);
    expect(isUrlOnlyAddress('https://www.example.com/drink')).toBe(true);
    expect(isUrlOnlyAddress('ftp://example.com')).toBe(true);
  });

  it('rejects www.* domain-only values', () => {
    expect(isUrlOnlyAddress('www.harpoonbrewery.com')).toBe(true);
    expect(isUrlOnlyAddress('www.example.co.uk')).toBe(true);
  });

  it('rejects bare-domain values without a space', () => {
    expect(isUrlOnlyAddress('harpoonbrewery.com')).toBe(true);
    expect(isUrlOnlyAddress('my-brewery.beer')).toBe(true);
  });

  it('rejects social handles and email addresses', () => {
    expect(isUrlOnlyAddress('@harpoonbrewery')).toBe(true);
    expect(isUrlOnlyAddress('#ipa')).toBe(true);
    expect(isUrlOnlyAddress('contact@example.com')).toBe(true);
  });

  it('PRESERVES real postal addresses even with a trailing URL', () => {
    // A postal address co-located with a marketing URL is valuable —
    // the address-comparison layer tokenizes and matches the postal
    // parts. We must NOT discard these.
    expect(
      isUrlOnlyAddress('306 Northern Ave, Boston, MA 02210 · www.harpoonbrewery.com')
    ).toBe(false);
    expect(isUrlOnlyAddress('100 Main St, Anytown, VA 22314')).toBe(false);
    expect(isUrlOnlyAddress('Bottled by Harpoon Brewery, Boston, MA')).toBe(false);
  });

  it('preserves empty-ish values (handled by present=false upstream)', () => {
    expect(isUrlOnlyAddress('')).toBe(false);
    expect(isUrlOnlyAddress('   ')).toBe(false);
  });

  it('preserves plain business names (no TLD, no scheme)', () => {
    expect(isUrlOnlyAddress('Harpoon Brewery')).toBe(false);
    expect(isUrlOnlyAddress('Acme Co.')).toBe(false);
  });
});

describe('applyReviewExtractorGuardrails — applicant-address URL scrub', () => {
  it('downgrades a URL-only applicantAddress to present=false', () => {
    const output = buildOutput('www.harpoonbrewery.com');
    const result = applyReviewExtractorGuardrails({
      surface: '/api/review',
      extractionMode: 'cloud',
      output
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.fields.applicantAddress.present).toBe(false);
    expect(result.value.fields.applicantAddress.value).toBeNull();
    // Evidence note lets the reviewer understand why the field went
    // absent — plain-language, no engine jargon.
    expect(result.value.fields.applicantAddress.note?.toLowerCase()).toContain(
      'url'
    );
  });

  it('passes through a real postal address unchanged', () => {
    const output = buildOutput('306 Northern Ave, Boston, MA 02210');
    const result = applyReviewExtractorGuardrails({
      surface: '/api/review',
      extractionMode: 'cloud',
      output
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.fields.applicantAddress.present).toBe(true);
    expect(result.value.fields.applicantAddress.value).toBe('306 Northern Ave, Boston, MA 02210');
  });

  it('passes through an address that happens to include a trailing URL', () => {
    const value = 'Bottled by Harpoon Brewery, 306 Northern Ave, Boston, MA 02210 · www.harpoonbrewery.com';
    const output = buildOutput(value);
    const result = applyReviewExtractorGuardrails({
      surface: '/api/review',
      extractionMode: 'cloud',
      output
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.fields.applicantAddress.present).toBe(true);
    expect(result.value.fields.applicantAddress.value).toBe(value);
  });
});
