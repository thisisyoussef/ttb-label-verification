/**
 * Version-controlled equivalence tables for field-specific judgment.
 *
 * These encode regulatory knowledge that cannot be derived algorithmically:
 * TTB class taxonomy, grape synonyms, country translations, etc.
 *
 * The large data tables now live under `./taxonomy/` broken down by
 * subdomain (wine classes, grape varietals, distilled spirits, malt
 * beverages, geography) so each regulatory source is a separately
 * auditable file. Re-exports at the bottom keep the public API stable.
 */

import {
  APPROVED_GRAPE_VARIETIES,
  areVarietalsEquivalent,
  canonicalGrapeName,
  GRAPE_VARIETY_SYNONYMS,
  isApprovedVarietal
} from '../taxonomy/grape-varietals';
import {
  ALL_FOREIGN_NONGENERIC_NAMES,
  isInvalidPradikatOnAmericanWine,
  isWineClassEquivalent,
  WINE_CLASS_ALIASES
} from '../taxonomy/wine-classes';
import {
  isSpiritsClassEquivalent,
  isWhiskySpellingVariant,
  SPIRITS_CLASS_ALIASES
} from '../taxonomy/distilled-spirits';
import {
  isMaltClassEquivalent,
  MALT_CLASS_ALIASES
} from '../taxonomy/malt-beverages';
import {
  COUNTRY_ALIASES,
  COUNTRY_SUBDIVISIONS,
  isCountryOrSubdivisionEquivalent,
  resolveSovereign
} from '../taxonomy/geography';

// Re-export the taxonomy helpers so downstream modules can keep
// importing from `./judgment-equivalence` if they were already.
export {
  APPROVED_GRAPE_VARIETIES,
  areVarietalsEquivalent,
  canonicalGrapeName,
  GRAPE_VARIETY_SYNONYMS,
  isApprovedVarietal,
  ALL_FOREIGN_NONGENERIC_NAMES,
  isInvalidPradikatOnAmericanWine,
  isWineClassEquivalent,
  WINE_CLASS_ALIASES,
  isSpiritsClassEquivalent,
  isWhiskySpellingVariant,
  SPIRITS_CLASS_ALIASES,
  isMaltClassEquivalent,
  MALT_CLASS_ALIASES,
  COUNTRY_ALIASES,
  COUNTRY_SUBDIVISIONS,
  resolveSovereign
};

/**
 * TTB regulatory class → acceptable label text variations.
 * The key is the normalized TTB class; values are normalized label terms
 * that are acceptable matches.
 */
export const CLASS_TYPE_TAXONOMY: Record<string, string[]> = {
  // Distilled spirits
  'whisky': ['whisky', 'whiskey', 'bourbon', 'scotch', 'rye', 'malt whisky', 'single malt', 'blended whisky', 'blended whiskey', 'tennessee whiskey', 'kentucky straight bourbon', 'kentucky straight bourbon whiskey', 'straight bourbon whisky', 'straight bourbon whiskey', 'straight bourbon', 'canadian whisky'],
  'vodka': ['vodka', 'vodka cocktail', 'flavored vodka'],
  'vodka specialties': ['vodka', 'vodka cocktail', 'vodka specialties', 'flavored vodka'],
  'vodka - orange flavored': ['vodka', 'flavored vodka', 'orange vodka'],
  'gin': ['gin', 'london dry gin', 'dry gin', 'genever'],
  'rum': ['rum', 'white rum', 'gold rum', 'dark rum', 'spiced rum', 'aged rum'],
  'other rum gold fb': ['rum', 'gold rum', 'aged rum'],
  'tequila': ['tequila', 'mezcal', 'blanco', 'reposado', 'anejo'],
  'brandy': ['brandy', 'cognac', 'armagnac', 'grappa', 'pisco', 'eau de vie'],
  'liqueur': ['liqueur', 'cordial', 'cream liqueur'],
  'straight bourbon whisky': ['bourbon', 'straight bourbon', 'straight bourbon whisky', 'straight bourbon whiskey', 'kentucky straight bourbon', 'kentucky straight bourbon whiskey'],
  'other specialties & proprietaries': ['spirits', 'spirit', 'liquor', 'sparkling spirits', 'specialty spirits'],
  'arack/raki': ['arak', 'arack', 'raki', 'ouzo', 'spirits', 'vodka'],

  // Wine
  'table white wine': ['white wine', 'wine', 'vino blanco', 'weisswein', 'vin blanc'],
  'table red wine': ['red wine', 'wine', 'vino rosso', 'rotwein', 'vin rouge'],
  'table wine': ['wine', 'table wine', 'vino'],
  'table flavored wine': ['flavored wine', 'wine', 'sweet wine', 'fruit wine'],
  'sparkling wine': ['sparkling wine', 'champagne', 'cava', 'prosecco', 'cremant', 'sekt'],
  'dessert wine': ['dessert wine', 'port', 'sherry', 'madeira', 'marsala', 'ice wine', 'late harvest'],

  // Malt beverages
  'ale': ['ale', 'ipa', 'india pale ale', 'pale ale', 'stout', 'porter', 'bitter', 'brown ale', 'amber ale', 'red ale', 'wheat ale', 'saison', 'farmhouse ale', 'belgian ale', 'sour ale', 'original ale', 'golden ale'],
  'beer': ['beer', 'lager', 'pilsner', 'pilsener', 'bock', 'dunkel', 'helles', 'marzen', 'kolsch', 'amber', 'wheat beer', 'hefeweizen'],
  'malt beverage': ['malt beverage', 'malt liquor', 'flavored malt beverage', 'hard seltzer', 'hard cider'],
  'malt beverages specialities - flavored': ['ale', 'flavored ale', 'flavored malt beverage', 'fruit ale', 'sour ale']
};

