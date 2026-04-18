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
  stripBrandDecorativePunctuation,
  stripThePrefix
} from './judgment-normalizers';
import {
  isClassTypeEquivalent,
  isCountryEquivalent,
  GRAPE_SYNONYMS
} from './judgment-equivalence';
import {
  addressTokenOverlap,
  normalizeAddress
} from './taxonomy/address-abbreviations';
import {
  resolvesToSameStandardBottle
} from './taxonomy/net-contents-units';

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
      note: `Could not read the alcohol content clearly. Approved record says "${appValue}", label says "${extValue}".`,
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
        note: `Alcohol content difference crosses a wine tax class boundary (approved ${appAbv}%, label ${extAbv}%).`,
        tier: 'critical'
      };
    }
    if (diff <= 1.0) {
      return {
        disposition: 'approve',
        confidence: 0.92,
        rule: 'abv-match-wine-tolerance',
        note: `Alcohol content is within the 1% wine tolerance (approved ${appAbv}%, label ${extAbv}%).`,
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
      note: `Alcohol content matches exactly: ${appAbv}%.`,
      tier: 'critical'
    };
  }

  // Small rounding differences (0.1-0.5) — could be proof conversion rounding
  if (diff <= 0.5) {
    return {
      disposition: 'approve',
      confidence: 0.88,
      rule: 'abv-rounding-tolerance',
      note: `Alcohol content is within rounding tolerance (approved ${appAbv}%, label ${extAbv}%).`,
      tier: 'critical'
    };
  }

  const diffDisplay = Number(diff.toFixed(1));
  return {
    disposition: 'reject',
    confidence: 0.95,
    rule: 'abv-numeric-mismatch',
    note: `Alcohol content differs by ${diffDisplay}% (approved ${appAbv}%, label ${extAbv}%).`,
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
      note: 'Warning text matches the required wording.',
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
      note: 'Warning text matches and includes extra messaging. TTB guidance allows this.',
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
      note: `Warning text has word changes. ${distance} characters differ from the required wording.`,
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
      note: `Warning text matches the required wording (~${maxLen > 0 ? ((1 - distance / maxLen) * 100).toFixed(0) : 0}% match). Small differences are typical of reading small print.`,
      tier: 'critical'
    };
  }

  if (distance <= 50) {
    return {
      disposition: 'review',
      confidence: 0.55,
      rule: 'warning-fuzzy-match-moderate',
      note: `Warning text mostly matches the required wording (~${maxLen > 0 ? ((1 - distance / maxLen) * 100).toFixed(0) : 0}% match). A human reviewer should check this one.`,
      tier: 'critical'
    };
  }

  return {
    disposition: 'reject',
    confidence: 0.90,
    rule: 'warning-text-divergent',
    note: `Warning text differs significantly from the required wording.`,
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
      note: 'Class/type matches the approved record.',
      tier: 'high'
    };
  }

  // Check taxonomy equivalence
  if (isClassTypeEquivalent(appValue, extValue)) {
    return {
      disposition: 'approve',
      confidence: 0.92,
      rule: 'class-type-taxonomy-match',
      note: `TTB class "${appValue}" accepts label wording "${extValue}".`,
      tier: 'high'
    };
  }

  // Whisky/whiskey — TTB permits both spellings. Approve, not review.
  if (/whisk[ey]y/i.test(appValue) && /whisk[ey]y/i.test(extValue)) {
    return {
      disposition: 'approve',
      confidence: 0.90,
      rule: 'class-type-whisky-whiskey',
      note: 'Whisky and whiskey are both accepted spellings on TTB labels.',
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
      note: `Both are "${appBase}". Only the descriptor differs.`,
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
      note: 'The only difference is a marketing word like Premium or Reserve.',
      tier: 'high'
    };
  }

  return {
    disposition: 'review',
    confidence: 0.55,
    rule: 'class-type-unresolved',
    note: `Class/type on the label does not match the approved record. Approved: "${appValue}". Label: "${extValue}".`,
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
      note: 'Brand name matches the approved record.',
      tier: 'medium'
    };
  }

  // Case-only difference — APPROVE per guidance doc
  if (appNormalized.toLowerCase() === extNormalized.toLowerCase()) {
    return {
      disposition: 'approve',
      confidence: 0.95,
      rule: 'brand-case-only',
      note: 'Brand name differs only in capitalization. TTB guidance allows this.',
      tier: 'medium'
    };
  }

  // Decorative-punctuation-only difference — APPROVE.
  // "A.C.'s" vs "Ac's", "Dr. McGillicuddy" vs "Dr McGillicuddy",
  // "Half-Acre" vs "Half Acre" all collapse here. Apostrophes and
  // ampersands are preserved so possessive/&-only differences
  // continue to be reported by their own dedicated rules.
  const appPunctStripped = stripBrandDecorativePunctuation(appNormalized);
  const extPunctStripped = stripBrandDecorativePunctuation(extNormalized);
  if (
    appPunctStripped !== appNormalized ||
    extPunctStripped !== extNormalized
  ) {
    if (appPunctStripped === extPunctStripped) {
      return {
        disposition: 'approve',
        confidence: 0.95,
        rule: 'brand-punctuation-only',
        note: 'Brand name differs only in decorative punctuation (periods, hyphens). Same brand identity.',
        tier: 'medium'
      };
    }
    if (appPunctStripped.toLowerCase() === extPunctStripped.toLowerCase()) {
      return {
        disposition: 'approve',
        confidence: 0.95,
        rule: 'brand-punctuation-and-case',
        note: 'Brand name differs only in decorative punctuation and capitalization. Same brand identity.',
        tier: 'medium'
      };
    }
  }

  // Diacritical-stripped comparison
  const appStripped = normalizeDiacriticals(normalizeCase(normalizeWhitespace(appValue)));
  const extStripped = normalizeDiacriticals(normalizeCase(normalizeWhitespace(extValue)));
  if (appStripped === extStripped) {
    return {
      disposition: 'approve',
      confidence: 0.93,
      rule: 'brand-diacritical-only',
      note: 'Brand name differs only by accent marks.',
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
      note: 'The only difference is the word "The" at the start.',
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
      note: 'The only difference is "&" vs "and".',
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
      note: 'Brand name matches when spaces are ignored (likely split across lines on the label).',
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
      note: 'One brand name contains the other. Likely a parent brand and product name.',
      tier: 'medium'
    };
  }

  // Fuzzy match for OCR errors (short edit distance relative to length).
  // Brand names aren't a regulatory-exact field — stylized typography,
  // ligatures, and scan noise routinely shift a few characters. If we're
  // within 20% edit distance we approve (soft confidence so downstream
  // sees it as "matched but verify if curious"). Only government warning
  // text stays strictly exact; all other fields skew toward approve on
  // minor differences.
  const distance = levenshteinDistance(appNormalized, extNormalized);
  const maxLen = Math.max(appNormalized.length, extNormalized.length);
  if (maxLen > 0 && distance / maxLen <= 0.2) {
    return {
      disposition: 'approve',
      confidence: 0.78,
      rule: 'brand-fuzzy-close',
      note: 'Brand name matches the approved record. Small character differences (OCR noise, stylized fonts) were ignored.',
      tier: 'medium'
    };
  }

  return {
    disposition: 'review',
    confidence: 0.50,
    rule: 'brand-unresolved',
    note: `Brand name does not match. Approved record shows "${appValue}". Label shows "${extValue}".`,
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
      note: `Could not read net contents clearly. Approved record shows "${appValue}", label shows "${extValue}".`,
      tier: 'medium'
    };
  }

  // Allow rounding + unit-conversion tolerance. TTB labels round fluid
  // ounces to one decimal (e.g. "25.4 fl oz" = ~751.2 mL for a 750 mL
  // declaration, ~2 mL over; "12 fl oz" = ~354.9 mL for 355 mL declared,
  // ~0.1 mL under). A 5 mL band absorbs that rounding without letting
  // real mismatches (e.g. 750 mL declared vs 700 mL label) slip through.
  const NET_CONTENTS_TOLERANCE_ML = 5;
  if (Math.abs(appML - extML) <= NET_CONTENTS_TOLERANCE_ML) {
    return {
      disposition: 'approve',
      confidence: 0.95,
      rule: 'net-contents-match',
      note: `Net contents match: ${appML} mL (label shows ${extML} mL, within rounding tolerance).`,
      tier: 'medium'
    };
  }

  // Standard TTB bottle sizes (27 CFR 4.72 + 5.203): both sides snap
  // to the same regulatory size within tolerance (e.g. "750 mL" on
  // form + "25 fl oz" label → both snap to 750 mL). Catches the
  // common "label printed a rounded fl oz" case that our raw-mL diff
  // misses because 25.0 fl oz rounds to 739 mL, outside the 5 mL band.
  if (resolvesToSameStandardBottle(appValue, extValue, 15)) {
    return {
      disposition: 'approve',
      confidence: 0.90,
      rule: 'net-contents-standard-bottle',
      note: `Net contents resolve to the same TTB standard bottle size. Approved: "${appValue}"; label: "${extValue}".`,
      tier: 'medium'
    };
  }

  return {
    disposition: 'reject',
    confidence: 0.92,
    rule: 'net-contents-mismatch',
    note: `Net contents do not match. Approved record: ${appML} mL. Label: ${extML} mL.`,
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
      note: 'Address on the label matches the approved record.',
      tier: 'medium'
    };
  }

  // USPS Pub 28 normalization: expand abbreviations so "St"/"Street",
  // "Ave"/"Avenue", "Bros"/"Brothers", etc. compare equal. This
  // catches the most common "is it really different?" false positives
  // before we get to overlap scoring. If the normalized forms match
  // exactly, we've resolved the mismatch deterministically.
  const uspsApp = normalizeAddress(appValue);
  const uspsExt = normalizeAddress(extValue);
  if (uspsApp === uspsExt) {
    return {
      disposition: 'approve',
      confidence: 0.93,
      rule: 'address-usps-normalized-match',
      note: 'Same address — only USPS-style abbreviations (St/Street, Ave/Avenue, etc.) differ.',
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
  let overlap = minSize > 0 ? shared / minSize : 0;

  // Also compute USPS-normalized token overlap as a second signal.
  // When that's higher, prefer it — abbreviation expansion only helps
  // when the label uses the abbreviated form.
  const uspsOverlap = addressTokenOverlap(appValue, extValue);
  if (uspsOverlap > overlap) overlap = uspsOverlap;

  // Substring match — labels often shorten "Brooklyn, NY 11201" to "Brooklyn, NY"
  if (
    appNormalized.includes(extNormalized) ||
    extNormalized.includes(appNormalized)
  ) {
    return {
      disposition: 'approve',
      confidence: 0.88,
      rule: 'address-substring-match',
      note: 'One address contains the other. The label likely shows a shorter form.',
      tier: 'medium'
    };
  }

  // High token overlap (≥60%) is usually a match with formatting differences
  if (overlap >= 0.6) {
    return {
      disposition: 'approve',
      confidence: 0.82,
      rule: 'address-token-overlap',
      note: `Address mostly matches (${Math.round(overlap * 100)}% of parts). Likely the same address, formatted differently.`,
      tier: 'medium'
    };
  }

  // Moderate overlap (30-60%) needs human review — could be DBA, co-packer, etc.
  if (overlap >= 0.3) {
    return {
      disposition: 'review',
      confidence: 0.6,
      rule: 'address-partial-overlap',
      note: `Address partly matches (${Math.round(overlap * 100)}% of parts). This could be a DBA, co-packer, or trade name. Please check.`,
      tier: 'medium'
    };
  }

  // No meaningful overlap — likely a real mismatch, but addresses are
  // complex enough that we route to review, not reject.
  return {
    disposition: 'review',
    confidence: 0.5,
    rule: 'address-mismatch',
    note: `Address on the label does not match the approved record. Approved: "${appValue}". Label: "${extValue}".`,
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
      note: 'Country of origin matches the approved record.',
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
    note: `The country on the application (${appValue}) doesn't clearly match what the label shows (${extValue}). A human reviewer should take a look.`,
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
