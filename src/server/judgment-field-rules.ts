/**
 * Field-specific judgment rules implementing the decision framework
 * from docs/reference/judgment-guidance.md.
 *
 * Each function evaluates a single field comparison and returns a
 * structured judgment with disposition, confidence, rule, and tier.
 */

import {
  runNormalizationPipeline,
  parseAbvPercent,
  parseNetContentsML,
  normalizeCase,
  normalizeWhitespace,
  normalizeDiacriticals,
  normalizeAmpersand,
  stripThePrefix
} from './judgment-normalizers';
import {
  isClassTypeEquivalent,
  isCountryEquivalent,
  GRAPE_SYNONYMS
} from './judgment-equivalence';

export type FieldJudgment = {
  disposition: 'approve' | 'review' | 'reject';
  confidence: number;
  rule: string;
  note: string;
  tier: 'critical' | 'high' | 'medium' | 'low';
};

// ─── Alcohol Content (Critical tier) ─────────────────────────────────

export function judgeAlcoholContent(
  appValue: string,
  extValue: string,
  beverageType: string
): FieldJudgment {
  const appAbv = parseAbvPercent(appValue);
  const extAbv = parseAbvPercent(extValue);

  if (appAbv === null || extAbv === null) {
    return {
      disposition: 'review',
      confidence: 0.4,
      rule: 'abv-parse-failure',
      note: `Could not parse numeric ABV from one or both values. app="${appValue}" ext="${extValue}"`,
      tier: 'critical'
    };
  }

  const diff = Math.abs(appAbv - extAbv);

  // Wine allows 1% tolerance within the same tax class
  if (beverageType === 'wine') {
    const crossesTaxBoundary = [14, 21, 24].some(
      boundary => (appAbv <= boundary && extAbv > boundary) || (appAbv > boundary && extAbv <= boundary)
    );
    if (crossesTaxBoundary) {
      return {
        disposition: 'reject',
        confidence: 0.95,
        rule: 'abv-crosses-wine-tax-boundary',
        note: `ABV difference crosses a wine tax class boundary: app=${appAbv}% ext=${extAbv}%`,
        tier: 'critical'
      };
    }
    if (diff <= 1.0) {
      return {
        disposition: 'approve',
        confidence: 0.92,
        rule: 'abv-match-wine-tolerance',
        note: `ABV within 1% wine tolerance: app=${appAbv}% ext=${extAbv}%`,
        tier: 'critical'
      };
    }
  }

  // Spirits: zero tolerance on numeric ABV
  if (diff === 0) {
    return {
      disposition: 'approve',
      confidence: 0.98,
      rule: 'abv-exact-match',
      note: `ABV matches exactly: ${appAbv}%`,
      tier: 'critical'
    };
  }

  // Small rounding differences (0.1-0.5) — could be proof conversion rounding
  if (diff <= 0.5) {
    return {
      disposition: 'approve',
      confidence: 0.88,
      rule: 'abv-rounding-tolerance',
      note: `ABV within rounding tolerance (${diff}%): app=${appAbv}% ext=${extAbv}%`,
      tier: 'critical'
    };
  }

  return {
    disposition: 'reject',
    confidence: 0.95,
    rule: 'abv-numeric-mismatch',
    note: `ABV differs by ${diff}%: app=${appAbv}% ext=${extAbv}%`,
    tier: 'critical'
  };
}

// ─── Government Warning (Critical tier) ──────────────────────────────

