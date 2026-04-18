/**
 * Field-aware synonym/alias expansion for the anchor track.
 *
 * The base anchor track (`anchor-field-track.ts`) tokenizes an expected
 * application value and searches the full-label OCR output for those
 * tokens. That works when the label uses the same spelling as the COLA
 * form — but breaks when the label uses a recognized equivalent:
 *
 *   App says "Syrah" → label says "SHIRAZ"     (27 CFR 4.91 synonym)
 *   App says "United States" → label says "USA" (ISO 3166 alias)
 *   App says "Whisky" → label says "WHISKEY"    (Scotch/Irish variant)
 *
 * This module answers "for this field, what OTHER tokens mean the same
 * thing as the expected value?" The anchor track retries the search
 * against these expansion tokens when the literal match comes up short.
 *
 * Design notes:
 *  - Field-specific: brand/fanciful get no expansion (trademarks are
 *    unique), only the normative-text fields do.
 *  - Cheap: every expansion is a constant-time lookup against pre-built
 *    tables in `src/server/taxonomy/**`. No LLM, no regex loops.
 *  - Conservative: we only surface equivalents that the taxonomy calls
 *    "semantically identical" — never loose matches like "red wine" ↔
 *    "cabernet sauvignon".
 *  - Additive only: expansion widens the token set; the base tokens
 *    are always included. A field that wouldn't anchor literally but
 *    anchors via equivalent flips from `partial`/`missing` → `found`.
 */

import { GRAPE_VARIETY_SYNONYMS } from './taxonomy/grape-varietals';
import { SPIRITS_CLASS_ALIASES } from './taxonomy/distilled-spirits';
import { WINE_CLASS_ALIASES } from './taxonomy/wine-classes';
import { MALT_CLASS_ALIASES } from './taxonomy/malt-beverages';
import { COUNTRY_ALIASES, COUNTRY_SUBDIVISIONS } from './taxonomy/geography';
import { ALL_ADDRESS_ABBREVIATIONS } from './taxonomy/address-abbreviations';

/**
 * Field ids the anchor track knows how to expand. Must mirror the
 * field ids in `anchor-field-track.ts`'s `runAnchorTrack` call.
 */
export type AnchorFieldId =
  | 'brand'
  | 'fanciful'
  | 'class'
  | 'abv'
  | 'net'
  | 'country'
  | 'address';

/**
 * Return a de-duplicated, lowercased list of *equivalent-phrase*
 * tokens for the given field. These get tokenized and added to the
 * anchor search set. Returns an empty array for fields that don't
 * have meaningful equivalents (brand, fanciful, abv).
 */
export function expandEquivalentPhrases(
  field: AnchorFieldId,
  expected: string
): string[] {
  if (!expected) return [];
  const value = expected.trim().toLowerCase();
  if (value.length === 0) return [];

  switch (field) {
    case 'class':
      return expandClassEquivalents(value);
    case 'country':
      return expandCountryEquivalents(value);
    case 'net':
      return expandNetContentsEquivalents(value);
    case 'address':
      return expandAddressEquivalents(value);
    case 'brand':
    case 'fanciful':
    case 'abv':
    default:
      return [];
  }
}

/**
 * Class-type equivalents span three regulatory domains: wine (27 CFR
 * Part 4), distilled spirits (27 CFR Part 5), and malt beverages
 * (27 CFR Part 7). We check all three because the anchor track
 * doesn't know the beverage type at this layer — the VLM does, but
 * anchoring runs in parallel with extraction, so it expands broadly
 * and lets the check layer disambiguate.
 */
