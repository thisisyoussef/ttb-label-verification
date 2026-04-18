import { describe, expect, it } from 'vitest';

import {
  areVarietalsEquivalent,
  canonicalGrapeName,
  isApprovedVarietal
} from './grape-varietals';
import {
  isInvalidPradikatOnAmericanWine,
  isWineClassEquivalent
} from './wine-classes';
import {
  isSpiritsClassEquivalent,
  isWhiskySpellingVariant
} from './distilled-spirits';
import { isMaltClassEquivalent } from './malt-beverages';
import {
  isCountryOrSubdivisionEquivalent,
  resolveSovereign
} from './geography';

describe('grape varieties (27 CFR 4.91)', () => {
  it('recognizes the full approved list', () => {
    expect(isApprovedVarietal('Chardonnay')).toBe(true);
    expect(isApprovedVarietal('Cabernet Sauvignon')).toBe(true);
    expect(isApprovedVarietal('Riesling')).toBe(true);
    expect(isApprovedVarietal('Zinfandel')).toBe(true);
    expect(isApprovedVarietal('Petite Sirah')).toBe(true);
    expect(isApprovedVarietal('Vignoles')).toBe(true);
  });

  it('treats synonyms as equivalent: Syrah / Shiraz', () => {
    expect(areVarietalsEquivalent('Syrah', 'Shiraz')).toBe(true);
    expect(areVarietalsEquivalent('shiraz', 'syrah')).toBe(true);
  });

  it('treats Pinot Gris / Pinot Grigio as equivalent', () => {
    expect(areVarietalsEquivalent('Pinot Gris', 'Pinot Grigio')).toBe(true);
  });

  it('treats Garnacha / Grenache as equivalent', () => {
    expect(areVarietalsEquivalent('garnacha', 'grenache')).toBe(true);
  });

  it('treats Johannisberg Riesling → Riesling per 27 CFR 4.92', () => {
    expect(areVarietalsEquivalent('Johannisberg Riesling', 'Riesling')).toBe(true);
  });

  it('returns false for unrelated varietals', () => {
    expect(areVarietalsEquivalent('Chardonnay', 'Merlot')).toBe(false);
  });

  it('canonicalizes synonym pairs deterministically', () => {
    // Lexicographically sorted candidate — so Syrah/Shiraz both → "shiraz"
    expect(canonicalGrapeName('syrah')).toBe('shiraz');
    expect(canonicalGrapeName('shiraz')).toBe('shiraz');
  });
});

describe('wine classes (27 CFR Part 4 + BAM Ch. 5)', () => {
  it('accepts foreign nongeneric names as wine-class designations', () => {
    expect(isWineClassEquivalent('table wine', 'liebfraumilch')).toBe(true);
    expect(isWineClassEquivalent('grape wine', 'chianti')).toBe(true);
    expect(isWineClassEquivalent('sparkling wine', 'champagne')).toBe(true);
  });

  it('accepts semi-generic dessert wine designations', () => {
    expect(isWineClassEquivalent('dessert wine', 'port')).toBe(true);
    expect(isWineClassEquivalent('dessert wine', 'sherry')).toBe(true);
    expect(isWineClassEquivalent('dessert wine', 'madeira')).toBe(true);
  });

  it('accepts fruit wine types', () => {
    expect(isWineClassEquivalent('fruit wine', 'apple wine')).toBe(true);
    expect(isWineClassEquivalent('fruit wine', 'cider')).toBe(true);
  });

  it('rejects clearly mismatched wine classes', () => {
    expect(isWineClassEquivalent('table red wine', 'vodka')).toBe(false);
  });

  it('flags Prädikat terms on American wines per 27 CFR 4.39', () => {
    expect(isInvalidPradikatOnAmericanWine('USA', 'Riesling Kabinett')).toBe(true);
    expect(isInvalidPradikatOnAmericanWine('United States', 'Spätlese Riesling')).toBe(true);
    // German origin is fine
    expect(isInvalidPradikatOnAmericanWine('Germany', 'Riesling Kabinett')).toBe(false);
  });
});

