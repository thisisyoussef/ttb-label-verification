/**
 * Focused LLM judgment prompts for cases that survive deterministic normalization.
 *
 * Architecture: extraction → code normalization → (only if ambiguous) → this prompt.
 * Each prompt NEVER sees the raw image. It only gets structured data and applies
 * explicit IF/THEN rules with a locked output schema.
 *
 * Segmented per field — every field has its own compact, focused prompt with:
 *   - Only that field's decision tree
 *   - Only that field's few-shot examples
 *   - Its own system role framing
 *
 * Deterministic pre-filters (empty/null values, standalone mode) happen in the
 * executor BEFORE any LLM call — they never reach these prompts.
 *
 * Follows the guidance in docs/reference/llm-judgment-prompting-guide.md:
 * - Separate concerns (judgment only, not extraction)
 * - Explicit decision trees, not vibes
 * - Output schema defined upfront
 * - Rules embedded directly in prompt
 * - Safe REVIEW path for uncertainty
 * - Few-shot examples specific to the field being judged
 */

export type JudgmentInput = {
  fieldId: string;
  fieldLabel: string;
  applicationValue: string;
  extractedValue: string;
  extractionConfidence: number;
  beverageType: string;
  codeNormalizationResult: string;
};

export type JudgmentOutput = {
  disposition: 'APPROVE' | 'REVIEW' | 'REJECT';
  confidence: number;
  reasoning: string;
  ruleApplied: string;
};

// ─── Shared output schema + confidence calibration ────────────────────────

const OUTPUT_SCHEMA = `Respond with ONLY valid JSON matching this schema. No markdown, no backticks, no preamble.

{
  "disposition": "APPROVE" | "REVIEW" | "REJECT",
  "confidence": float 0.0-1.0,
  "reasoning": "1-2 sentence explanation",
  "ruleApplied": "which specific rule drove the decision"
}

CONFIDENCE CALIBRATION:
- 0.95-1.0: Exact rule match, zero ambiguity
- 0.80-0.94: Clear rule match with minor interpretation
- 0.60-0.79: Probable match but some ambiguity
- 0.40-0.59: Could go either way, needs human review
- 0.0-0.39: Probable mismatch but uncertain

If uncertain, ALWAYS choose REVIEW. Saying "I'm not sure" is always better than guessing wrong.`;

// ─── Field-specific prompts ────────────────────────────────────────────────

const BRAND_NAME_PROMPT = {
  system: `You are a TTB label compliance reviewer classifying a brand-name mismatch.

BRAND NAME RULES (stop at first match):
1. If only letter casing differs: APPROVE (brands display in varying case)
2. If only diacritical marks differ (Patrón→Patron, Moët→Moet): APPROVE (OCR limitation)
3. If only apostrophes differ (Stone's→Stones): APPROVE (OCR limitation)
4. If "The" prefix present/absent: APPROVE
5. If "&" vs "and": APPROVE
6. If one value is a substring of the other (parent brand vs product name): APPROVE
7. If values share no common words and are completely different strings: REVIEW
8. If the spelling of the brand word itself differs substantively: REJECT
9. DEFAULT: REVIEW

${OUTPUT_SCHEMA}`,

  examples: `EXAMPLES:

Input: App: "Moët & Chandon" | Label: "MOET & CHANDON"
Output: {"disposition":"APPROVE","confidence":0.95,"reasoning":"Missing diaeresis is OCR artifact; case is cosmetic.","ruleApplied":"diacritical_plus_case"}

Input: App: "Flaviar" | Label: "Columbia Creek"
Output: {"disposition":"REVIEW","confidence":0.45,"reasoning":"No common words. Could be parent brand vs product brand or genuine mismatch.","ruleApplied":"no_common_tokens"}

Input: App: "Stone's Throw" | Label: "STONES THROW"
Output: {"disposition":"APPROVE","confidence":0.93,"reasoning":"Only apostrophe and case differ.","ruleApplied":"apostrophe_plus_case"}`
};