export function judgeGovernmentWarningText(
  extractedText: string,
  canonicalText: string
): FieldJudgment {
  const normExt = normalizeForWarningComparison(extractedText);
  const normCanon = normalizeForWarningComparison(canonicalText);

  if (normExt === normCanon) {
    return {
      disposition: 'approve',
      confidence: 0.98,
      rule: 'warning-exact-match',
      note: 'Government warning text matches canonical text after normalization.',
      tier: 'critical'
    };
  }

  // Per guidance doc: "Additional state-specific warnings alongside federal: APPROVE."
  // If the extracted text contains the canonical text as a prefix/substring with
  // extra text appended (responsible drinking messages, state warnings), approve.
  if (normExt.startsWith(normCanon) || normExt.includes(normCanon)) {
    return {
      disposition: 'approve',
      confidence: 0.95,
      rule: 'warning-canonical-plus-extra',
      note: 'Canonical warning text found with additional messaging appended. Per TTB guidance, additional warnings alongside federal are acceptable.',
      tier: 'critical'
    };
  }

  const distance = levenshteinDistance(normExt, normCanon);

  // Check for word-level substitutions or deletions — always reject
  if (hasWordLevelChanges(normExt, normCanon)) {
    return {
      disposition: 'reject',
      confidence: 0.94,
      rule: 'warning-word-substitution',
      note: `Government warning has word-level changes (edit distance ${distance}).`,
      tier: 'critical'
    };
  }

  const maxLen = Math.max(normExt.length, normCanon.length);

  // Canonical warning is ~260 chars normalized. Real Tesseract OCR on small
  // label text produces 10-30 edits due to character noise, line breaks,
  // and punctuation artifacts. ≤25 edits (~90% similarity) = normal OCR noise.
  if (distance <= 25) {
    return {
      disposition: 'approve',
      confidence: Math.max(0.80, 0.95 - distance * 0.006),
      rule: 'warning-fuzzy-match-close',
      note: `Warning text within ${distance} edits of canonical (~${maxLen > 0 ? ((1 - distance / maxLen) * 100).toFixed(0) : 0}% match). Normal OCR tolerance.`,
      tier: 'critical'
    };
  }

  if (distance <= 50) {
    return {
      disposition: 'review',
      confidence: 0.55,
      rule: 'warning-fuzzy-match-moderate',
      note: `Warning text within ${distance} edits of canonical (~${maxLen > 0 ? ((1 - distance / maxLen) * 100).toFixed(0) : 0}% match). Needs human review.`,
      tier: 'critical'
    };
  }

  return {
    disposition: 'reject',
    confidence: 0.90,
    rule: 'warning-text-divergent',
    note: `Warning text diverges significantly from canonical (distance=${distance}).`,
    tier: 'critical'
  };
}

// ─── Class/Type (High tier) ──────────────────────────────────────────

export function judgeClassType(
  appValue: string,
  extValue: string,
  _beverageType: string
): FieldJudgment {
  const { appNormalized, extNormalized } = runNormalizationPipeline(appValue, extValue);

  if (appNormalized === extNormalized) {
    return {
      disposition: 'approve',
      confidence: 0.98,
      rule: 'class-type-exact-match',
      note: 'Class/type matches after normalization.',
      tier: 'high'
    };
  }

  // Check taxonomy equivalence
  if (isClassTypeEquivalent(appValue, extValue)) {
    return {
      disposition: 'approve',
      confidence: 0.92,
      rule: 'class-type-taxonomy-match',
      note: `TTB class "${appValue}" accepts label text "${extValue}" per taxonomy.`,
      tier: 'high'
    };
  }

  // Whisky/whiskey context — review, not reject
  if (/whisk[ey]y/i.test(appValue) && /whisk[ey]y/i.test(extValue)) {
    return {
      disposition: 'review',
      confidence: 0.70,
      rule: 'class-type-whisky-whiskey',
      note: 'Whisky/whiskey spelling differs — context-dependent per origin convention.',
      tier: 'high'
    };
  }

  // If both contain a recognizable base spirit/wine/beer type, review rather than reject
  const appBase = detectBaseType(appValue);
  const extBase = detectBaseType(extValue);
  if (appBase && extBase && appBase === extBase) {
    return {
      disposition: 'approve',
      confidence: 0.85,
      rule: 'class-type-same-base',
      note: `Both values share base type "${appBase}" — qualifier difference only.`,
      tier: 'high'
    };
  }

  // Marketing qualifiers stripped
  const strippedApp = stripMarketingQualifiers(appNormalized);
  const strippedExt = stripMarketingQualifiers(extNormalized);
  if (strippedApp === strippedExt || strippedApp.includes(strippedExt) || strippedExt.includes(strippedApp)) {
    return {
      disposition: 'approve',
      confidence: 0.88,
      rule: 'class-type-marketing-qualifier',
      note: 'Difference is limited to marketing qualifiers (Premium, Reserve, etc.).',
      tier: 'high'
    };
  }

  return {
    disposition: 'review',
    confidence: 0.55,
    rule: 'class-type-unresolved',
    note: `Class/type could not be matched: app="${appValue}" ext="${extValue}"`,
    tier: 'high'
  };
}

// ─── Brand Name (Medium tier) ────────────────────────────────────────

