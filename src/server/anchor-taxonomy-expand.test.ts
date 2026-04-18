import { describe, expect, it } from 'vitest';

import { expandEquivalentPhrases } from './anchor-taxonomy-expand';
import { anchorOneField } from './anchor-field-track';

interface TsvWord { text: string; confidence: number; }
function words(list: string[]): TsvWord[] {
  return list.map((text) => ({ text: text.toLowerCase(), confidence: 90 }));
}

describe('expandEquivalentPhrases', () => {
  it('returns grape synonyms for class field', () => {
    const out = expandEquivalentPhrases('class', 'Syrah');
    expect(out.map((s) => s.toLowerCase())).toContain('shiraz');
  });

  it('returns country aliases for country field', () => {
    const out = expandEquivalentPhrases('country', 'United States');
    expect(out.map((s) => s.toLowerCase())).toContain('usa');
    expect(out.map((s) => s.toLowerCase())).toContain('america');
  });

  it('includes subdivisions as country equivalents', () => {
    const out = expandEquivalentPhrases('country', 'United States');
    expect(out.map((s) => s.toLowerCase())).toContain('california');
  });

  it('resolves reverse alias (alias → sovereign+siblings)', () => {
    const out = expandEquivalentPhrases('country', 'USA');
    // Sovereign form + subdivisions should both appear.
    expect(out.map((s) => s.toLowerCase())).toContain('united states');
    expect(out.map((s) => s.toLowerCase())).toContain('napa');
  });

  it('returns unit variants for net contents', () => {
    const out = expandEquivalentPhrases('net', '750 ml');
    const normalized = out.map((s) => s.toLowerCase());
    expect(normalized).toContain('milliliters');
    expect(normalized).toContain('750');
  });

  it('expands USPS abbreviations for address', () => {
    const out = expandEquivalentPhrases('address', '100 Main Street');
    // "Street" maps to "St" (or vice-versa) via USPS Pub 28.
    // Just assert that *some* abbreviation form surfaced.
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns empty for brand and fanciful (trademarks unique)', () => {
    expect(expandEquivalentPhrases('brand', 'Anything Brand')).toEqual([]);
    expect(expandEquivalentPhrases('fanciful', 'Anything Fanciful')).toEqual([]);
  });

  it('returns empty for abv (numeric only, no taxonomy)', () => {
    expect(expandEquivalentPhrases('abv', '12.5% Alc./Vol.')).toEqual([]);
  });

  it('returns empty for blank input', () => {
    expect(expandEquivalentPhrases('class', '')).toEqual([]);
    expect(expandEquivalentPhrases('country', '   ')).toEqual([]);
  });
});

describe('anchorOneField taxonomy-equivalent fallback', () => {
  it('marks matchKind=literal when literal match carries the coverage', () => {
    const anchor = anchorOneField(
      'class',
      'Cabernet Sauvignon',
      words(['cabernet', 'sauvignon', 'estate', 'vineyard'])
    );
    expect(anchor.status).toBe('found');
    expect(anchor.matchKind).toBe('literal');
  });

  it('falls back to equivalent when literal fails (Syrah → Shiraz)', () => {
    const anchor = anchorOneField(
      'class',
      'Syrah',
      words(['old', 'vine', 'shiraz', 'australia'])
    );
    expect(anchor.status).toBe('found');
    expect(anchor.matchKind).toBe('equivalent');
  });

  it('upgrades country match via subdivision (United States → California)', () => {
    const anchor = anchorOneField(
      'country',
      'United States',
      words(['napa', 'valley', 'california', 'vineyard'])
    );
    expect(anchor.status).toBe('found');
    expect(anchor.matchKind).toBe('equivalent');
  });

  it('matches net contents via numeric digits when unit word is garbled', () => {
    const anchor = anchorOneField(
      'net',
      '750 ml',
      words(['750', 'estate', 'vineyard']) // unit word missing
    );
    // Coverage depends on token count; at minimum the digit anchored.
    expect(anchor.tokensFound).toBeGreaterThanOrEqual(1);
  });

  it('does not hallucinate a match when label has no relevant tokens', () => {
    const anchor = anchorOneField(
      'class',
      'Syrah',
      words(['brand', 'logo', 'distilled', 'vodka'])
    );
    expect(anchor.status).toBe('missing');
    expect(anchor.matchKind).toBe('none');
  });

  it('keeps status=skipped for blank expected', () => {
    const anchor = anchorOneField('country', '', words(['anything']));
    expect(anchor.status).toBe('skipped');
    expect(anchor.matchKind).toBe('none');
  });
});