const CLASS_TYPE_PROMPT = {
  system: `You are a TTB label compliance reviewer classifying a class/type designation mismatch.

CLASS/TYPE RULES (stop at first match):
1. If the TTB regulatory class encompasses the label text: APPROVE
   - "ale" encompasses: IPA, India Pale Ale, Stout, Porter
   - "beer" encompasses: Lager, Pilsner, Bock, Pale Ale
   - "table white wine" encompasses any white grape varietal (Chardonnay, Riesling, Semillon, Sauvignon Blanc)
   - "table red wine" encompasses any red grape varietal (Merlot, Cabernet, Sangiovese, Pinot Noir)
   - "vodka specialties" encompasses Vodka Cocktail, Flavored Vodka
   - "straight bourbon whisky" encompasses Kentucky Straight Bourbon Whiskey
   - "other specialties & proprietaries" encompasses flavored spirits, spirit-based cocktails
2. If only marketing qualifiers differ (Premium, Reserve, Select, Special): APPROVE
3. If whisky/whiskey spelling differs: REVIEW (context-dependent by origin)
4. If base type is fundamentally different (Vodka vs Gin, Rum vs Brandy): REJECT
5. Wine designations (DOC, DOCG, AOC, Spätlese, Kabinett): APPROVE when TTB class is wine
6. DEFAULT: REVIEW

${OUTPUT_SCHEMA}`,

  examples: `EXAMPLES:

Input: App: "ale" | Label: "India Pale Ale"
Output: {"disposition":"APPROVE","confidence":0.96,"reasoning":"IPA is a sub-type of ale. TTB class 'ale' encompasses this label text.","ruleApplied":"class_taxonomy_match"}

Input: App: "vodka" | Label: "Gin"
Output: {"disposition":"REJECT","confidence":0.99,"reasoning":"Base spirit types are fundamentally different.","ruleApplied":"base_type_mismatch"}

Input: App: "table white wine" | Label: "SEMILLON"
Output: {"disposition":"APPROVE","confidence":0.95,"reasoning":"Semillon is a white wine grape; the TTB class encompasses single-varietal white wines.","ruleApplied":"white_wine_varietal"}`
};

const ALCOHOL_CONTENT_PROMPT = {
  system: `You are a TTB label compliance reviewer classifying an alcohol-content mismatch.

ALCOHOL CONTENT RULES (stop at first match):
1. Parse both values to numeric ABV percentage (ignore formatting)
2. If numeric ABV matches exactly: APPROVE
3. If numeric ABV differs by ≤ 0.5 percentage points for spirits: APPROVE (rounding tolerance)
4. For wine: if ABV differs by ≤ 1.0 pp AND does not cross a tax class boundary (14%, 21%, 24%): APPROVE
5. If ABV differs by > 0.5 pp for spirits (or > 1.0 pp for wine): REJECT
6. If proof is present: verify proof ≈ ABV × 2 (within 0.5 tolerance). If inconsistent: REJECT
7. Format equivalences (all APPROVE): "Alc./Vol." = "ALC./VOL." = "Alcohol by Volume" = "Alc. by Vol." = "by vol."
8. Trailing zeros not significant: 14.0% = 14%
9. DEFAULT: REVIEW

${OUTPUT_SCHEMA}`,

  examples: `EXAMPLES:

Input: App: "40% Alc./Vol." | Label: "40% ALC./VOL. (80 Proof)"
Output: {"disposition":"APPROVE","confidence":0.98,"reasoning":"Proof is optional and mathematically consistent (80 = 40 × 2). ABV matches.","ruleApplied":"abv_exact_proof_optional"}

Input: App: "40% Alc./Vol." | Label: "42% Alc./Vol."
Output: {"disposition":"REJECT","confidence":0.99,"reasoning":"ABV differs by 2 pp, exceeding 0.5 pp spirits tolerance.","ruleApplied":"abv_tolerance_exceeded"}

Input: App: "13% Alc./Vol." | Label: "13.2% by vol."
Output: {"disposition":"APPROVE","confidence":0.95,"reasoning":"Wine ABV within 1 pp; same tax class.","ruleApplied":"wine_rounding_tolerance"}`
};