describe('distilled spirits (27 CFR Part 5)', () => {
  it('treats whisky and whiskey as the same class', () => {
    expect(isSpiritsClassEquivalent('bourbon whisky', 'bourbon whiskey')).toBe(true);
    expect(isSpiritsClassEquivalent('rye whiskey', 'rye whisky')).toBe(true);
  });

  it('isWhiskySpellingVariant identifies the spelling-only diff', () => {
    expect(isWhiskySpellingVariant('tennessee whisky', 'tennessee whiskey')).toBe(true);
    // Identical strings are not "variants" — they're just equal.
    expect(isWhiskySpellingVariant('bourbon', 'bourbon')).toBe(false);
    // Actually-different type names are not variants.
    expect(isWhiskySpellingVariant('bourbon', 'rye')).toBe(false);
  });

  it('rolls up bourbon/rye/scotch under the whisky class', () => {
    expect(isSpiritsClassEquivalent('whisky', 'bourbon')).toBe(true);
    expect(isSpiritsClassEquivalent('whisky', 'scotch')).toBe(true);
    expect(isSpiritsClassEquivalent('straight bourbon whisky', 'kentucky straight bourbon whiskey')).toBe(true);
  });

  it('accepts tequila sub-styles under the tequila class', () => {
    expect(isSpiritsClassEquivalent('tequila', 'blanco')).toBe(true);
    expect(isSpiritsClassEquivalent('tequila', 'añejo')).toBe(true);
    expect(isSpiritsClassEquivalent('tequila', 'reposado')).toBe(true);
  });
});

describe('malt beverages (27 CFR Part 7)', () => {
  it('rolls IPA sub-styles under the ale class', () => {
    expect(isMaltClassEquivalent('ale', 'india pale ale')).toBe(true);
    expect(isMaltClassEquivalent('ale', 'ipa')).toBe(true);
    expect(isMaltClassEquivalent('ale', 'hazy ipa')).toBe(true);
    expect(isMaltClassEquivalent('india pale ale', 'neipa')).toBe(true);
  });

  it('accepts lager sub-styles under lager', () => {
    expect(isMaltClassEquivalent('lager', 'pilsner')).toBe(true);
    expect(isMaltClassEquivalent('lager', 'marzen')).toBe(true);
  });

  it('handles malt beverage umbrella', () => {
    expect(isMaltClassEquivalent('malt beverage', 'ipa')).toBe(true);
    expect(isMaltClassEquivalent('malt beverage', 'stout')).toBe(true);
  });
});

describe('geographic containment', () => {
  it('USA subdivisions resolve to United States', () => {
    expect(isCountryOrSubdivisionEquivalent('California', 'USA')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('usa', 'napa valley')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('United States', 'Kentucky')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('Tennessee', 'America')).toBe(true);
  });

  it('French wine regions resolve to France', () => {
    expect(isCountryOrSubdivisionEquivalent('France', 'Burgundy')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('champagne', 'france')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('Bordeaux', 'France')).toBe(true);
  });

  it('Italian regions resolve to Italy', () => {
    expect(isCountryOrSubdivisionEquivalent('Tuscany', 'Italy')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('Chianti', 'Italy')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('piedmont', 'italia')).toBe(true);
  });

  it('Spanish regions resolve to Spain', () => {
    expect(isCountryOrSubdivisionEquivalent('Rioja', 'Spain')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('priorat', 'españa')).toBe(true);
  });

  it('German wine regions resolve to Germany', () => {
    expect(isCountryOrSubdivisionEquivalent('Mosel', 'Germany')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('rheingau', 'deutschland')).toBe(true);
  });

  it('native-language forms resolve', () => {
    expect(isCountryOrSubdivisionEquivalent('España', 'Spain')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('Deutschland', 'Germany')).toBe(true);
    expect(isCountryOrSubdivisionEquivalent('Italia', 'Italy')).toBe(true);
  });

  it('returns false for mismatched countries', () => {
    expect(isCountryOrSubdivisionEquivalent('France', 'Italy')).toBe(false);
    expect(isCountryOrSubdivisionEquivalent('California', 'France')).toBe(false);
  });

  it('resolveSovereign maps subdivisions to sovereigns', () => {
    expect(resolveSovereign('California')).toBe('united states');
    expect(resolveSovereign('Burgundy')).toBe('france');
    expect(resolveSovereign('Rioja')).toBe('spain');
    expect(resolveSovereign('Mendoza')).toBe('argentina');
    expect(resolveSovereign('Bogotá')).toBeNull();
  });

  it('handles the specific "California" ↔ "MADE IN THE USA" case from the user', () => {
    expect(isCountryOrSubdivisionEquivalent('california', 'made in the usa')).toBe(true);
  });
});