function expandClassEquivalents(value: string): string[] {
  const out = new Set<string>();
  // Grape varietal synonyms (Syrah/Shiraz, Pinot Grigio/Pinot Gris).
  const grapes = GRAPE_VARIETY_SYNONYMS[value];
  if (grapes) for (const g of grapes) out.add(g);

  // Spirits class aliases (bourbon/bourbon whiskey, whisky/whiskey).
  const spirits = SPIRITS_CLASS_ALIASES[value];
  if (spirits) for (const s of spirits) out.add(s);

  // Wine class aliases (sparkling wine/champagne-style where legal).
  const wine = WINE_CLASS_ALIASES[value];
  if (wine) for (const w of wine) out.add(w);

  // Malt beverage aliases (IPA/India Pale Ale, lager/pilsner).
  const malt = MALT_CLASS_ALIASES[value];
  if (malt) for (const m of malt) out.add(m);

  // Reverse lookup: value itself may be an alias — find the canonical
  // and pull in its synonyms (handles "shiraz" → also try "syrah").
  for (const [canonical, synonyms] of Object.entries(GRAPE_VARIETY_SYNONYMS)) {
    if (synonyms.includes(value)) {
      out.add(canonical);
      for (const syn of synonyms) out.add(syn);
    }
  }
  return Array.from(out);
}

/**
 * Country equivalents: sovereign-state aliases PLUS subdivisions. A
 * label that shows "CALIFORNIA" legitimately anchors the application
 * country "United States" — geographic containment. We expand with
 * every subdivision because anchoring is presence-only; a subdivision
 * appearing on the label confirms the sovereign.
 */
function expandCountryEquivalents(value: string): string[] {
  const out = new Set<string>();
  const aliases = COUNTRY_ALIASES[value];
  if (aliases) for (const a of aliases) out.add(a);

  const subdivisions = COUNTRY_SUBDIVISIONS[value];
  if (subdivisions) for (const s of subdivisions) out.add(s.trim());

  // Reverse lookup: value might itself be an alias, resolve to
  // sovereign and return that sovereign's aliases + subdivisions.
  for (const [sovereign, aliasList] of Object.entries(COUNTRY_ALIASES)) {
    if (aliasList.includes(value)) {
      out.add(sovereign);
      for (const a of aliasList) out.add(a);
      const subs = COUNTRY_SUBDIVISIONS[sovereign];
      if (subs) for (const s of subs) out.add(s.trim());
    }
  }
  return Array.from(out);
}

/**
 * Net-contents equivalents: unit spelling variants only. "750ml" also
 * matches "750" + "ml" + "milliliters" + "milliliter". We return
 * alternate spellings of the SAME volume — not other bottle sizes.
 * Parsing + standard-bottle snapping lives in judgment-field-rules;
 * anchor just widens the spelling set so OCR variance (case, space,
 * period) doesn't tank the match.
 */
function expandNetContentsEquivalents(value: string): string[] {
  const out = new Set<string>();
  const compact = value.replace(/\s+/g, '').replace(/[,.]/g, '').toLowerCase();
  const UNIT_SYN: Record<string, string[]> = {
    ml: ['ml', 'milliliters', 'millilitre', 'milliliter'],
    l: ['l', 'liter', 'litre', 'liters', 'litres'],
    'fl oz': ['fl oz', 'fl.oz', 'fluid ounces', 'fluid ounce', 'fl. oz'],
    oz: ['oz', 'ounce', 'ounces'],
    cl: ['cl', 'centiliter', 'centilitre']
  };
  for (const [, syns] of Object.entries(UNIT_SYN)) {
    if (syns.some((s) => compact.includes(s.replace(/\s+/g, '')))) {
      for (const s of syns) out.add(s);
    }
  }
  // Keep the digit sequence as its own anchor token — OCR will usually
  // read "750" even when the unit word is hard to read.
  const digits = value.match(/\d+(?:[.,]\d+)?/g);
  if (digits) for (const d of digits) out.add(d.replace(',', '.'));
  return Array.from(out);
}

/**
 * Address equivalents: USPS Pub 28 expansions. App says "STREET" but
 * label prints "ST"; app says "AVENUE" but label prints "AVE". We add
 * every known long-form ↔ abbreviation pair for the tokens in the
 * expected address.
 */
function expandAddressEquivalents(value: string): string[] {
  const out = new Set<string>();
  const tokens = value.split(/\s+/);
  for (const t of tokens) {
    const expanded = ALL_ADDRESS_ABBREVIATIONS[t];
    if (expanded) out.add(expanded);
    for (const [abbrev, long] of Object.entries(ALL_ADDRESS_ABBREVIATIONS)) {
      if (long === t) out.add(abbrev);
    }
  }
  return Array.from(out);
}