/**
 * Check if an extracted class/type label text is an acceptable match
 * for a TTB regulatory class. Delegates to the subdomain taxonomy
 * modules in order: wine → spirits → malt, then the legacy flat
 * table + grape-variety / style-descriptor heuristics.
 */
export function isClassTypeEquivalent(
  ttbClass: string,
  labelText: string
): boolean {
  const normalizedTtb = ttbClass.toLowerCase().trim();
  const normalizedLabel = labelText.toLowerCase().trim();

  if (normalizedTtb === normalizedLabel) return true;

  // Subdomain taxonomy modules. Each returns true when the domain-
  // specific tables recognize the pair; they ignore everything outside
  // their domain, so the three calls are additive not exclusive.
  if (isWineClassEquivalent(normalizedTtb, normalizedLabel)) return true;
  if (isSpiritsClassEquivalent(normalizedTtb, normalizedLabel)) return true;
  if (isMaltClassEquivalent(normalizedTtb, normalizedLabel)) return true;

  // Legacy flat table. Kept as a fallback so any one-off entries added
  // historically still resolve. New entries should land in the
  // subdomain taxonomy files instead.
  const acceptable = CLASS_TYPE_TAXONOMY[normalizedTtb];
  if (acceptable) {
    if (acceptable.some(term => normalizedLabel.includes(term) || term.includes(normalizedLabel))) {
      return true;
    }
  }

  // Broad "does the label mention the base type word?" heuristic.
  const baseTypes = extractBaseTypes(normalizedTtb);
  if (baseTypes.some(bt => normalizedLabel.includes(bt))) return true;

  // Grape variety → wine class: a label that reads "Riesling" is a
  // complete type designation for "table white wine" per 27 CFR 4.23.
  if (isWineClass(normalizedTtb) && isApprovedVarietal(normalizedLabel)) {
    return true;
  }
  // Fallback to the older narrow set for compat.
  if (isWineClass(normalizedTtb) && isKnownGrapeVarietal(normalizedLabel)) {
    return true;
  }

  // Generic style/qualifier descriptors (Reserva, Brut, Cask Strength,
  // etc.) — these don't change the class.
  if (isRecognizedSubType(normalizedLabel, normalizedTtb)) return true;

  return false;
}

function extractBaseTypes(ttbClass: string): string[] {
  const bases: string[] = [];
  if (/wine/.test(ttbClass)) bases.push('wine');
  if (/ale/.test(ttbClass)) bases.push('ale');
  if (/beer/.test(ttbClass)) bases.push('beer');
  if (/malt/.test(ttbClass)) bases.push('malt');
  if (/whisky|whiskey|bourbon/.test(ttbClass)) bases.push('whisky', 'whiskey', 'bourbon');
  if (/vodka/.test(ttbClass)) bases.push('vodka');
  if (/rum/.test(ttbClass)) bases.push('rum');
  if (/gin/.test(ttbClass)) bases.push('gin');
  if (/tequila/.test(ttbClass)) bases.push('tequila');
  if (/brandy|cognac/.test(ttbClass)) bases.push('brandy', 'cognac');
  return bases;
}

function isWineClass(ttbClass: string): boolean {
  return /wine|vin|vino/.test(ttbClass);
}

/** Known grape varietals — used to accept varietal names as class/type for wines. */
const GRAPE_VARIETALS = new Set([
  'cabernet sauvignon', 'cabernet', 'merlot', 'pinot noir', 'pinot grigio',
  'pinot gris', 'chardonnay', 'sauvignon blanc', 'riesling', 'syrah',
  'shiraz', 'zinfandel', 'malbec', 'tempranillo', 'sangiovese',
  'nebbiolo', 'barbera', 'grenache', 'garnacha', 'mourvedre',
  'viognier', 'gewurztraminer', 'semillon', 'chenin blanc',
  'muscat', 'moscato', 'prosecco', 'albarino', 'gruner veltliner',
  'torrontes', 'carmenere', 'petit verdot', 'tannat', 'pinotage',
  'primitivo', 'nero d\'avola', 'aglianico', 'vermentino', 'fiano',
  'trebbiano', 'garganega', 'corvina', 'montepulciano',
  'parcelas blend', 'blend', 'meritage', 'rose', 'brut'
]);

