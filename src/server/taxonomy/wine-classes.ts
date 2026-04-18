/**
 * TTB wine class/type taxonomy per BAM Chapter 5 + 27 CFR Part 4.
 *
 * What this encodes:
 *   - The coarse CLASS axis (grape wine, citrus wine, fruit wine,
 *     sparkling wine, dessert wine, aperitif wine, etc.)
 *   - Common TYPE designations under each class (red wine, port,
 *     sherry, champagne, etc.)
 *   - Semi-generic geographic designations (Burgundy, Chablis,
 *     Champagne, Chianti, Marsala, Madeira, Port, Sherry, etc.)
 *   - Foreign distinctive designations per 27 CFR Part 12 Subpart D
 *     (Bernkasteler Doctor, Liebfraumilch, Mosel, etc.)
 *
 * The taxonomy is expressed as `TTB class key → acceptable label text
 * variants`. The key itself is what the COLA form says; the values
 * include native-language, varietal, and semi-generic equivalents a
 * label might use.
 *
 * NOT authoritative — the regulations are. When a product mismatch
 * surfaces a pattern we don't cover, it should route to LLM judgment
 * (see judgment-field-rules.ts country-ambiguous rule) rather than
 * forcing new entries here one-off.
 */

/**
 * Grape Dessert wine semi-generics per 27 CFR 4.24(b)(2). These are
 * sufficient as class-and-type designations, and each is a type of
 * grape DESSERT WINE (not a standalone class). "SHERRY" on the label
 * with "table white wine" on the form is a mismatch — but "SHERRY"
 * with "dessert wine" is equivalent.
 */
export const GRAPE_DESSERT_SEMIGENERICS = new Set([
  'sherry', 'light sherry', 'angelica', 'light angelica',
  'madeira', 'light madeira', 'port', 'light port',
  'muscatel', 'light muscatel'
]);

/**
 * Semi-generic grape wine designations per 27 CFR 4.24(b)(1). These
 * are generic TYPEs of grape wine and sufficient as class-and-type.
 * Origin is usually the named country unless grandfathered under
 * 26 USC 5388(c).
 */
export const GRAPE_WINE_SEMIGENERICS = new Set([
  'burgundy', 'chablis', 'chianti', 'claret', 'malaga', 'marsala',
  'moselle', 'rhine wine', 'hock', 'sauterne', 'haut sauterne', 'tokay'
]);

/**
 * Sparkling grape wine semi-generic: "Champagne" specifically. Must
 * carry an appellation of origin on American wines if the grandfather
 * clause doesn't apply.
 */
export const SPARKLING_SEMIGENERICS = new Set([
  'champagne', 'sparkling wine', 'bulk process champagne'
]);

/**
 * Additional sparkling/effervescent designations that are type-
 * sufficient without the semi-generic "Champagne" framing. Per
 * 27 CFR 4.21(b)(4).
 */
export const SPARKLING_TYPES = new Set([
  'crackling wine', 'petillant wine', 'frizzante wine', 'cremant wine',
  'perlant wine', 'recioto wine', 'bulk process crackling wine'
]);

/**
 * Citrus / fruit / agricultural wine types. For these, the TYPE
 * designation must name the specific fruit (e.g. "Orange Wine",
 * "Blueberry Dessert Wine", "Raisin Wine"), so the taxonomy is
 * open-ended — we accept any `{fruit} wine` / `{fruit} dessert wine`
 * form as equivalent to the corresponding class.
 */
export const NON_GRAPE_WINE_TYPE_KEYWORDS = new Set([
  'cider', 'apple wine', 'perry', 'pear wine', 'strawberry wine',
  'blueberry wine', 'raspberry wine', 'cherry wine', 'peach wine',
  'plum wine', 'apricot wine', 'pomegranate wine', 'elderberry wine',
  'cranberry wine', 'mead', 'honey wine', 'saké', 'sake', 'rice wine',
  'raisin wine', 'dandelion wine'
]);