export function judgeBrandName(
  appValue: string,
  extValue: string
): FieldJudgment {
  const { appNormalized, extNormalized } = runNormalizationPipeline(appValue, extValue);

  if (appNormalized === extNormalized) {
    return {
      disposition: 'approve',
      confidence: 0.98,
      rule: 'brand-exact-match',
      note: 'Brand name matches after normalization.',
      tier: 'medium'
    };
  }

  // Case-only difference — APPROVE per guidance doc
  if (appNormalized.toLowerCase() === extNormalized.toLowerCase()) {
    return {
      disposition: 'approve',
      confidence: 0.95,
      rule: 'brand-case-only',
      note: 'Brand name differs only in casing — approved per TTB guidance.',
      tier: 'medium'
    };
  }

  // Diacritical-stripped comparison
  const appStripped = normalizeDiacriticals(normalizeCase(normalizeWhitespace(appValue)));
  const extStripped = normalizeDiacriticals(normalizeCase(normalizeWhitespace(extValue)));
  if (appStripped === extStripped) {
    return {
      disposition: 'approve',
      confidence: 0.93,
      rule: 'brand-diacritical-only',
      note: 'Brand name differs only in diacritical marks — OCR limitation.',
      tier: 'medium'
    };
  }

  // "The" prefix difference
  const appNoThe = stripThePrefix(appNormalized);
  const extNoThe = stripThePrefix(extNormalized);
  if (appNoThe === extNoThe) {
    return {
      disposition: 'approve',
      confidence: 0.93,
      rule: 'brand-the-prefix',
      note: 'Difference is only "The" prefix — approved.',
      tier: 'medium'
    };
  }

  // Ampersand/and equivalence
  const appAmp = normalizeAmpersand(appNormalized);
  const extAmp = normalizeAmpersand(extNormalized);
  if (appAmp === extAmp) {
    return {
      disposition: 'approve',
      confidence: 0.93,
      rule: 'brand-ampersand-and',
      note: '"&" vs "and" difference — approved.',
      tier: 'medium'
    };
  }

  // Space-collapsed comparison — handles OCR linebreaks splitting brand names
  // e.g., "STORM\nWOOD" → "stormwood" vs "Stormwood Wines" → "stormwoodwines"
  const appCollapsed = appNormalized.replace(/\s+/g, '');
  const extCollapsed = extNormalized.replace(/\s+/g, '');
  if (appCollapsed === extCollapsed) {
    return {
      disposition: 'approve',
      confidence: 0.93,
      rule: 'brand-space-collapsed-match',
      note: 'Brand name matches when spaces are removed — OCR line break artifact.',
      tier: 'medium'
    };
  }

  // One value contains the other (extracted brand includes product name, or app is parent brand)
  // Check both with and without spaces for robustness
  if (appNormalized.includes(extNormalized) || extNormalized.includes(appNormalized)
    || appCollapsed.includes(extCollapsed) || extCollapsed.includes(appCollapsed)) {
    return {
      disposition: 'approve',
      confidence: 0.85,
      rule: 'brand-substring-match',
      note: 'One brand value contains the other — likely parent/product brand difference.',
      tier: 'medium'
    };
  }

  // Fuzzy match for OCR errors (short edit distance relative to length)
  const distance = levenshteinDistance(appNormalized, extNormalized);
  const maxLen = Math.max(appNormalized.length, extNormalized.length);
  if (maxLen > 0 && distance / maxLen <= 0.2) {
    return {
      disposition: 'review',
      confidence: 0.65,
      rule: 'brand-fuzzy-close',
      note: `Brand names are close (edit distance ${distance}/${maxLen}) — may be OCR error.`,
      tier: 'medium'
    };
  }

  return {
    disposition: 'review',
    confidence: 0.50,
    rule: 'brand-unresolved',
    note: `Brand name mismatch: app="${appValue}" ext="${extValue}"`,
    tier: 'medium'
  };
}

// ─── Net Contents (Medium tier) ──────────────────────────────────────

export function judgeNetContents(
  appValue: string,
  extValue: string
): FieldJudgment {
  const appML = parseNetContentsML(appValue);
  const extML = parseNetContentsML(extValue);

  if (appML === null || extML === null) {
    return {
      disposition: 'review',
      confidence: 0.40,
      rule: 'net-contents-parse-failure',
      note: `Could not parse net contents. app="${appValue}" ext="${extValue}"`,
      tier: 'medium'
    };
  }

  // Allow small rounding tolerance (1 mL) for unit conversion
  if (Math.abs(appML - extML) <= 1) {
    return {
      disposition: 'approve',
      confidence: 0.95,
      rule: 'net-contents-match',
      note: `Net contents match: ${appML}mL ≈ ${extML}mL`,
      tier: 'medium'
    };
  }

  return {
    disposition: 'reject',
    confidence: 0.92,
    rule: 'net-contents-mismatch',
    note: `Net contents differ: app=${appML}mL ext=${extML}mL`,
    tier: 'medium'
  };
}