function isKnownGrapeVarietal(text: string): boolean {
  return GRAPE_VARIETALS.has(text.toLowerCase().trim());
}

/** Recognized wine/spirits qualifiers and designations that don't change the base type. */
const STYLE_DESCRIPTORS = new Set([
  'reserve', 'reserva', 'gran reserva', 'premium', 'select', 'special',
  'extra', 'superior', 'classico', 'riserva', 'crianza',
  'reposado', 'anejo', 'extra anejo', 'blanco', 'plata', 'joven',
  'single barrel', 'small batch', 'cask strength', 'barrel proof',
  'v.s.', 'v.s.o.p.', 'x.o.', 'napoleon',
  'brut', 'extra brut', 'sec', 'demi-sec', 'doux',
  'kabinett', 'spatlese', 'auslese', 'beerenauslese', 'trockenbeerenauslese',
  'semi-dry', 'dry', 'sweet', 'off-dry',
  'denominazione di origine controllata e garantita', 'docg', 'doc', 'igt',
  'appellation', 'aoc', 'aop', 'weingut'
]);

function isRecognizedSubType(labelText: string, _ttbClass: string): boolean {
  return STYLE_DESCRIPTORS.has(labelText.toLowerCase().trim());
}

/** Grape synonym table for varietal comparison. */
export const GRAPE_SYNONYMS: Record<string, string[]> = {
  'shiraz': ['syrah'],
  'syrah': ['shiraz'],
  'pinot grigio': ['pinot gris'],
  'pinot gris': ['pinot grigio'],
  'garnacha': ['grenache'],
  'grenache': ['garnacha'],
  'primitivo': ['zinfandel'],
  'zinfandel': ['primitivo'],
  'sangiovese': ['brunello', 'morellino'],
  'trebbiano': ['ugni blanc'],
  'muscat': ['moscato', 'moscatel'],
  'moscato': ['muscat', 'moscatel']
};

/**
 * Country name translations / equivalences.
 *
 * This is a LIGHTWEIGHT first-pass lookup for the most common cases.
 * For anything not in this table, the pipeline falls back to LLM judgment
 * (src/server/judgment-llm-executor.ts) which handles the long tail of
 * variability: "Product of X", "Wine of X", native-language forms,
 * regional subdivisions, and OCR-garbled extraction.
 *
 * Do NOT add one-off entries here just to make a specific golden-set case
 * pass. Add them to the LLM prompt few-shot examples instead so the model
 * can generalize.
 */
export const COUNTRY_EQUIVALENCES: Record<string, string[]> = {
  'france': ['produit de france', 'republique francaise', 'french'],
  'italy': ['italia', 'prodotto in italia', 'italian'],
  'spain': ['espana', 'producto de espana', 'spanish'],
  'germany': ['deutschland', 'german'],
  'portugal': ['portugues', 'portuguese'],
  'mexico': ['mexico', 'producto de mexico', 'mexican', 'hecho en mexico'],
  'canada': ['canadian'],
  'united states': ['usa', 'u.s.a.', 'us', 'u.s.', 'american'],
  'scotland': ['scotch', 'scottish'],
  'ireland': ['irish'],
  'australia': ['australian'],
  'new zealand': ['nz'],
  'chile': ['chilean', 'producto de chile'],
  'argentina': ['argentinian', 'producto de argentina'],
  'south africa': ['south african']
};

/**
 * Country-of-origin equivalence. Now handles three layers:
 *
 *   1. Exact alias match (USA ↔ United States ↔ America)
 *   2. Geographic containment (California → USA, Burgundy → France)
 *   3. Substring tolerance for phrasing ("Made in the USA", etc.)
 *
 * Delegates to the geography taxonomy (src/server/taxonomy/geography.ts)
 * which has the full state/region table. Legacy inline table retained
 * below as a third-tier fallback.
 */
export function isCountryEquivalent(appCountry: string, extCountry: string): boolean {
  const normApp = appCountry.toLowerCase().trim();
  const normExt = extCountry.toLowerCase().trim();

  if (normApp === normExt) return true;

  // Primary path: the geography taxonomy handles aliases + containment.
  if (isCountryOrSubdivisionEquivalent(normApp, normExt)) return true;

  // Third-tier legacy fallback — kept so a one-off entry added
  // historically still resolves.
  if (normApp.includes(normExt) || normExt.includes(normApp)) return true;
  const appEquivs = COUNTRY_EQUIVALENCES[normApp];
  if (appEquivs?.some(e => normExt.includes(e) || e.includes(normExt))) return true;
  for (const [canonical, variants] of Object.entries(COUNTRY_EQUIVALENCES)) {
    if (variants.some(v => normApp.includes(v) || v.includes(normApp))) {
      if (canonical === normExt || variants.some(v => normExt.includes(v) || v.includes(normExt))) {
        return true;
      }
    }
  }

  return false;
}