const NET_CONTENTS_PROMPT = {
  system: `You are a TTB label compliance reviewer classifying a net-contents mismatch.

NET CONTENTS RULES (stop at first match):
1. Convert both values to milliliters. Reference: 750 mL = 75 cL = 0.75 L; 12 fl oz = 354.9 mL; 1 pint = 473.2 mL; 1 US gallon = 3785 mL
2. If numeric volume matches within 1 mL after conversion: APPROVE
3. EU estimated-quantity "e" mark is not a mismatch: APPROVE
4. "Liters" = "Litres": APPROVE
5. Dual metric/imperial statement (e.g., "12 FL OZ (355 mL)"): APPROVE
6. If numeric volume differs materially after conversion: REJECT
7. DEFAULT: REVIEW

${OUTPUT_SCHEMA}`,

  examples: `EXAMPLES:

Input: App: "750 mL" | Label: "75 cL"
Output: {"disposition":"APPROVE","confidence":0.99,"reasoning":"75 cL = 750 mL exactly.","ruleApplied":"unit_conversion"}

Input: App: "12 FL OZ" | Label: "1 PINT (16 FL OZ)"
Output: {"disposition":"REJECT","confidence":0.98,"reasoning":"Genuine size difference — 12 fl oz vs 16 fl oz.","ruleApplied":"volume_mismatch"}

Input: App: "355 mL" | Label: "12 FL OZ (355 mL)"
Output: {"disposition":"APPROVE","confidence":0.97,"reasoning":"Dual metric/imperial statement with matching mL.","ruleApplied":"dual_unit_statement"}`
};

const COUNTRY_OF_ORIGIN_PROMPT = {
  system: `You are a TTB label compliance reviewer classifying a country-of-origin mismatch.

Country names on alcohol labels have high linguistic variability: native-language forms, regulatory phrasing ("Product of X"), regional subdivisions, and OCR noise. Your job is to recognize these variations without demanding exact string matches.

COUNTRY OF ORIGIN RULES (stop at first match):
1. If one is a substring of the other (e.g., "trinidad" vs "trinidad and tobago"): APPROVE
2. If one is the demonym of the other (French↔France, Italian↔Italy, German↔Germany, Czech↔Czech Republic, Scottish↔Scotland, Japanese↔Japan): APPROVE
3. If one is a native-language form (Deutschland↔Germany, España↔Spain, Italia↔Italy, Nihon↔Japan, Hecho en México↔Mexico, Produit de France↔France): APPROVE
4. If common alternate or official short name (USA↔United States, UK↔United Kingdom, NZ↔New Zealand, Czechia↔Czech Republic): APPROVE
5. If extracted value is only "imported" without a country name: REVIEW (label lacks specificity)
6. If extracted value includes a region/state within the application country (Bordeaux/France, Scotland/United Kingdom, Kentucky/United States): APPROVE
7. If extracted value is a regulatory statement containing the application country ("Product of X", "Wine of X", "Made in X", "Distilled in X"): APPROVE
8. If the extracted value contains OCR noise but the country name is recognizable within it: APPROVE
9. If countries are genuinely different (France vs Italy): REVIEW — do not auto-reject; extraction noise is too common on this field
10. DEFAULT: REVIEW

${OUTPUT_SCHEMA}`,

  examples: `EXAMPLES:

Input: App: "trinidad/tobago" | Label: "TRINIDAD\\nGOVERNMENT WARNING"
Output: {"disposition":"APPROVE","confidence":0.88,"reasoning":"Trinidad is part of Trinidad and Tobago; extraction contains OCR noise from adjacent warning.","ruleApplied":"substring_with_ocr_noise"}

Input: App: "czech republic" | Label: "Czechia"
Output: {"disposition":"APPROVE","confidence":0.95,"reasoning":"Czechia is the official short-form of Czech Republic.","ruleApplied":"alternate_official_name"}

Input: App: "germany" | Label: "Deutschland"
Output: {"disposition":"APPROVE","confidence":0.97,"reasoning":"Deutschland is the German-language name for Germany.","ruleApplied":"native_language_form"}

Input: App: "france" | Label: "italy"
Output: {"disposition":"REVIEW","confidence":0.40,"reasoning":"Different countries. Could be genuine mismatch or extraction error; auto-rejecting is too aggressive for this noisy field.","ruleApplied":"genuine_mismatch_needs_human"}

Input: App: "new zealand" | Label: "Wine of New Zealand"
Output: {"disposition":"APPROVE","confidence":0.96,"reasoning":"Label is a 'Wine of X' statement matching the application country.","ruleApplied":"product_of_statement"}

Input: App: "united states" | Label: "KENTUCKY"
Output: {"disposition":"APPROVE","confidence":0.92,"reasoning":"Kentucky is a US state; country-of-origin encompasses state-level designations.","ruleApplied":"subregion_of_country"}`
};

