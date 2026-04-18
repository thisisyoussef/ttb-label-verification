/**
 * Geographic containment table for country-of-origin judgment.
 *
 * The COLA form captures country-of-origin at the sovereign level
 * ("USA", "France"). Labels typically use a more specific designation:
 * a state, a wine region, an AVA, a producer address city. "California"
 * on the label with "USA" on the form is NOT a mismatch — it's a
 * MORE SPECIFIC designation that's CONSISTENT with the declared country.
 *
 * This module encodes:
 *   1. Aliases — native-language or common-abbreviation forms of the
 *      sovereign name (USA ↔ United States ↔ America, España ↔ Spain).
 *   2. Containment — state/region/AVA → parent country. If the label
 *      text matches any listed subdivision of the COLA country, the
 *      country check passes.
 *
 * When a label shows a new subdivision we don't cover, the pipeline
 * falls through to LLM judgment. The table here encodes the ones
 * common enough that every ambiguity round-trip to the LLM would be
 * wasteful.
 */

/**
 * Sovereign country → set of aliases. Case-insensitive. One hop only;
 * don't chain aliases.
 */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  'united states': [
    'united states', 'usa', 'u.s.a.', 'us', 'u.s.', 'america',
    'american', 'united states of america'
  ],
  france: [
    'france', 'french', 'produit de france', 'republique francaise',
    'république française'
  ],
  italy: [
    'italy', 'italia', 'italian', 'prodotto in italia', 'made in italy'
  ],
  spain: [
    'spain', 'españa', 'espana', 'spanish', 'producto de españa',
    'producto de espana'
  ],
  germany: [
    'germany', 'deutschland', 'german', 'produkt aus deutschland',
    'federal republic of germany'
  ],
  portugal: [
    'portugal', 'portugues', 'portuguese', 'produto de portugal'
  ],
  mexico: [
    'mexico', 'méxico', 'mexican', 'hecho en mexico', 'producto de mexico'
  ],
  canada: [
    'canada', 'canadian', 'produit du canada', 'product of canada'
  ],
  scotland: [
    'scotland', 'scotch', 'scottish', 'product of scotland'
  ],
  ireland: [
    'ireland', 'irish', 'product of ireland'
  ],
  australia: [
    'australia', 'australian', 'product of australia'
  ],
  'new zealand': [
    'new zealand', 'nz', 'product of new zealand'
  ],
  chile: [
    'chile', 'chilean', 'producto de chile'
  ],
  argentina: [
    'argentina', 'argentinian', 'argentine', 'producto de argentina'
  ],
  'south africa': [
    'south africa', 'south african'
  ],
  japan: [
    'japan', 'japanese', 'nihon', 'made in japan'
  ],
  greece: [
    'greece', 'greek', 'hellas'
  ],
  hungary: [
    'hungary', 'magyar', 'hungarian'
  ]
};

/**
 * Country → set of recognized subdivisions (states, provinces, regions,
 * AVAs, wine appellations, city + country-identifying addresses).
 *
 * When the label shows any of these strings AND the COLA form says the
 * parent country, the country check passes.
 *
 * Intentionally selective — this isn't exhaustive. We cover the
 * subdivisions that commonly appear on TTB labels. Long-tail cases
 * fall through to LLM judgment.
 */
