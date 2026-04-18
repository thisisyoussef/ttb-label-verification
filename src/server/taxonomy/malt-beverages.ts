/**
 * Malt beverage class / type taxonomy per 27 CFR Part 7
 * (Standards of Identity for Malt Beverages) + Malt BAM Ch. 4.
 *
 * TTB recognizes "malt beverage" as the umbrella class. Specific
 * types (ale, lager, stout, porter, malt liquor, etc.) are what
 * appears on most labels. The COLA form may use any of these.
 */

export const MALT_CLASS_ALIASES: Record<string, string[]> = {
  // Umbrella class
  'malt beverage': [
    'malt beverage', 'malt beverages', 'malt liquor',
    'flavored malt beverage', 'malt based beverage',
    'hard seltzer', 'hard cider'
  ],

  // Ale family
  'ale': [
    'ale', 'amber ale', 'american ale', 'bitter', 'blonde ale',
    'brown ale', 'cream ale', 'english ale', 'farmhouse ale',
    'golden ale', 'irish ale', 'original ale', 'pale ale',
    'red ale', 'rye ale', 'saison', 'scottish ale', 'sour ale',
    'wheat ale', 'white ale', 'wit', 'witbier', 'belgian ale',
    'ipa', 'india pale ale', 'double ipa', 'imperial ipa',
    'session ipa', 'new england ipa', 'neipa', 'hazy ipa',
    'west coast ipa', 'american ipa', 'british ipa',
    'porter', 'robust porter', 'baltic porter',
    'stout', 'dry stout', 'imperial stout', 'milk stout',
    'oatmeal stout', 'sweet stout', 'coffee stout', 'russian imperial stout'
  ],

  // Lager family
  'lager': [
    'lager', 'american lager', 'amber lager', 'bock', 'doppelbock',
    'maibock', 'eisbock', 'dortmunder', 'dunkel', 'helles',
    'marzen', 'oktoberfest', 'schwarzbier', 'vienna lager',
    'pilsner', 'pilsener', 'czech pilsner', 'german pilsner',
    'american pilsner', 'bohemian pilsner',
    'kolsch', 'altbier',
    'light lager', 'pale lager', 'premium lager'
  ],

  'beer': [
    'beer', 'lager', 'pilsner', 'pilsener', 'bock',
    'ale', 'stout', 'porter',
    'wheat beer', 'hefeweizen', 'weissbier', 'weisse',
    'dunkel', 'helles', 'marzen', 'kolsch',
    'craft beer', 'light beer'
  ],

  // Flavored / specialty
  'malt beverages specialities - flavored': [
    'flavored malt beverage', 'flavored ale', 'fruit ale', 'sour ale',
    'fruit beer', 'spiced beer', 'smoked beer', 'barrel aged beer'
  ],
  'flavored malt beverage': [
    'flavored malt beverage', 'fmb', 'hard seltzer', 'seltzer',
    'ready to drink', 'rtd', 'malt cocktail'
  ],

  // Sub-IPA types (some COLA forms use sub-styles as type)
  'india pale ale': [
    'ipa', 'india pale ale', 'american ipa', 'west coast ipa',
    'new england ipa', 'neipa', 'hazy ipa', 'session ipa',
    'double ipa', 'imperial ipa', 'british ipa'
  ],
  'pale ale': [
    'pale ale', 'american pale ale', 'apa', 'british pale ale',
    'english bitter'
  ]
};

/**
 * True when two malt-beverage class/type strings are acceptable
 * variants. Handles ale/IPA/stout roll-ups (any IPA sub-style is
 * still an "ale") and the umbrella malt beverage ↔ beer equivalence.
 */
export function isMaltClassEquivalent(
  ttbClass: string,
  labelText: string
): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  const ttb = norm(ttbClass);
  const label = norm(labelText);
  if (ttb === label) return true;
  const aliases = MALT_CLASS_ALIASES[ttb];
  if (aliases && aliases.some((a) => label === norm(a) || label.includes(norm(a)) || norm(a).includes(label))) {
    return true;
  }
  // "Malt beverage" on the COLA covers beer / ale / lager / stout /
  // porter — any of those on the label is equivalent.
  if (ttb === 'malt beverage' || ttb === 'beer') {
    const maltFamily = [
      ...(MALT_CLASS_ALIASES['ale'] ?? []),
      ...(MALT_CLASS_ALIASES['lager'] ?? []),
      ...(MALT_CLASS_ALIASES['beer'] ?? [])
    ];
    if (maltFamily.some((a) => label.includes(norm(a)))) return true;
  }
  return false;
}