const APPLICANT_ADDRESS_PROMPT = {
  system: `You are a TTB label compliance reviewer classifying a bottler/producer address mismatch.

Addresses on alcohol labels are abbreviated — labels rarely include full street addresses. The REGULATORY concern is whether the same legal entity at the same location is identified. Street-level details are secondary.

APPLICANT ADDRESS RULES (stop at first match):
1. If one is a substring of the other (e.g., label shortens "123 Main St, Brooklyn, NY 11201" to "Brooklyn, NY"): APPROVE
2. If both identify the same city AND state, even with different street details: APPROVE
3. If only corporate suffix differs (Inc. / LLC / Co. / Ltd. present on one side): APPROVE
4. If ZIP or suite numbers are missing on one side: APPROVE (labels commonly omit)
5. Street-number typos within 2 digits: REVIEW
6. If company name differs but city/state match (DBA vs legal name, co-packer): REVIEW
7. If city OR state is completely different: REVIEW — could be co-packer or production facility, don't auto-reject
8. DEFAULT: REVIEW

${OUTPUT_SCHEMA}`,

  examples: `EXAMPLES:

Input: App: "Heritage Hill Cellars, Napa, CA 94558" | Label: "NAPA, CALIFORNIA"
Output: {"disposition":"APPROVE","confidence":0.90,"reasoning":"Label shortens to city and state. Same location.","ruleApplied":"city_state_match"}

Input: App: "Pilok Brewery, Prague" | Label: "Broumy, Czech Republic"
Output: {"disposition":"REVIEW","confidence":0.50,"reasoning":"Different cities. Could be a co-packer; don't auto-reject addresses.","ruleApplied":"different_city_possible_copacker"}

Input: App: "Harpoon Brewery, Boston, MA" | Label: "HARPOON BREWERY, BOSTON, MA"
Output: {"disposition":"APPROVE","confidence":0.99,"reasoning":"Identical after case normalization.","ruleApplied":"exact_after_normalize"}`
};

const GOVERNMENT_WARNING_PROMPT = {
  system: `You are a TTB label compliance reviewer classifying a government-warning text mismatch.

This is a STRICT comparison — the warning text is statutory and must match 27 CFR Part 16 exactly.

GOVERNMENT WARNING RULES (stop at first match):
1. Normalize both texts: lowercase, collapse whitespace, strip punctuation
2. If normalized texts match: APPROVE
3. If only line breaks differ: APPROVE (does not affect content)
4. If only minor punctuation differs (missing period, comma): REVIEW (not auto-approve for statutory text)
5. If any word is substituted, deleted, or added to the statutory text: REJECT
6. If "GOVERNMENT WARNING" heading is not in all caps: REJECT
7. If text is clearly truncated: REVIEW
8. Additional state-specific warnings alongside the federal warning: APPROVE
9. DEFAULT: REVIEW

${OUTPUT_SCHEMA}`,

  examples: `EXAMPLES:

Input: App: canonical text | Label: "GOVERNMENT WARNING: (1) According to the Surgen General..."
Output: {"disposition":"REVIEW","confidence":0.55,"reasoning":"'Surgen' appears to be OCR error for 'Surgeon'. Single character substitution on statutory text needs human verification.","ruleApplied":"possible_ocr_error"}`
};

// ─── Prompt registry ───────────────────────────────────────────────────────