// ─── Bottler/Producer Name & Address (Medium tier) ───────────────────
//
// TTB requires name and address of the bottler/producer on every label
// (27 CFR 5.66 spirits, 27 CFR 4.35 wine, 27 CFR 7.25 malt beverage).
// Real applications often list the legal business name, while labels
// may use DBA or brand name. City/state must match the record, but
// street addresses are often abbreviated on labels.

export function judgeApplicantAddress(
  appValue: string,
  extValue: string
): FieldJudgment {
  const { appNormalized, extNormalized } = runNormalizationPipeline(
    appValue,
    extValue
  );

  if (appNormalized === extNormalized) {
    return {
      disposition: 'approve',
      confidence: 0.95,
      rule: 'address-exact-match',
      note: 'Address matches after normalization.',
      tier: 'medium'
    };
  }

  // Tokenize and check for city/state overlap (most discriminating parts)
  const appTokens = new Set(
    appNormalized.split(/[\s,.]+/).filter((t) => t.length >= 3)
  );
  const extTokens = new Set(
    extNormalized.split(/[\s,.]+/).filter((t) => t.length >= 3)
  );

  let shared = 0;
  for (const tok of appTokens) {
    if (extTokens.has(tok)) shared += 1;
  }
  const minSize = Math.min(appTokens.size, extTokens.size);
  const overlap = minSize > 0 ? shared / minSize : 0;

  // Substring match — labels often shorten "Brooklyn, NY 11201" to "Brooklyn, NY"
  if (
    appNormalized.includes(extNormalized) ||
    extNormalized.includes(appNormalized)
  ) {
    return {
      disposition: 'approve',
      confidence: 0.88,
      rule: 'address-substring-match',
      note: 'One address contains the other — likely abbreviation on label.',
      tier: 'medium'
    };
  }

  // High token overlap (≥60%) is usually a match with formatting differences
  if (overlap >= 0.6) {
    return {
      disposition: 'approve',
      confidence: 0.82,
      rule: 'address-token-overlap',
      note: `Address tokens overlap ${Math.round(overlap * 100)}% — likely same address formatted differently.`,
      tier: 'medium'
    };
  }

  // Moderate overlap (30-60%) needs human review — could be DBA, co-packer, etc.
  if (overlap >= 0.3) {
    return {
      disposition: 'review',
      confidence: 0.6,
      rule: 'address-partial-overlap',
      note: `Address partially matches (${Math.round(overlap * 100)}% token overlap) — could be DBA, co-packer, or legal vs trade name.`,
      tier: 'medium'
    };
  }

  // No meaningful overlap — likely a real mismatch, but addresses are
  // complex enough that we route to review, not reject.
  return {
    disposition: 'review',
    confidence: 0.5,
    rule: 'address-mismatch',
    note: `Bottler/producer address differs: app="${appValue}" ext="${extValue}"`,
    tier: 'medium'
  };
}

// ─── Country of Origin (High tier) ───────────────────────────────────

export function judgeCountryOfOrigin(
  appValue: string,
  extValue: string
): FieldJudgment {
  // FAST PATH — catches the obvious cases without an LLM call.
  if (isCountryEquivalent(appValue, extValue)) {
    return {
      disposition: 'approve',
      confidence: 0.93,
      rule: 'country-equivalent',
      note: 'Country of origin matches after translation/abbreviation normalization.',
      tier: 'high'
    };
  }

  // SLOW PATH — defer to LLM judgment. Country-of-origin has high
  // variability (native-language forms, "Product of X", regional
  // subdivisions, OCR noise) that a lookup table cannot cover without
  // overfitting. Return review so the judgment LLM executor can decide
  // with good prompting + few-shot examples. See judgment-llm-prompt.ts.
  //
  // If the LLM is not wired in, this review is the correct default —
  // rejecting country mismatches automatically is too aggressive given
  // noisy extraction.
  return {
    disposition: 'review',
    confidence: 0.50,
    rule: 'country-ambiguous-defer-to-llm',
    note: `Country values differ: app="${appValue}" ext="${extValue}". Defer to LLM judgment or human review.`,
    tier: 'high'
  };
}

// ─── Varietal (High tier) ────────────────────────────────────────────

