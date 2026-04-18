/**
 * Distilled spirits class / type taxonomy per 27 CFR Part 5
 * (Standards of Identity for Distilled Spirits) + Spirits BAM Ch. 4.
 *
 * What this encodes:
 *   - The class designations (whisky, vodka, gin, rum, tequila,
 *     brandy, liqueur/cordial, etc.)
 *   - The specific sub-types under each class (bourbon, rye, scotch,
 *     Tennessee whiskey, single malt, blanco tequila, añejo, etc.)
 *   - Spelling variants that TTB treats as identical (whisky / whiskey)
 *
 * Whisky vs. whiskey is a spelling convention — not a type difference.
 * Per 27 CFR 5.22, both spellings are acceptable for the same product.
 * We always route this to REVIEW not reject so a reviewer can confirm,
 * but the equivalence table treats them as matching.
 */

/**
 * Class → acceptable label-text variants.
 *
 * Lookup key is the normalized COLA form value. Acceptable values are
 * lowercased label text that should resolve as the same product class.
 */
export const SPIRITS_CLASS_ALIASES: Record<string, string[]> = {
  // Class 1 — Neutral spirits / distilled spirits
  'neutral spirits': [
    'neutral spirits', 'neutral grain spirits', 'grain neutral spirits'
  ],

  // Class 2 — Whisky (note: whisky ↔ whiskey spelling variance)
  'whisky': [
    'whisky', 'whiskey',
    'bourbon', 'bourbon whisky', 'bourbon whiskey',
    'straight bourbon', 'straight bourbon whisky', 'straight bourbon whiskey',
    'kentucky straight bourbon', 'kentucky straight bourbon whisky',
    'kentucky straight bourbon whiskey',
    'rye', 'rye whisky', 'rye whiskey', 'straight rye whisky',
    'tennessee whisky', 'tennessee whiskey',
    'scotch', 'scotch whisky', 'blended scotch', 'single malt scotch',
    'single malt', 'blended malt scotch',
    'irish whisky', 'irish whiskey',
    'canadian whisky', 'canadian whiskey',
    'corn whisky', 'corn whiskey',
    'malt whisky', 'malt whiskey', 'blended whisky', 'blended whiskey',
    'wheat whisky', 'wheat whiskey',
    'light whisky', 'light whiskey'
  ],
  'straight bourbon whisky': [
    'bourbon', 'bourbon whisky', 'bourbon whiskey', 'straight bourbon',
    'straight bourbon whisky', 'straight bourbon whiskey',
    'kentucky straight bourbon', 'kentucky straight bourbon whisky',
    'kentucky straight bourbon whiskey'
  ],
  'straight rye whisky': [
    'rye', 'rye whisky', 'rye whiskey', 'straight rye whisky',
    'straight rye whiskey'
  ],
  'tennessee whisky': [
    'tennessee whisky', 'tennessee whiskey', 'tennessee sour mash'
  ],

  // Class 3 — Gin
  'gin': [
    'gin', 'london dry gin', 'london gin', 'dry gin', 'genever',
    'old tom gin', 'plymouth gin', 'distilled gin', 'compound gin'
  ],

  // Class 4 — Brandy
  'brandy': [
    'brandy', 'grape brandy', 'fruit brandy',
    'cognac', 'armagnac', 'calvados', 'grappa', 'pisco', 'eau de vie',
    'apple brandy', 'applejack', 'kirschwasser', 'slivovitz'
  ],

  // Class 5 — Blended applejack (pre-2020 term; now folded under brandy)
  'applejack': ['applejack', 'apple brandy', 'blended applejack'],

  // Class 7 — Rum
  'rum': [
    'rum', 'white rum', 'silver rum', 'light rum',
    'gold rum', 'amber rum', 'añejo rum', 'anejo rum', 'aged rum',
    'dark rum', 'spiced rum', 'flavored rum',
    'overproof rum', 'rhum agricole', 'cachaça', 'cachaca'
  ],

  // Class 8 — Tequila / agave spirits
  'tequila': [
    'tequila', 'blanco', 'plata', 'silver tequila', 'joven',
    'reposado', 'añejo', 'anejo', 'extra añejo', 'extra anejo',
    'mezcal', 'mescal', 'bacanora', 'sotol'
  ],

  // Class 9 — Cordials & liqueurs
  'liqueur': [
    'liqueur', 'cordial', 'cream liqueur', 'crème', 'creme',
    'schnapps', 'anise', 'amaro', 'amaretto', 'chartreuse'
  ],
  'cordial': [
    'cordial', 'liqueur', 'cream liqueur', 'schnapps'
  ],

  // Class 10 — Flavored spirits
  'flavored vodka': [
    'flavored vodka', 'vodka',
    'citrus vodka', 'orange vodka', 'vanilla vodka', 'raspberry vodka'
  ],
  'flavored rum': [
    'flavored rum', 'spiced rum', 'coconut rum', 'pineapple rum'
  ],
  'flavored whisky': [
    'flavored whisky', 'flavored whiskey', 'honey whiskey',
    'cinnamon whiskey', 'apple whiskey'
  ],

  // Vodka (Class 6 in 27 CFR 5.22)
  'vodka': [
    'vodka', 'flavored vodka', 'wheat vodka', 'potato vodka', 'rye vodka',
    'corn vodka', 'grain vodka'
  ],
  'vodka specialties': [
    'vodka', 'vodka specialties', 'flavored vodka'
  ],

  // Class 11 — Imitations & other specialties
  'other specialties & proprietaries': [
    'spirits', 'spirit', 'liquor', 'distilled spirits', 'specialty spirits',
    'sparkling spirits', 'proprietary spirits'
  ],

  // Arak / raki / ouzo — anise-flavored regional spirits
  'arack/raki': [
    'arak', 'arack', 'raki', 'ouzo', 'pastis', 'absinthe',
    'anise spirits', 'spirits'
  ]
};

/**
 * True when two spirit class/type strings are acceptable variants of
 * each other. Handles the whisky/whiskey spelling split and common
 * sub-type roll-ups (bourbon → whisky).
 */
export function isSpiritsClassEquivalent(
  ttbClass: string,
  labelText: string
): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  const ttb = norm(ttbClass);
  const label = norm(labelText);
  if (ttb === label) return true;
  // Bidirectional whisky/whiskey spelling tolerance.
  if (ttb.replace(/whiskey/gi, 'whisky') === label.replace(/whiskey/gi, 'whisky')) {
    return true;
  }
  const aliases = SPIRITS_CLASS_ALIASES[ttb];
  if (aliases && aliases.some((a) => label === norm(a) || label.includes(norm(a)) || norm(a).includes(label))) {
    return true;
  }
  return false;
}

/**
 * Whisky vs. whiskey specifically — a spelling variant, not a type
 * difference. Per 27 CFR 5.22 both are acceptable for the same
 * product. Callers use this to downgrade the disposition from
 * "mismatch" to "review" rather than flagging.
 */
export function isWhiskySpellingVariant(a: string, b: string): boolean {
  const na = a.toLowerCase().trim().replace(/\s+/g, ' ');
  const nb = b.toLowerCase().trim().replace(/\s+/g, ' ');
  if (na === nb) return false; // already identical — not a variant
  return na.replace(/whiskey/g, 'whisky') === nb.replace(/whiskey/g, 'whisky');
}