const FIELD_PROMPTS: Record<string, { system: string; examples: string }> = {
  'brand-name': BRAND_NAME_PROMPT,
  'class-type': CLASS_TYPE_PROMPT,
  'alcohol-content': ALCOHOL_CONTENT_PROMPT,
  'net-contents': NET_CONTENTS_PROMPT,
  'country-of-origin': COUNTRY_OF_ORIGIN_PROMPT,
  'applicant-address': APPLICANT_ADDRESS_PROMPT,
  'government-warning': GOVERNMENT_WARNING_PROMPT
};

/**
 * Build a complete judgment prompt for a specific field mismatch.
 *
 * Each field gets its OWN focused prompt — rules + examples are segmented
 * per field so the model only sees context relevant to the comparison.
 *
 * Preconditions (enforced by the executor BEFORE calling this):
 *   - Both applicationValue and extractedValue are non-empty
 *   - The check status is 'review' (fast-path has not resolved it)
 *   - The field ID is in FIELD_PROMPTS (otherwise this falls back to REVIEW)
 */
export function buildFieldJudgmentPrompt(input: JudgmentInput): {
  system: string;
  user: string;
} {
  const prompt = FIELD_PROMPTS[input.fieldId];

  if (!prompt) {
    // Unknown field — we should never get here because the executor only
    // calls this for known fields. Return a safe default that routes to REVIEW.
    return {
      system:
        `You are a TTB label compliance reviewer. No field-specific rules are available for field "${input.fieldId}". Output REVIEW with low confidence.\n\n${OUTPUT_SCHEMA}`,
      user: `Field: ${input.fieldId}\nApplication: ${JSON.stringify(input.applicationValue)}\nLabel: ${JSON.stringify(input.extractedValue)}`
    };
  }

  const system = [prompt.system, '', prompt.examples].join('\n');

  const user = [
    `Application Value: ${JSON.stringify(input.applicationValue)}`,
    `Extracted Label Value: ${JSON.stringify(input.extractedValue)}`,
    `Beverage Type: ${input.beverageType}`,
    '',
    'Classify this mismatch. Output ONLY valid JSON.'
  ].join('\n');

  return { system, user };
}

/**
 * Build a focused government warning visual assessment prompt.
 *
 * This is the ONE case where the image is needed for the judgment call —
 * assessing whether "GOVERNMENT WARNING" is in all caps, bold, and
 * visually separated. But the prompt is focused ONLY on visual formatting,
 * not text extraction.
 */
export function buildWarningVisualAssessmentPrompt(): string {
  return `You are assessing the VISUAL FORMATTING of a government warning statement on an alcohol label. You are NOT reading or extracting text — that has already been done. You are ONLY evaluating visual presentation.

Answer these 4 questions about the government warning on this label:

1. HEADING CAPS: Is "GOVERNMENT WARNING" displayed in ALL CAPITAL LETTERS?
2. HEADING BOLD: Does the heading appear BOLDER or HEAVIER than the body text?
3. CONTINUOUS PARAGRAPH: Is the warning text formatted as a single continuous paragraph (not broken into separate sections)?
4. VISUAL SEPARATION: Is the warning statement visually separated from surrounding label content (by whitespace, borders, or distinct positioning)?

Respond with ONLY valid JSON. No other text.

{
  "headingCaps": {"answer": "yes" | "no" | "uncertain", "confidence": float 0.0-1.0},
  "headingBold": {"answer": "yes" | "no" | "uncertain", "confidence": float 0.0-1.0},
  "continuousParagraph": {"answer": "yes" | "no" | "uncertain", "confidence": float 0.0-1.0},
  "visualSeparation": {"answer": "yes" | "no" | "uncertain", "confidence": float 0.0-1.0}
}

RULES:
- If you cannot see a government warning on the label: all answers are "uncertain" with confidence 0.1
- If the warning is partially obscured or occluded: answer "uncertain" for affected signals, with confidence proportional to what you can see
- "uncertain" is ALWAYS the correct answer when you genuinely cannot tell. Do not guess.
- Confidence 0.9+ means you are very sure. 0.5-0.8 means you can see something but it's not perfectly clear. Below 0.5 means you're guessing.`;
}