/**
 * Foreign nongeneric names per 27 CFR 4.24(c) + Part 12 Subpart D.
 * These are recognized regional designations that are sufficient as
 * class-and-type on wines from their respective countries.
 *
 * Comparing to COLA form: if the form says "table white wine" and the
 * label says "Liebfraumilch", they're equivalent — Liebfraumilch IS
 * a valid type designation for a German grape wine.
 *
 * Grouped by country so we can combine class/type equivalence with
 * country-of-origin judgment.
 */
export const FOREIGN_NONGENERIC_BY_COUNTRY: Record<string, Set<string>> = {
  germany: new Set([
    'bernkasteler doctor', 'bernkasteler doktor', 'deidesheimer',
    'dexheimer doktor', 'erbacher marcobrunn', 'forster',
    'forster jesuitengarten', 'graacher himmelreich', 'liebfraumilch',
    'liebfrauenmilch', 'mosel', 'mosel-saar-ruwer', 'ockfener bockstein',
    'piesporter goldtropfchen', 'piesporter michelsberg',
    'piesporter treppchen', 'rudesheimer', 'scharzhofberger',
    'schloss johannisberger', 'schloss vollrads', 'wehlener sonnenuhr',
    'zeller schwarze katz'
  ]),
  france: new Set([
    'aloxe-corton', 'alsace', "vin d'alsace", 'anjou', 'barsac',
    'batard-montrachet', 'beaujolais', 'beaujolais villages', 'beaune',
    'bonnes mares', 'bordeaux', 'bordeaux blanc', 'bordeaux rouge',
    'bourgogne', 'brouilly', 'chambertin', 'chambolle-musigny',
    'charmes-chambertin', 'chassagne-montrachet', 'chateau lafite',
    'chateau margaux', 'chateau yquem', 'chateauneuf-du-pape', 'chenas',
    'chevalier-montrachet', 'chiroubles', 'clos de la roche',
    'clos de vougeot', 'corton', 'corton-charlemagne', 'cote de beaune',
    'cote de beaune-villages', 'cote de brouilly', 'cote de nuits',
    'cote de nuits-villages', 'cote rotie', 'coteaux du layon',
    'cotes du rhone', 'echezeaux', 'entre-deux-mers', 'fleurie',
    'gevrey-chambertin', 'grands echezeaux', 'graves', 'haut medoc',
    'hermitage', 'la tache', 'loire', 'macon', 'margaux', 'medoc',
    'mercurey', 'meursault', 'montrachet', 'morgon', 'moulin-a-vent',
    'muscadet', 'musigny', 'nuits', 'nuits-saint-georges', 'pauillac',
    'pomerol', 'pommard', 'pouilly-fuisse', 'pouilly fume',
    'puligny-montrachet', 'rhone', 'richebourg', 'romanee-conti',
    'romanee saint-vivant', "rose d'anjou", 'saint-amour', 'saint-emilion',
    'saint-estephe', 'saint-julien', 'sancerre', 'santenay', 'saumur',
    'savigny', 'savigny-les-beaunes', 'tavel', 'touraine', 'volnay',
    'vosne-romanee', 'vouvray'
  ]),
  italy: new Set([
    'asti spumante', 'barbaresco', "barbera d'alba", "barbera d'asti",
    'bardolino', 'barolo', 'brunello di montalcino', "dolcetto d'alba",
    'frascati', 'gattinara', 'lacryma christi', "nebbiolo d'alba",
    'orvieto', 'soave', 'valpolicella', 'vino nobile de montepulciano'
  ]),
  portugal: new Set([
    'dao', 'oporto', 'porto', 'vinho do porto'
  ]),
  spain: new Set([
    'lagrima', 'rioja'
  ])
};

/**
 * Flat lookup of ALL foreign nongeneric names across countries. Used
 * when the judgment engine needs "is this string a recognized wine
 * designation?" without yet knowing the country context.
 */
export const ALL_FOREIGN_NONGENERIC_NAMES: ReadonlySet<string> = new Set([
  ...GRAPE_WINE_SEMIGENERICS,
  ...SPARKLING_SEMIGENERICS,
  ...GRAPE_DESSERT_SEMIGENERICS,
  ...Object.values(FOREIGN_NONGENERIC_BY_COUNTRY).flatMap((set) => [...set])
]);