export const COUNTRY_SUBDIVISIONS: Record<string, Set<string>> = {
  'united states': new Set([
    // State names
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
    'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
    'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
    'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
    'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new hampshire', 'new jersey', 'new mexico', 'new york',
    'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
    'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
    'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
    'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
    'puerto rico',
    // State postal abbreviations (uppercase in many cases but we
    // lowercase the label text; the abbreviations appear in
    // "City, XX" address lines).
    ' al', ' ak', ' az', ' ar', ' ca', ' co', ' ct', ' de', ' fl',
    ' ga', ' hi', ' id', ' il', ' in', ' ia', ' ks', ' ky', ' la',
    ' me', ' md', ' ma', ' mi', ' mn', ' ms', ' mo', ' mt', ' ne',
    ' nv', ' nh', ' nj', ' nm', ' ny', ' nc', ' nd', ' oh', ' ok',
    ' or', ' pa', ' ri', ' sc', ' sd', ' tn', ' tx', ' ut', ' vt',
    ' va', ' wa', ' wv', ' wi', ' wy',
    // Major AVAs / wine regions
    'napa valley', 'napa', 'sonoma', 'sonoma valley', 'sonoma coast',
    'russian river valley', 'alexander valley', 'dry creek valley',
    'paso robles', 'santa barbara', 'santa ynez valley',
    'santa rita hills', 'santa maria valley', 'mendocino',
    'anderson valley', 'carneros', 'lodi', 'sierra foothills',
    'willamette valley', 'columbia valley', 'walla walla valley',
    'columbia gorge', 'yakima valley', 'red mountain', 'finger lakes',
    'long island', 'north fork of long island', 'hudson river region',
    'virginia', 'monticello', 'central virginia',
    // Distillery / brewery states commonly cited
    'bourbon county', 'frankfort', 'louisville', 'lexington',
    'kentucky', 'tennessee', 'lynchburg'
  ]),
  france: new Set([
    // Wine regions
    'burgundy', 'bourgogne', 'bordeaux', 'champagne', 'alsace',
    'loire', 'loire valley', 'rhône', 'rhone', 'rhône valley',
    'provence', 'languedoc', 'languedoc-roussillon', 'roussillon',
    'beaujolais', 'côte du rhône', 'cotes du rhone',
    'cote de nuits', 'cote de beaune', 'chablis', 'côte de beaune',
    'côte de nuits', 'medoc', 'médoc', 'haut-médoc', 'haut medoc',
    'saint-émilion', 'saint emilion', 'pomerol', 'sauternes',
    'graves', 'pessac-léognan', 'pauillac', 'saint-julien',
    'saint-estèphe', 'margaux', 'cognac', 'armagnac',
    'jura', 'savoie', 'corsica', 'corse',
    // Big cities
    'paris', 'reims', 'epernay', 'bordeaux', 'beaune', 'dijon',
    'lyon', 'marseille', 'strasbourg'
  ]),
  italy: new Set([
    // Regions
    'tuscany', 'toscana', 'piedmont', 'piemonte', 'veneto',
    'friuli', 'friuli-venezia giulia', 'trentino', 'alto adige',
    'trentino-alto adige', 'emilia-romagna', 'lombardy', 'lombardia',
    'sicily', 'sicilia', 'sardinia', 'sardegna', 'abruzzo', 'apulia',
    'puglia', 'campania', 'calabria', 'umbria', 'marche',
    'liguria', 'lazio', 'molise', 'basilicata',
    // DOCG / DOC regions
    'chianti', 'chianti classico', 'brunello di montalcino',
    'montalcino', 'montepulciano', 'vino nobile di montepulciano',
    'barolo', 'barbaresco', 'asti', 'gavi', 'soave', 'valpolicella',
    'amarone', 'prosecco', 'franciacorta', 'bardolino',
    // Cities
    'rome', 'milan', 'florence', 'venice', 'naples', 'turin',
    'bologna', 'verona', 'siena'
  ]),
  spain: new Set([
    // Regions
    'rioja', 'ribera del duero', 'priorat', 'priorato', 'rueda',
    'rías baixas', 'rias baixas', 'albariño', 'jerez', 'sherry',
    'cava', 'penedès', 'penedes', 'catalonia', 'cataluña',
    'valencia', 'andalucía', 'andalusia', 'galicia', 'castile',
    'castilla y león', 'castilla la mancha', 'la mancha',
    'toro', 'bierzo', 'jumilla', 'navarra', 'aragón',
    // Cities
    'madrid', 'barcelona', 'seville', 'sevilla', 'valencia',
    'bilbao', 'logroño', 'logrono', 'tarragona'
  ]),
  germany: new Set([
    // Wine regions
    'mosel', 'mosel-saar-ruwer', 'rheingau', 'rheinhessen',
    'pfalz', 'rheinpfalz', 'baden', 'württemberg', 'wurttemberg',
    'franken', 'franconia', 'nahe', 'ahr', 'mittelrhein',
    'saale-unstrut', 'sachsen',
    // Cities / villages often on labels
    'trier', 'mainz', 'munich', 'berlin', 'hamburg', 'cologne',
    'bernkastel', 'piesport', 'rüdesheim', 'rudesheim', 'johannisberg'
  ]),
  portugal: new Set([
    'douro', 'alentejo', 'vinho verde', 'dão', 'dao',
    'bairrada', 'madeira', 'porto', 'oporto', 'lisbon', 'lisboa'
  ]),
  scotland: new Set([
    'highland', 'highlands', 'speyside', 'islay', 'campbeltown',
    'lowland', 'lowlands', 'islands', 'edinburgh', 'glasgow',
    'inverness'
  ]),
  mexico: new Set([
    'jalisco', 'oaxaca', 'tamaulipas', 'tequila', 'arandas',
    'los altos', 'guadalajara'
  ]),
  argentina: new Set([
    'mendoza', 'salta', 'san juan', 'patagonia', 'cafayate',
    'lujan de cuyo', 'lujan', 'uco valley'
  ]),
  chile: new Set([
    'maipo valley', 'maipo', 'colchagua', 'aconcagua', 'casablanca',
    'elqui', 'limarí', 'limari', 'curicó', 'curico', 'maule',
    'santiago'
  ]),
  australia: new Set([
    'barossa', 'barossa valley', 'mclaren vale', 'coonawarra',
    'margaret river', 'yarra valley', 'hunter valley', 'eden valley',
    'clare valley', 'adelaide hills', 'tasmania', 'victoria',
    'new south wales', 'south australia', 'western australia'
  ]),
  'new zealand': new Set([
    'marlborough', 'central otago', 'hawkes bay', "hawke's bay",
    'martinborough', 'gisborne', 'canterbury', 'auckland', 'wellington'
  ]),
  greece: new Set([
    'attica', 'peloponnese', 'santorini', 'crete', 'macedonia',
    'nemea', 'naoussa', 'samos'
  ])
};

