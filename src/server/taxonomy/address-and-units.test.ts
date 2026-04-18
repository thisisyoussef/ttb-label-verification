import { describe, expect, it } from 'vitest';

import {
  addressTokenOverlap,
  normalizeAddress
} from './address-abbreviations';
import {
  isVolumeEquivalent,
  parseVolume,
  resolvesToSameStandardBottle,
  snapToStandardBottleSize,
  toMilliliters
} from './net-contents-units';

describe('USPS Pub 28 address abbreviations', () => {
  it('expands common street suffixes', () => {
    const a = normalizeAddress('100 Main St');
    const b = normalizeAddress('100 Main Street');
    expect(a).toBe(b);
  });

  it('expands directionals', () => {
    const a = normalizeAddress('500 N Broadway');
    const b = normalizeAddress('500 North Broadway');
    expect(a).toBe(b);
  });

  it('expands business suffixes (Bros, Corp, Inc)', () => {
    const a = normalizeAddress('Acme Bros Inc');
    const b = normalizeAddress('Acme Brothers Incorporated');
    expect(a).toBe(b);
  });

  it('expands unit designators (Ste, Apt, Bldg)', () => {
    const a = normalizeAddress('200 Market St Ste 300');
    const b = normalizeAddress('200 Market Street Suite 300');
    expect(a).toBe(b);
  });

  it('resolves ampersand to "and"', () => {
    const a = normalizeAddress('Smith & Sons');
    const b = normalizeAddress('Smith and Sons');
    expect(a).toBe(b);
  });

  it('token overlap returns 1.0 for fully-equivalent addresses', () => {
    const ratio = addressTokenOverlap(
      '100 Main St, Brooklyn NY',
      '100 Main Street, Brooklyn NY'
    );
    expect(ratio).toBe(1);
  });

  it('token overlap returns a fractional score for partial matches', () => {
    const ratio = addressTokenOverlap(
      '100 Main St, Brooklyn, NY',
      '200 Market Ave, Brooklyn, NY'
    );
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });

  it('strips commas/periods and yields high token overlap', () => {
    // "P.O." + "PO" tokenize slightly differently (dots split "P O")
    // but addressTokenOverlap is the signal downstream logic uses.
    const ratio = addressTokenOverlap(
      'P.O. Box 123, Portland, OR',
      'PO Box 123 Portland OR'
    );
    expect(ratio).toBeGreaterThanOrEqual(0.6);
  });
});

describe('net-contents unit conversion', () => {
  it('parses common volume strings', () => {
    expect(parseVolume('750 mL')).toEqual({ amount: 750, unit: 'ml' });
    expect(parseVolume('25.4 fl oz')).toEqual({ amount: 25.4, unit: 'fl oz' });
    expect(parseVolume('1.75 L')).toEqual({ amount: 1.75, unit: 'l' });
    expect(parseVolume('375 mL')).toEqual({ amount: 375, unit: 'ml' });
    expect(parseVolume('12 FL OZ')).toEqual({ amount: 12, unit: 'fl oz' });
  });

  it('converts fl oz to mL at the exact regulatory factor', () => {
    // 1 US fl oz = 29.5735 mL per 27 CFR / NIST
    expect(toMilliliters(25.4, 'fl oz')).toBeCloseTo(751.17, 1);
    expect(toMilliliters(12, 'fl oz')).toBeCloseTo(354.88, 1);
  });

  it('handles L and cL', () => {
    expect(toMilliliters(1, 'l')).toBe(1000);
    expect(toMilliliters(1.75, 'l')).toBe(1750);
    expect(toMilliliters(75, 'cl')).toBe(750);
  });

  it('isVolumeEquivalent tolerates unit + rounding differences', () => {
    expect(isVolumeEquivalent('750 mL', '25.4 fl oz')).toBe(true);
    expect(isVolumeEquivalent('750 mL', '750 mL')).toBe(true);
    expect(isVolumeEquivalent('1 L', '1000 mL')).toBe(true);
    expect(isVolumeEquivalent('1.75 L', '1750 mL')).toBe(true);
    // Not equivalent:
    expect(isVolumeEquivalent('750 mL', '500 mL')).toBe(false);
    expect(isVolumeEquivalent('12 fl oz', '750 mL')).toBe(false);
  });

  it('snaps to TTB standard bottle sizes within tolerance', () => {
    expect(snapToStandardBottleSize(749)).toBe(750);
    expect(snapToStandardBottleSize(751)).toBe(750);
    // 355 mL is not a TTB-standard wine/spirits size (standards are
    // 50/100/187/200/375/500/750/1000/1500/1750/3000). 355 mL is
    // ~20 mL from the nearest standard (375), outside the default
    // tolerance → returns input unchanged.
    expect(snapToStandardBottleSize(355)).toBe(355);
  });

  it('resolvesToSameStandardBottle: 750 mL form vs 25.4 fl oz label', () => {
    // 25.4 fl oz = 751.17 mL → within 5 mL tolerance
    expect(resolvesToSameStandardBottle('750 mL', '25.4 fl oz', 5)).toBe(true);
  });

  it('resolvesToSameStandardBottle: 1.75 L form vs 59.2 fl oz label', () => {
    // 59.2 fl oz = 1751 mL → snaps to 1750 → same as form
    expect(resolvesToSameStandardBottle('1.75 L', '59.2 fl oz', 5)).toBe(true);
  });

  it('resolvesToSameStandardBottle returns false for genuine mismatches', () => {
    expect(resolvesToSameStandardBottle('750 mL', '500 mL', 5)).toBe(false);
    expect(resolvesToSameStandardBottle('1 L', '750 mL', 5)).toBe(false);
  });
});
