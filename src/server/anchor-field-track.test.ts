import { describe, expect, it } from 'vitest';

import { anchorOneField, tokenizeExpectedValue } from './anchor-field-track';

interface TsvWord { text: string; confidence: number; }

function words(list: string[]): TsvWord[] {
  return list.map((text) => ({ text: text.toLowerCase(), confidence: 90 }));
}

describe('tokenizeExpectedValue', () => {
  it('keeps short numeric tokens like "12", "fl", "oz"', () => {
    expect(tokenizeExpectedValue('12 fl oz')).toEqual(['12', 'fl', 'oz']);
  });

  it('strips stopwords', () => {
    expect(tokenizeExpectedValue('The Wine of Rioja')).toEqual(['wine', 'rioja']);
  });

  it('lowercases and strips punctuation', () => {
    expect(tokenizeExpectedValue('40% Alc./Vol.')).toEqual(['40', 'alc', 'vol']);
  });

  it('handles hyphens and slashes', () => {
    expect(tokenizeExpectedValue('Kentucky-Straight/Bourbon')).toEqual([
      'kentucky', 'straight', 'bourbon'
    ]);
  });

  it('returns empty for blank / stopword-only input', () => {
    expect(tokenizeExpectedValue('')).toEqual([]);
    expect(tokenizeExpectedValue('the')).toEqual([]);
  });
});

describe('anchorOneField', () => {
  it('reports found when every content token is present', () => {
    const r = anchorOneField(
      'brand',
      'Persian Empire',
      words(['persian', 'empire', 'black', 'widow', '40%'])
    );
    expect(r.status).toBe('found');
    expect(r.coverage).toBe(1);
    expect(r.tokensFound).toBe(2);
  });

  it('reports partial when only some tokens are present', () => {
    const r = anchorOneField(
      'class',
      'straight bourbon whisky',
      words(['straight', 'bourbon']) // missing whisky
    );
    expect(r.status).toBe('partial');
    expect(r.coverage).toBeCloseTo(2 / 3, 2);
  });

  it('reports missing when no tokens are present', () => {
    const r = anchorOneField(
      'brand',
      'Leitz',
      words(['weingut', '2023', 'rottland'])
    );
    expect(r.status).toBe('missing');
  });

  it('skips blank expected values (no content to anchor)', () => {
    const r = anchorOneField('net', '', words(['12', 'fl', 'oz']));
    expect(r.status).toBe('skipped');
    expect(r.coverage).toBe(1);
  });

  it('handles "12 fl oz" net contents — short numeric tokens', () => {
    const r = anchorOneField(
      'net',
      '12 fl oz',
      words(['12', 'fl', 'oz', 'brewed', 'by'])
    );
    expect(r.status).toBe('found');
    expect(r.tokens).toEqual(['12', 'fl', 'oz']);
  });

  it('uses substring tolerance when tokens overlap cleanly', () => {
    // "bourbon" is on the label as "KENTUCKY-BOURBON" (OCR grabs
    // the compound as a single token). Substring tolerance catches it.
    const r = anchorOneField(
      'class',
      'bourbon',
      words(['kentucky-bourbon'])
    );
    expect(r.status).toBe('found');
  });
});