/**
 * True when two country-of-origin strings refer to the same sovereign.
 * Covers alias table (USA ↔ United States) and containment
 * (California → USA, Burgundy → France, Napa Valley → USA).
 *
 * The comparison is bidirectional — it doesn't matter whether the
 * COLA side or the label side has the more specific designation.
 */
export function isCountryOrSubdivisionEquivalent(
  a: string,
  b: string
): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;

  // Step 1: reduce each side to a canonical sovereign (if possible).
  const canonicalA = resolveSovereign(na);
  const canonicalB = resolveSovereign(nb);
  if (canonicalA && canonicalB && canonicalA === canonicalB) return true;

  // Step 2: containment — one side is the sovereign, the other is a
  // subdivision of it. Try both directions.
  if (canonicalA) {
    const subs = COUNTRY_SUBDIVISIONS[canonicalA];
    if (subs && [...subs].some((sub) => nb.includes(sub) || sub.includes(nb))) {
      return true;
    }
  }
  if (canonicalB) {
    const subs = COUNTRY_SUBDIVISIONS[canonicalB];
    if (subs && [...subs].some((sub) => na.includes(sub) || sub.includes(na))) {
      return true;
    }
  }

  // Step 3: substring tolerance for "Made in the USA" / "Product of
  // France" / "Wine of California" kinds of phrasings.
  if (canonicalA) {
    const aliasesA = COUNTRY_ALIASES[canonicalA] ?? [];
    if (aliasesA.some((alias) => nb.includes(alias))) return true;
  }
  if (canonicalB) {
    const aliasesB = COUNTRY_ALIASES[canonicalB] ?? [];
    if (aliasesB.some((alias) => na.includes(alias))) return true;
  }

  return false;
}

/**
 * Return the canonical sovereign key for a raw country string. Tries
 * exact match, then alias lookup, then subdivision lookup. Returns
 * null when the string doesn't match any known country.
 */
export function resolveSovereign(raw: string): string | null {
  const norm = raw.toLowerCase().trim();
  if (COUNTRY_ALIASES[norm]) return norm;
  for (const [sovereign, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.includes(norm)) return sovereign;
    if (aliases.some((a) => norm.includes(a))) return sovereign;
  }
  for (const [sovereign, subs] of Object.entries(COUNTRY_SUBDIVISIONS)) {
    if ([...subs].some((sub) => norm === sub || norm.includes(sub))) {
      return sovereign;
    }
  }
  return null;
}
