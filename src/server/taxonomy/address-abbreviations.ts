/**
 * USPS Publication 28 — Postal Addressing Standards
 * (https://pe.usps.com/text/pub28/welcome.htm)
 *
 * Canonical abbreviation → expanded form for the most common street
 * suffixes, directionals, unit designators, and business-entity
 * terms. Used by the applicant-address judgment rule to normalize
 * whichever side (COLA form vs. label) uses abbreviated text so the
 * comparison doesn't flag purely-formatting differences.
 *
 * Scope: MOST-COMMON forms, not the full Pub 28 table. Long-tail
 * abbreviations fall through and are handled by the LLM judgment
 * pass. Per the briefing: applicant-address is always judgment-based
 * because entity-identity questions (DBA, subsidiary, co-packer)
 * can't be resolved deterministically. These tables just remove the
 * formatting noise so the judgment is about identity, not punctuation.
 */

/**
 * Street suffix abbreviations. Keys are lowercase canonical forms
 * (with the trailing period common in addresses). Values are the
 * expanded spellings. Use both directions by building a reverse
 * lookup at read time.
 */
export const STREET_SUFFIX_ABBREVIATIONS: Record<string, string> = {
  'aly': 'alley',
  'ave': 'avenue',
  'avn': 'avenue',
  'blvd': 'boulevard',
  'bvd': 'boulevard',
  'cir': 'circle',
  'crk': 'creek',
  'ct': 'court',
  'cv': 'cove',
  'dr': 'drive',
  'est': 'estate',
  'expy': 'expressway',
  'gdn': 'garden',
  'gln': 'glen',
  'grv': 'grove',
  'hts': 'heights',
  'hwy': 'highway',
  'is': 'island',
  'lk': 'lake',
  'ln': 'lane',
  'mtn': 'mountain',
  'pkwy': 'parkway',
  'pkwys': 'parkways',
  'pl': 'place',
  'plz': 'plaza',
  'pt': 'point',
  'rd': 'road',
  'rdg': 'ridge',
  'rte': 'route',
  'sq': 'square',
  'st': 'street',
  'str': 'street',
  'sta': 'station',
  'ter': 'terrace',
  'tpke': 'turnpike',
  'trl': 'trail',
  'vly': 'valley',
  'way': 'way'
};

/** Directional abbreviations (N S E W NE NW SE SW). */
export const DIRECTIONAL_ABBREVIATIONS: Record<string, string> = {
  'n': 'north',
  's': 'south',
  'e': 'east',
  'w': 'west',
  'ne': 'northeast',
  'nw': 'northwest',
  'se': 'southeast',
  'sw': 'southwest'
};

/** Unit / secondary designator abbreviations. */
export const UNIT_ABBREVIATIONS: Record<string, string> = {
  'apt': 'apartment',
  'bldg': 'building',
  'flr': 'floor',
  'ofc': 'office',
  'rm': 'room',
  'ste': 'suite',
  'unit': 'unit',
  'trlr': 'trailer'
};

/**
 * Business-entity / naming conventions commonly seen on bottler
 * labels where the producer's name is abbreviated to fit.
 */
export const BUSINESS_ABBREVIATIONS: Record<string, string> = {
  'bros': 'brothers',
  'co': 'company',
  'corp': 'corporation',
  'inc': 'incorporated',
  'intl': 'international',
  'llc': 'llc',
  'ltd': 'limited',
  'mfg': 'manufacturing',
  'mfrs': 'manufacturers',
  '&': 'and'
};

/** Combined dictionary used for address-normalization passes. */
export const ALL_ADDRESS_ABBREVIATIONS: Record<string, string> = {
  ...STREET_SUFFIX_ABBREVIATIONS,
  ...DIRECTIONAL_ABBREVIATIONS,
  ...UNIT_ABBREVIATIONS,
  ...BUSINESS_ABBREVIATIONS
};

/**
 * Normalize an address string for comparison. Lowercases, strips
 * trailing punctuation from tokens, expands known abbreviations both
 * ways (so "st" and "street" compare as equivalent), and collapses
 * whitespace.
 *
 * Not a complete parse — we're not resolving to a canonical
 * structured form, we're just removing noise so the fuzzy match
 * downstream has a cleaner signal.
 */
export function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => {
      const cleaned = token.replace(/[^\p{L}\p{N}&]/gu, '');
      return ALL_ADDRESS_ABBREVIATIONS[cleaned] ?? cleaned;
    })
    .join(' ')
    .trim();
}

/**
 * Token-overlap ratio for two addresses after USPS-style
 * normalization. Returns a number in [0, 1] where 1 = identical
 * token sets. Used as one signal the applicant-address judgment
 * rule can weight alongside full-string similarity.
 */
export function addressTokenOverlap(a: string, b: string): number {
  const tokensA = new Set(normalizeAddress(a).split(/\s+/).filter(Boolean));
  const tokensB = new Set(normalizeAddress(b).split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }
  return shared / Math.max(tokensA.size, tokensB.size);
}
