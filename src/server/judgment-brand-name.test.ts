import { describe, expect, it } from 'vitest';

import { judgeBrandName } from './judgment-field-rules';
import { stripBrandDecorativePunctuation } from './judgment-normalizers';

describe('stripBrandDecorativePunctuation', () => {
  it('strips periods between initials', () => {
    expect(stripBrandDecorativePunctuation("A.C.'s")).toBe("AC's");
    expect(stripBrandDecorativePunctuation('J. & B.')).toBe('J & B');
  });

  it('strips trailing periods after honorifics', () => {
    expect(stripBrandDecorativePunctuation('Dr. McGillicuddy')).toBe(
      'Dr McGillicuddy'
    );
  });

  it('strips decorative hyphens, slashes, parens', () => {
    expect(stripBrandDecorativePunctuation('Half-Acre')).toBe('HalfAcre');
    expect(stripBrandDecorativePunctuation('AB/C')).toBe('ABC');
    expect(stripBrandDecorativePunctuation('Brand (Co.)')).toBe('Brand Co');
  });

  it('preserves apostrophes so possessive differences still surface', () => {
    expect(stripBrandDecorativePunctuation("Stone's Throw")).toBe(
      "Stone's Throw"
    );
  });

  it('preserves ampersands so &-only differences still surface', () => {
    expect(stripBrandDecorativePunctuation('J & B')).toBe('J & B');
  });

  it('preserves whitespace so the space-collapsed rule still surfaces', () => {
    expect(stripBrandDecorativePunctuation('Stone Wood')).toBe('Stone Wood');
  });
});

describe('judgeBrandName — punctuation-only matches', () => {
  it("approves 'A.C.\u2019s' vs 'Ac\u2019s' as a punctuation-and-case difference", () => {
    const result = judgeBrandName("Ac's", "A.C.'s");
    expect(result.disposition).toBe('approve');
    expect(['brand-punctuation-only', 'brand-punctuation-and-case']).toContain(
      result.rule
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('approves "Dr. McGillicuddy" vs "Dr McGillicuddy" via punctuation-only', () => {
    const result = judgeBrandName('Dr McGillicuddy', 'Dr. McGillicuddy');
    expect(result.disposition).toBe('approve');
    expect(result.rule).toBe('brand-punctuation-only');
  });

  it('approves "Half-Acre" vs "Half Acre" via either punctuation-only or a downstream rule', () => {
    // The hyphen strips to "HalfAcre" which doesn't equal "Half Acre"
    // exactly (the space between the words remains), so the
    // punctuation rule alone doesn't catch it — the downstream
    // space-collapsed/fuzzy rules pick it up. Either way it must
    // approve.
    const result = judgeBrandName('Half Acre', 'Half-Acre');
    expect(result.disposition).toBe('approve');
  });

  it('still surfaces a possessive-only difference (apostrophe preserved)', () => {
    // "Stone's Throw" vs "Stones Throw" should NOT be caught by the
    // new punctuation rule — the apostrophe is preserved so the
    // existing fuzzy rule handles it (typically as approve via
    // fuzzy-close on a 1-char edit, but it should not match the
    // punctuation-only rule).
    const result = judgeBrandName("Stone's Throw", 'Stones Throw');
    expect(result.disposition).toBe('approve');
    expect(['brand-punctuation-only', 'brand-punctuation-and-case']).not.toContain(
      result.rule
    );
  });

  it('does not over-approve when the brand identity actually differs', () => {
    const result = judgeBrandName('Mill River Cider', 'Stone Creek Bourbon');
    expect(result.disposition).not.toBe('approve');
  });
});
