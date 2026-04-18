/**
 * Approved American grape variety names per 27 CFR 4.91 (Subpart J).
 *
 * The TTB approves ~300+ grape varieties as valid type designations for
 * American wines. A label that reads "Riesling" or "Cabernet Sauvignon"
 * is a complete class-and-type designation even when the COLA form says
 * "table white wine" — the varietal IS the type.
 *
 * Also per 27 CFR 4.92, several "alternative names" were acceptable as
 * type designations for wines bottled before a cutoff date. We include
 * them in the accepted-names set so older-vintage labels don't false
 * positive as mismatches.
 *
 * Source of truth: 27 CFR 4.91 + 4.92. Cross-reference regulatory changes
 * when TTB updates the approved list (last published bulletin 2011).
 */

/**
 * Canonical + synonym pairs from 27 CFR 4.91. Each entry appears as
 * `canonical → [synonyms]` and the reverse map is computed on first
 * access. Keep keys LOWERCASE to keep lookup O(1) without normalization
 * churn at call time.
 */
export const GRAPE_VARIETY_SYNONYMS: Record<string, string[]> = {
  'albariño': ['alvarinho'],
  'alvarinho': ['albariño'],
  'black malvoisie': ['cinsaut'],
  'cinsaut': ['black malvoisie'],
  'black muscat': ['muscat hamburg'],
  'muscat hamburg': ['black muscat'],
  'blaufränkish': ['lemberger', 'limberger'],
  'lemberger': ['blaufränkish', 'limberger'],
  'limberger': ['blaufränkish', 'lemberger'],
  'campbell early': ['island belle'],
  'island belle': ['campbell early'],
  'carignan': ['carignane'],
  'carignane': ['carignan'],
  'cinsaut (black malvoisie)': ['cinsaut', 'black malvoisie'],
  'cynthiana': ['norton'],
  'norton': ['cynthiana'],
  'durif': ['petite sirah'],
  'petite sirah': ['durif'],
  'colombard': ['french colombard'],
  'french colombard': ['colombard'],
  'fumé blanc': ['sauvignon blanc'],
  'sauvignon blanc': ['fumé blanc'],
  'garnacha': ['grenache', 'grenache noir'],
  'grenache': ['garnacha', 'grenache noir'],
  'grenache noir': ['garnacha', 'grenache'],
  'garnacha blanca': ['grenache blanc'],
  'grenache blanc': ['garnacha blanca'],
  'mataro': ['monastrell', 'mourvèdre'],
  'monastrell': ['mataro', 'mourvèdre'],
  'mourvèdre': ['mataro', 'monastrell'],
  'melon': ['melon de bourgogne'],
  'melon de bourgogne': ['melon'],
  'meunier': ['pinot meunier'],
  'pinot meunier': ['meunier'],
  'mondeuse': ['refosco'],
  'refosco': ['mondeuse'],
  'moscato greco': ['malvasia bianca'],
  'malvasia bianca': ['moscato greco'],
  'muscat blanc': ['muscat canelli'],
  'muscat canelli': ['muscat blanc'],
  'pinot grigio': ['pinot gris'],
  'pinot gris': ['pinot grigio'],
  'piquepoul blanc': ['picpoul'],
  'picpoul': ['piquepoul blanc'],
  'ravat 51': ['vignoles'],
  'vignoles': ['ravat 51'],
  'riesling': ['white riesling', 'johannisberg riesling'],
  'white riesling': ['riesling', 'johannisberg riesling'],
  'johannisberg riesling': ['riesling', 'white riesling'],
  'rkatsiteli': ['rkatziteli'],
  'rkatziteli': ['rkatsiteli'],
  'seyval': ['seyval blanc'],
  'seyval blanc': ['seyval'],
  'shiraz': ['syrah'],
  'syrah': ['shiraz'],
  'sultanina': ['thompson seedless'],
  'thompson seedless': ['sultanina'],
  'tempranillo': ['valdepeñas'],
  'valdepeñas': ['tempranillo'],
  'trebbiano': ['ugni blanc'],
  'ugni blanc': ['trebbiano'],
  // 27 CFR 4.92 alternative names still broadly recognized by consumers.
  'napa gamay': ['valdiguié'],
  'valdiguié': ['napa gamay'],
  'grey riesling': ['trousseau gris'],
  'trousseau gris': ['grey riesling'],
  'pinot chardonnay': ['chardonnay'],
  'chardonnay': ['pinot chardonnay'],
  'cabernet': ['cabernet sauvignon'],
  'cabernet sauvignon': ['cabernet'],
  'pineau de la loire': ['chenin blanc'],
  'chenin blanc': ['pineau de la loire'],
  'gutedel': ['chasselas doré'],
  'chasselas doré': ['gutedel', 'sweetwater'],
  'sweetwater': ['chasselas doré'],
  'virginia seedling': ['norton', 'cynthiana'],
  'pfeffer cabernet': ['cabernet pfeffer'],
  'cabernet pfeffer': ['pfeffer cabernet']
};