/**
 * The broad classes defined in 27 CFR Part 4 + BAM Chapter 5. Used to
 * group the narrower types. Values are label-text variants acceptable
 * for the class.
 */
export const WINE_CLASS_ALIASES: Record<string, string[]> = {
  'grape wine': [
    'wine', 'grape wine', 'red wine', 'white wine', 'rosé wine', 'rose wine',
    'pink wine', 'amber wine', 'vin', 'vino', 'wein', 'vino rosso',
    'vino blanco', 'vin rouge', 'vin blanc', 'rotwein', 'weisswein'
  ],
  'table wine': [
    'table wine', 'light wine', 'wine', 'vino da tavola', 'vin de table'
  ],
  'table red wine': [
    'red wine', 'red table wine', 'vin rouge', 'vino rosso', 'rotwein'
  ],
  'table white wine': [
    'white wine', 'white table wine', 'vin blanc', 'vino blanco', 'weisswein'
  ],
  'dessert wine': [
    'dessert wine', 'fortified wine', 'late harvest', 'ice wine',
    ...GRAPE_DESSERT_SEMIGENERICS
  ],
  'sparkling wine': [
    'sparkling wine', 'sparkling grape wine', 'espumoso', 'spumante', 'sekt',
    ...SPARKLING_SEMIGENERICS,
    ...SPARKLING_TYPES
  ],
  'carbonated wine': [
    'carbonated wine', 'carbonated grape wine'
  ],
  'citrus wine': [
    'citrus wine', 'orange wine', 'orange-lemon wine'
  ],
  'fruit wine': [
    'fruit wine', 'berry wine',
    ...NON_GRAPE_WINE_TYPE_KEYWORDS
  ],
  'aperitif wine': [
    'aperitif wine', 'vermouth'
  ],
  'retsina wine': [
    'retsina'
  ]
};

/**
 * Return true when a label-text class/type is acceptable for a given
 * TTB class key. Covers the aliases table, semi-generic designations,
 * and foreign nongeneric names. Does NOT resolve varietal names — the
 * caller should combine this with isApprovedVarietal() for the full
 * check.
 */
export function isWineClassEquivalent(ttbClass: string, labelText: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  const ttb = norm(ttbClass);
  const label = norm(labelText);
  if (ttb === label) return true;
  const aliases = WINE_CLASS_ALIASES[ttb];
  if (aliases && aliases.some((a) => label === norm(a) || label.includes(norm(a)) || norm(a).includes(label))) {
    return true;
  }
  // If the TTB class is a wine class, any foreign nongeneric designation
  // of wine is acceptable as a type. The COUNTRY judgment catches a
  // geography mismatch separately.
  if (ttb.includes('wine') && ALL_FOREIGN_NONGENERIC_NAMES.has(label)) {
    return true;
  }
  return false;
}

/**
 * True when the named wine is on an American bottle. German Prädikat
 * terms (Kabinett, Spätlese, etc.) per 27 CFR 4.39 CANNOT be used on
 * American wines. This is a STYLE check invoked only when country of
 * origin is US.
 */
export const PRADIKAT_TERMS = new Set([
  'kabinett', 'spätlese', 'spatlese', 'auslese', 'beerenauslese',
  'trockenbeerenauslese', 'eiswein'
]);

/**
 * True when label text claims a German Prädikat designation that
 * cannot legally appear on an American wine.
 */
export function isInvalidPradikatOnAmericanWine(
  country: string,
  labelText: string
): boolean {
  const c = country.toLowerCase().trim();
  const isAmerican = c === 'united states' || c === 'usa' || c === 'u.s.a.' ||
    c === 'us' || c === 'u.s.' || c === 'america' || c === 'american';
  if (!isAmerican) return false;
  const tokens = labelText.toLowerCase().split(/[\s.,\-—]+/);
  return tokens.some((tok) => PRADIKAT_TERMS.has(tok));
}