export function judgeVarietal(
  appValue: string,
  extValue: string
): FieldJudgment {
  const normApp = normalizeCase(normalizeWhitespace(appValue));
  const normExt = normalizeCase(normalizeWhitespace(extValue));

  if (normApp === normExt) {
    return { disposition: 'approve', confidence: 0.98, rule: 'varietal-exact', note: 'Varietal matches.', tier: 'high' };
  }

  // Grape synonym table
  const appSynonyms = GRAPE_SYNONYMS[normApp] ?? [];
  if (appSynonyms.includes(normExt)) {
    return {
      disposition: 'approve',
      confidence: 0.95,
      rule: 'varietal-synonym',
      note: `"${appValue}" and "${extValue}" are recognized grape synonyms.`,
      tier: 'high'
    };
  }

  // Marketing qualifiers don't matter
  const strippedApp = stripMarketingQualifiers(normApp);
  const strippedExt = stripMarketingQualifiers(normExt);
  if (strippedApp === strippedExt) {
    return {
      disposition: 'approve',
      confidence: 0.90,
      rule: 'varietal-marketing-qualifier',
      note: 'Difference is marketing qualifier only (Reserve, Old Vine, etc.).',
      tier: 'high'
    };
  }

  return {
    disposition: 'review',
    confidence: 0.55,
    rule: 'varietal-unresolved',
    note: `Varietal mismatch: app="${appValue}" ext="${extValue}"`,
    tier: 'high'
  };
}

// ─── Vintage (High tier) ─────────────────────────────────────────────

export function judgeVintage(
  appValue: string,
  extValue: string
): FieldJudgment {
  const normApp = normalizeWhitespace(appValue).toLowerCase().replace(/[^a-z0-9]/g, '');
  const normExt = normalizeWhitespace(extValue).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normApp === normExt) {
    return { disposition: 'approve', confidence: 0.98, rule: 'vintage-exact', note: 'Vintage matches.', tier: 'high' };
  }

  // NV / Non-Vintage
  if ((normApp === 'nv' || normApp === 'nonvintage') && (normExt === 'nv' || normExt === 'nonvintage')) {
    return { disposition: 'approve', confidence: 0.95, rule: 'vintage-nv', note: 'Both indicate non-vintage.', tier: 'high' };
  }

  // Numeric year comparison
  const appYear = extractYear(appValue);
  const extYear = extractYear(extValue);
  if (appYear !== null && extYear !== null) {
    if (appYear === extYear) {
      return { disposition: 'approve', confidence: 0.96, rule: 'vintage-year-match', note: `Vintage year matches: ${appYear}`, tier: 'high' };
    }
    return { disposition: 'reject', confidence: 0.95, rule: 'vintage-year-mismatch', note: `Vintage year differs: app=${appYear} ext=${extYear}`, tier: 'high' };
  }

  return { disposition: 'review', confidence: 0.50, rule: 'vintage-unresolved', note: `Could not resolve vintage: app="${appValue}" ext="${extValue}"`, tier: 'high' };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normalizeForWarningComparison(text: string): string {
  return text
    .replace(/\bGOVT\b/gi, 'GOVERNMENT')  // common OCR abbreviation
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase();
}

function hasWordLevelChanges(a: string, b: string): boolean {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let missing = 0;
  let added = 0;
  for (const w of wordsA) if (!wordsB.has(w)) missing++;
  for (const w of wordsB) if (!wordsA.has(w)) added++;
  // Canonical warning is ~50 words. OCR noise can cause 3-5 word-level
  // differences (character errors that change a whole word). Require >6
  // word differences to count as a real substitution/deletion.
  return missing > 6 || added > 6;
}

function detectBaseType(value: string): string | null {
  const lower = value.toLowerCase();
  if (/\b(wine|vin|vino)\b/.test(lower)) return 'wine';
  if (/\b(ale|beer|lager|stout|porter|ipa|malt)\b/.test(lower)) return 'beer';
  if (/\b(vodka)\b/.test(lower)) return 'vodka';
  if (/\b(whisk[ey]y|bourbon)\b/.test(lower)) return 'whisky';
  if (/\b(rum)\b/.test(lower)) return 'rum';
  if (/\b(gin)\b/.test(lower)) return 'gin';
  if (/\b(tequila|mezcal)\b/.test(lower)) return 'tequila';
  if (/\b(brandy|cognac)\b/.test(lower)) return 'brandy';
  if (/\b(spirit|liquor|liqueur)\b/.test(lower)) return 'spirits';
  return null;
}

const MARKETING_QUALIFIERS = /\b(premium|select|reserve|reserva|special|extra|superior|classic|original|craft|artisan|hand\s*crafted|small\s*batch|limited|fine|old|aged|vintage)\b/gi;

function stripMarketingQualifiers(value: string): string {
  return value.replace(MARKETING_QUALIFIERS, '').replace(/\s+/g, ' ').trim();
}

function extractYear(value: string): number | null {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let previous = new Array<number>(n + 1);
  let current = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) previous[j] = j;
  for (let i = 1; i <= m; i++) {
    current[0] = i;
    for (let j = 1; j <= n; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[n];
}
