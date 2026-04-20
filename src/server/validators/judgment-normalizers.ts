/**
 * Composable normalization pipeline for field comparison.
 *
 * Each normalizer is a pure function: string → string.
 * The pipeline chains applicable normalizers for a given field
 * and returns normalized values + a log of which transforms fired.
 */

const DIACRITICAL_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ñ': 'n', 'ç': 'c', 'ý': 'y', 'ÿ': 'y',
  'ø': 'o', 'æ': 'ae', 'ß': 'ss'
};

export function normalizeCase(value: string): string {
  return value.toLowerCase();
}

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
}

export function normalizePunctuation(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')   // curly double quotes
    .replace(/[\u2013\u2014]/g, '-')                // em/en dash
    .replace(/\.{2,}/g, '.')                        // collapsed periods
    .replace(/[^\x20-\x7E\u00C0-\u024F]/g, '');    // strip non-printable/non-latin
}

export function normalizeDiacriticals(value: string): string {
  let result = '';
  for (const char of value) {
    result += DIACRITICAL_MAP[char.toLowerCase()] !== undefined
      ? (char === char.toUpperCase()
        ? DIACRITICAL_MAP[char.toLowerCase()].toUpperCase()
        : DIACRITICAL_MAP[char])
      : char;
  }
  return result;
}

/** Parse a numeric value from a string, ignoring units and formatting. */
export function parseNumericValue(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/**
 * Extract ABV percentage from any format:
 * "40% Alc./Vol.", "40% ALC./VOL.", "80 Proof", "Alc. 40% Vol.", "40% by vol."
 */
export function parseAbvPercent(value: string): number | null {
  // Try percentage pattern first
  const pctMatch = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) return Number(pctMatch[1]);

  // Try proof pattern (ABV = proof / 2)
  const proofMatch = value.match(/(\d+(?:\.\d+)?)\s*proof/i);
  if (proofMatch) return Number(proofMatch[1]) / 2;

  return null;
}

/** Parse net contents to milliliters for comparison. */
export function parseNetContentsML(value: string): number | null {
  const num = parseNumericValue(value);
  if (num === null) return null;

  const lower = value.toLowerCase();

  if (/\bcl\b/.test(lower)) return num * 10;
  if (/\bl\b|\blitre|\bliter/.test(lower)) return num * 1000;
  if (/\bml\b/.test(lower)) return num;
  if (/\bgal/.test(lower)) return num * 3785.41;
  if (/\bpint/.test(lower)) return num * 473.176;
  if (/\bfl\.?\s*oz\b/.test(lower)) return num * 29.5735;
  if (/\boz\b/.test(lower)) return num * 29.5735;

  // If just a number with mL-range magnitude, assume mL
  if (num >= 50 && num <= 5000) return num;

  return null;
}

/** Strip known prefixes from field values. */
export function stripFieldPrefixes(value: string): string {
  return value
    .replace(/^net\s+cont(?:ents?)?\.?\s*/i, '')
    .replace(/^product\s+of\s+/i, '')
    .replace(/^produced?\s+(?:in|by)\s+/i, '')
    .replace(/^distilled\s+(?:in|by)\s+/i, '')
    .replace(/^bottled\s+(?:in|by)\s+/i, '')
    .replace(/^imported\s+by\s+/i, '')
    .replace(/^alcohol\s*/i, '')
    .trim();
}

/** Normalize ampersand/and equivalence. */
export function normalizeAmpersand(value: string): string {
  return value.replace(/\s*&\s*/g, ' and ');
}

/** Strip "The" prefix from brand names. */
export function stripThePrefix(value: string): string {
  return value.replace(/^the\s+/i, '');
}

/**
 * Strip decorative inner punctuation that's almost always a
 * formatting variation, not an identity difference, in brand names.
 *
 *   "A.C.'s"            → "AC's"          (periods between initials)
 *   "Dr. McGillicuddy"  → "Dr McGillicuddy" (trailing period)
 *   "J & B"             → "J & B" (preserved — & has its own rule)
 *   "Half-Acre"         → "HalfAcre"      (decorative hyphen)
 *
 * Preserved on purpose:
 *   - apostrophe (')   — possessives are a real difference, handled
 *                        by the separate `normalizePossessive` rule
 *                        in the brand cascade.
 *   - ampersand (&)    — handled by `normalizeAmpersand`.
 *   - whitespace       — preserved so the space-collapsed rule can
 *                        independently detect "Stone Wood" vs
 *                        "Stonewood".
 *
 * The result is intentionally NOT lowercased — case is a separate
 * normalization step downstream so the cascade can still report a
 * case-only-difference rule.
 */
export function stripBrandDecorativePunctuation(value: string): string {
  // Drop periods, commas, semicolons, colons, hyphens, en/em dashes
  // already covered by normalizePunctuation, plain ASCII parens, and
  // the slash. Apostrophes and ampersands are intentionally NOT in
  // this character class.
  return value.replace(/[.,;:\-()\/\\]/g, '');
}

export type NormalizationResult = {
  appNormalized: string;
  extNormalized: string;
  transformsApplied: string[];
};

/**
 * Run the full normalization pipeline on a pair of values.
 * Returns normalized values and a log of which transforms fired.
 */
export function runNormalizationPipeline(
  appValue: string,
  extValue: string
): NormalizationResult {
  const transforms: string[] = [];
  let app = appValue;
  let ext = extValue;

  const apply = (name: string, fn: (v: string) => string) => {
    const newApp = fn(app);
    const newExt = fn(ext);
    if (newApp !== app || newExt !== ext) {
      transforms.push(name);
    }
    app = newApp;
    ext = newExt;
  };

  apply('whitespace', normalizeWhitespace);
  apply('punctuation', normalizePunctuation);
  apply('diacriticals', normalizeDiacriticals);
  apply('ampersand', normalizeAmpersand);
  apply('prefixes', stripFieldPrefixes);
  apply('case', normalizeCase);

  return { appNormalized: app, extNormalized: ext, transformsApplied: transforms };
}