/**
 * Complete flat set of all approved varietal names (canonical + all
 * synonyms). Used when judging whether a label's class/type text is a
 * valid varietal designation that covers the intended TTB class.
 *
 * Lowercased at read time. Order-insensitive.
 */
export const APPROVED_GRAPE_VARIETIES: ReadonlySet<string> = new Set([
  'aglianico', 'agawam', 'albariño', 'alvarinho', 'albemarle', 'aleatico',
  'alicante bouschet', 'aligoté', 'alvarelhão', 'arneis', 'aurore',
  'auxerrois', 'bacchus', 'baco blanc', 'baco noir', 'barbera', 'beacon',
  'beclan', 'bellandais', 'beta', 'biancolella', 'black corinth',
  'black malvoisie', 'black monukka', 'black muscat', 'black pearl',
  'blanc du bois', 'blaufränkish', 'blue eye', 'bonarda', 'bountiful',
  'brianna', 'burgaw', 'burger', 'cabernet diane', 'cabernet doré',
  'cabernet franc', 'cabernet pfeffer', 'cabernet sauvignon', 'calzin',
  'campbell early', 'canada muscat', 'canaiolo', 'canaiolo nero',
  'captivator', 'carignan', 'carignane', 'carlos', 'carmenère', 'carmine',
  'carnelian', 'cascade', 'catawba', 'cayuga white', 'centurion',
  'chambourcin', 'chancellor', 'charbono', 'chardonel', 'chardonnay',
  'chasselas doré', 'chelois', 'chenin blanc', 'chief', 'chowan',
  'cinsaut', 'clairette blanche', 'clinton', 'colombard', 'colobel',
  'corot noir', 'cortese', 'corvina', 'concord', 'conquistador',
  'couderc noir', 'counoise', 'cowart', 'creek', 'crimson cabernet',
  'cynthiana', 'dearing', 'de chaunac', 'delaware', 'diamond', 'dixie',
  'dolcetto', 'doreen', 'dornfelder', 'dulcet', 'durif', 'dutchess',
  'early burgundy', 'early muscat', 'edelweiss', 'eden', 'ehrenfelser',
  'ellen scott', 'elvira', 'emerald riesling', 'erbaluce', 'favorite',
  'feher szagos', 'fernão pires', 'fern munson', 'fiano', 'flame tokay',
  'flora', 'florental', 'folle blanche', 'forastera', 'fredonia',
  'freedom', 'freisa', 'french colombard', 'frontenac', 'frontenac gris',
  'fumé blanc', 'furmint', 'gamay noir', 'garnacha', 'garnacha blanca',
  'garronet', 'geneva red 7', 'gewürztraminer', 'gladwin 113', 'glennel',
  'gold', 'golden isles', 'golden muscat', 'graciano', 'grand noir',
  'green hungarian', 'grenache', 'grenache blanc', 'grenache noir',
  'grignolino', 'grillo', 'gros verdot', 'grüner veltliner', 'helena',
  'herbemont', 'higgins', 'horizon', 'hunt', 'iona', 'interlaken',
  'isabella', 'island belle', 'ives', 'james', 'jewell',
  'joannes seyve 12-428', 'joannes seyve 23-416', 'kerner', 'kay gray',
  'kleinberger', 'la crescent', 'lacrosse', 'lagrein', 'lake emerald',
  'lambrusco', 'landal', 'landot noir', 'lenoir', 'léon millot',
  'lemberger', 'limberger', 'louise swenson', 'lucie kuhlmann',
  'madeline angevine', 'magnolia', 'magoon', 'malbec', 'malvasia bianca',
  'mammolo', 'maréchal foch', 'marquette', 'marsanne', 'mataro', 'melody',
  'melon', 'melon de bourgogne', 'merlot', 'meunier', 'mish', 'mission',
  'missouri riesling', 'monastrell', 'mondeuse', 'montefiore',
  'montepulciano', 'moore early', 'morio-muskat', 'moscato greco',
  'mourvèdre', 'müller-thurgau', 'münch', 'muscadelle', 'muscat blanc',
  'muscat canelli', 'muscat du moulin', 'muscat hamburg',
  'muscat of alexandria', 'muscat ottonel', 'naples', 'nebbiolo',
  'négrette', 'negrara', 'negro amaro', "nero d'avola", 'new york muscat',
  'niagara', 'noah', 'noble', 'noiret', 'norton', 'ontario',
  'orange muscat', 'palomino', 'pamlico', 'pedro ximenes', 'peloursin',
  'petit bouschet', 'petit manseng', 'petit verdot', 'petite sirah',
  'peverella', 'picpoul', 'pinotage', 'pinot blanc', 'pinot grigio',
  'pinot gris', 'pinot meunier', 'pinot noir', 'piquepoul blanc',
  'prairie star', 'precoce de malingre', 'pride', 'primitivo', 'princess',
  'rayon d’or', 'rayon d\'or', 'ravat 34', 'ravat 51', 'ravat noir',
  'redgate', 'refosco', 'regale', 'reliance', 'riesling', 'rkatsiteli',
  'rkatziteli', 'roanoke', 'rondinella', 'rosette', 'roucaneuf',
  'rougeon', 'roussanne', 'royalty', 'rubired', 'ruby cabernet',
  'st. croix', 'st. laurent', 'st. pepin', 'st. vincent', 'sabrevois',
  'sagrantino', 'saint macaire', 'salem', 'salvador', 'sangiovese',
  'sauvignon blanc', 'sauvignon gris', 'scarlet', 'scheurebe', 'sémillon',
  'semillon', 'sereksiya', 'seyval', 'seyval blanc', 'shiraz',
  'siegerrebe', 'siegfried', 'southland', 'souzão', 'steuben', 'stover',
  'sugargate', 'sultanina', 'summit', 'suwannee', 'sylvaner', 'symphony',
  'syrah', 'swenson red', 'tannat', 'tarheel', 'taylor', 'tempranillo',
  'teroldego', 'thomas', 'thompson seedless', 'tinta madeira', 'tinto cão',
  'tocai friulano', 'topsail', 'touriga', 'traminer', 'traminette',
  'trebbiano', 'trousseau', 'trousseau gris', 'ugni blanc', 'valdepeñas',
  'valdiguié', 'valerien', 'valiant', 'valvin muscat', 'van buren',
  'veeblanc', 'veltliner', 'ventura', 'verdelet', 'verdelho', 'vergennes',
  'vermentino', 'vidal blanc', 'vignoles', 'villard blanc', 'villard noir',
  'vincent', 'viognier', 'vivant', 'welsch rizling', 'watergate', 'welder',
  'white riesling', 'wine king', 'yuga', 'zinfandel', 'zinthiana',
  'zweigelt',
  // 27 CFR 4.92 — still accepted for older bottlings
  'johannisberg riesling', 'cabernet', 'grey riesling', 'napa gamay',
  'pineau de la loire', 'pinot chardonnay', 'gutedel', 'chasselas',
  'virginia seedling', 'pfeffer cabernet'
]);

/**
 * Returns the canonical form of a grape variety name (handles synonyms).
 * For synonym pairs, prefers the TTB-listed primary name (before the
 * parenthesized synonym). For unknown names returns the lowercased input.
 */
export function canonicalGrapeName(raw: string): string {
  const key = raw.toLowerCase().trim();
  // If this name has a synonym that IS in the APPROVED set, prefer the
  // first one in lexicographic order for determinism.
  const synonyms = GRAPE_VARIETY_SYNONYMS[key];
  if (!synonyms || synonyms.length === 0) return key;
  const candidates = [key, ...synonyms].sort();
  return candidates[0]!;
}

/** Case-insensitive membership test against the full approved set. */
export function isApprovedVarietal(name: string): boolean {
  return APPROVED_GRAPE_VARIETIES.has(name.toLowerCase().trim());
}

/**
 * Returns true when two grape-variety names resolve to the same canonical
 * entry — e.g. "Syrah" vs "Shiraz", "Pinot Gris" vs "Pinot Grigio",
 * "Cabernet" vs "Cabernet Sauvignon", "Johannisberg Riesling" vs
 * "Riesling". Returns false for unrelated varietals or unknown strings.
 */
export function areVarietalsEquivalent(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return true;
  const synonymsOfA = GRAPE_VARIETY_SYNONYMS[na] ?? [];
  if (synonymsOfA.includes(nb)) return true;
  const synonymsOfB = GRAPE_VARIETY_SYNONYMS[nb] ?? [];
  if (synonymsOfB.includes(na)) return true;
  return false;
}
