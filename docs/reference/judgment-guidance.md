# COLA Label Review — Judgment Guidance

> Imported from judgment_guidance.docx — April 2026

COLA LABEL REVIEW

JUDGMENT GUIDANCE

 

A Decision Framework for Automated Label Compliance Review

When Extraction is Right but the Flag is Wrong

Version 1.0  |  April 2026

INTERNAL REFERENCE DOCUMENT

1. Purpose and Scope

This document defines how the judgment layer of a COLA (Certificate of Label Approval) review system should evaluate flagged mismatches between application data and OCR-extracted label text. It is deliberately separated from extraction guidance because the two problems are fundamentally different: extraction asks "what does the label say?" while judgment asks "does this difference matter?"

The judgment layer sits between extraction (OCR + structuring) and final disposition. Its job is to classify each flagged mismatch into one of three outcomes:

APPROVE — The mismatch is cosmetic, formatting-related, or represents a permitted variation under TTB regulations. No human review needed.

REVIEW — The mismatch is ambiguous. It could be a genuine compliance issue or an extraction artifact. Route to a human reviewer with context.

REJECT — The mismatch represents a clear, substantive discrepancy that would constitute a labeling violation under TTB regulations.

The goal is to auto-resolve the 60-80% of flags that are false positives (formatting differences, OCR artifacts, permitted variations) while routing genuinely ambiguous or problematic cases to human reviewers with enough context to make fast, accurate decisions.

Key Principle

Judgment is not about whether two strings are identical. It is about whether two strings convey the same regulatory information. A system that rejects every string mismatch is useless. A system that approves every mismatch is dangerous. The judgment layer exists to tell the difference.

2. Core Judgment Principles

2.1 Substance Over Form

The single most important principle: judge the regulatory substance of the information, not the formatting of the string. TTB regulations define what information must appear on a label and what that information must say. They do not, in most cases, prescribe exact character-level formatting.

This means the system must be able to recognize that the following are all equivalent:

"40% Alc./Vol." = "40% Alcohol by Volume" = "40% ALC./VOL." = "Alc. 40% Vol."

"750 mL" = "750ml" = "750 ML" = "75 cL" = "0.75 L"

"Product of France" = "Produit de France" = "PRODUCT OF FRANCE"

But these are NOT equivalent:

"40% Alc./Vol." ≠ "42% Alc./Vol." (different alcohol content)

"Whisky" ≠ "Whiskey" in certain origin contexts (Scotch vs Irish)

"Product of France" ≠ "Product of Italy" (different origin)

2.2 Asymmetric Error Costs

False approvals and false rejections have different costs:

False Rejection (Type I): A compliant label gets flagged for human review. Cost: reviewer time, processing delay. Annoying but recoverable.

False Approval (Type II): A non-compliant label gets auto-approved. Cost: regulatory violation, potential recall, legal liability. Potentially catastrophic.

When in doubt, REVIEW. The system should be calibrated to have a low false-approval rate even at the cost of a higher false-rejection rate. A human reviewer seeing a few unnecessary flags is far better than a non-compliant label reaching the market.

2.3 Context-Dependent Judgment

The same type of mismatch can have different dispositions depending on the field it appears in:

Case difference in brand name: APPROVE. Brands are displayed in varying case across label elements.

Case difference in government warning: REVIEW. TTB requires "GOVERNMENT WARNING" in all caps specifically.

The judgment layer must be field-aware. A rule that applies to alcohol content should not automatically apply to government warnings.

2.4 OCR Awareness

The judgment layer must account for known OCR failure modes. Many flags will be OCR errors, not label errors:

Missing diacritical marks (Patrón → Patron, Moët → Moet, Jägermeister → Jagermeister)

Character confusion (0/O, 1/l/I, 5/S, 8/B, rn/m)

Missing punctuation (apostrophes, periods, commas)

Line breaks injected into continuous text

Adjacent text from different label regions captured together

The system should recognize these patterns and either auto-approve (for diacriticals and punctuation) or route to REVIEW (for ambiguous character confusion like 0/O).

2.5 Regulatory Hierarchy

Not all label elements carry equal regulatory weight. The judgment layer should apply stricter standards to high-criticality fields:

Criticality

Fields

Tolerance

Critical

Alcohol content, Government warning, Allergen declarations

Very low. Numeric values must match exactly. Statutory text must be verbatim.

High

Class/type, Country of origin, Varietal, Vintage

Low. Substance must match; formatting can vary. Synonyms accepted only within regulatory definitions.

Medium

Brand name, Net contents, Importer/bottler info

Moderate. Formatting, abbreviation, case, diacritical, and punctuation differences are generally acceptable.

Low

Fanciful names, Marketing text, Tasting notes

High. These are not compliance-critical; auto-approve most formatting differences.

3. The Decision Framework

For every flagged mismatch, the judgment layer should execute the following decision sequence. Stop at the first conclusive step.

3.1 Step 1: Is This an Extraction Failure?

Before evaluating the mismatch itself, determine whether the extraction is trustworthy:

Empty extraction: If the extracted value is empty/null but the field is mandatory, route to REVIEW. The label may have the information on a different panel, or the image quality may be insufficient.

Garbled text: If the extracted value contains non-alphabetic noise ($#@!), route to REVIEW. This is an OCR failure, not a label issue.

Low confidence: If the OCR confidence score is below 70%, route to REVIEW regardless of whether the values appear to match. A low-confidence match may be a coincidence.

Adjacent capture: If the extracted value contains text from a different label region (e.g., net contents appended to alcohol content), strip the extra text and re-compare.

3.2 Step 2: Normalize Both Values

Before comparing, normalize the application value and label value through these transformations:

Convert to lowercase

Strip leading/trailing whitespace and collapse internal whitespace

Remove common OCR artifacts: extra periods, stray characters

Normalize punctuation: curly quotes to straight, em dashes to hyphens

Expand common abbreviations to canonical form (or vice versa)

Strip known prefixes/suffixes ("NET CONTENTS", "NET CONT.")

For numeric fields: parse to numeric value, ignoring formatting differences (14.0 = 14)

For unit fields: convert to canonical unit (75 cL = 750 mL, 80 Proof = 40% ABV)

If the normalized values match, APPROVE.

3.3 Step 3: Apply Field-Specific Rules

If normalized values still differ, apply rules specific to the field type. Each field has a defined set of permitted variations and known equivalences.

Alcohol Content

Proof is optional. Presence or absence of proof statement is not a mismatch if ABV matches.

Proof must equal ABV x 2 (within 0.5 tolerance for rounding). If proof is present but mathematically inconsistent, REJECT.

"Alc./Vol.", "Alcohol by Volume", "Alc. by Vol.", "ALC./VOL." are all equivalent.

Trailing zeros are not significant: 14.0% = 14%.

Any numeric ABV difference greater than 0 is a REJECT for distilled spirits. For wine, a 1% tolerance applies within the same tax class.

If ABV difference crosses a wine tax class boundary (14%, 21%, 24%), always REJECT.

Net Contents

Unit conversions are acceptable: 750 mL = 75 cL = 0.75 L.

Metric/imperial dual statements are acceptable: 750 mL (25.4 fl oz).

The EU estimated quantity mark ("e") after the volume is not a mismatch.

"Liters" = "Litres" (American vs British spelling).

Any numeric volume difference is a REJECT.

Class/Type

Case differences are acceptable.

"Whisky" vs "Whiskey" is context-dependent: Scotch/Canadian/Japanese use "Whisky"; Irish/American use "Whiskey". A mismatch in this suffix is a REVIEW.

Sub-type qualifiers ("London Dry Gin" vs "Gin", "V.S.O.P. Cognac" vs "Cognac") are acceptable if the base type matches and the qualifier is a recognized designation.

Marketing qualifiers ("Premium", "Select", "Reserve") do not affect class/type.

"Liqueur" = "Cordial" per TTB definitions.

Age classifications ("Reposado", "Añejo", "12 Year") added to matching base type: APPROVE.

Different base types ("Vodka" vs "Gin", "Rum" vs "Brandy"): REJECT.

"Champagne" used for non-Champagne origin: REJECT.

Country/State of Origin

Translations are acceptable: "Product of France" = "Produit de France".

Abbreviation expansion: "NY" = "New York", "USA" = "United States".

Addition of ZIP code or country qualifier: APPROVE.

"Product of" vs "Distilled in" vs "Bottled in": REVIEW. These have different regulatory meanings.

Different country names: REJECT.

UK vs constituent country (Scotland, England): REVIEW for spirits with geographic requirements.

Government Warning

This is the strictest field. The statutory text under 27 USC 215 must be verbatim.

Case changes in the body text: REVIEW ("GOVERNMENT WARNING" header must be all caps).

Any word substitution, deletion, or addition: REJECT.

Missing comma or punctuation: REVIEW.

Line breaks: APPROVE (do not affect the text content).

Partial extraction: REVIEW (cannot confirm compliance from incomplete text).

Additional state-specific warnings alongside federal: APPROVE.

Brand Name

Case differences: APPROVE.

Missing diacritical marks: APPROVE (OCR limitation).

Missing apostrophes: APPROVE (OCR limitation).

"The" prefix present/absent: APPROVE.

Additional class/type text captured with brand: APPROVE if brand portion matches.

Spelling difference in the brand itself: REJECT.

"&" vs "and": APPROVE.

Varietal

Known grape synonyms: APPROVE (Shiraz = Syrah, Pinot Grigio = Pinot Gris, Garnacha = Grenache).

Informal abbreviations ("Cab Sauv"): REJECT.

Marketing qualifiers ("Old Vine", "Reserve"): APPROVE.

Single varietal vs blend discrepancy: REJECT.

"Cabernet" alone vs "Cabernet Sauvignon": REVIEW.

Vintage

Roman numeral vs Arabic numeral: APPROVE (MMXVIII = 2018).

Spelled-out year vs numeric: APPROVE.

"NV" = "Non-Vintage": APPROVE.

Any numeric year difference: REJECT.

"Vintage" or "Harvest" prefix with matching year: APPROVE.

Importer/Bottler

"Co." = "Company", "Inc." = "Incorporated", "LLC" formatting: APPROVE.

State abbreviation vs full name: APPROVE.

ZIP code present/absent: APPROVE.

Street address present/absent: APPROVE (not required on label).

"&" vs "and": APPROVE.

Different company name: REJECT.

Different city: REJECT.

"Produced" vs "Cellared" vs "Vinted": REJECT (different TTB definitions).

DSP number format (hyphens vs spaces): APPROVE.

3.4 Step 4: Assess Confidence and Route

After field-specific rules, apply a final confidence assessment:

Auto-Approve Conditions (all must be true)

1. The mismatch is fully explained by a known normalization rule or permitted variation.
2. The field is not Critical-tier (not government warning or allergen).
3. No ambiguous character substitutions are present (0/O, 1/l).
4. OCR confidence is above 85%.

Auto-Reject Conditions (any one is sufficient)

1. The normalized numeric values differ and the field is alcohol content, vintage year, or net contents.
2. The class/type base designation is fundamentally different.
3. The country of origin is different.
4. A different company name appears in the importer/bottler field.
5. Government warning text has word-level substitutions or deletions.

Route to Human Review (any one is sufficient)

1. The mismatch does not clearly fit a known normalization rule.
2. The field is Critical-tier and any difference exists (even formatting).
3. Ambiguous character substitutions are present and cannot be resolved.
4. OCR confidence is below 70%.
5. The system cannot determine whether a qualifier ("Straight", "Reserve", "Late Harvest") changes the regulatory classification.
6. "Product of" vs "Distilled in" phrasing differences.
7. Whisky/Whiskey spelling in contexts where origin convention matters.

4. Implementation Patterns

4.1 Normalization Pipeline

Implement normalization as a pipeline of composable transforms that run before comparison. Each transform should be independently testable and field-aware:

CaseNormalizer: lowercase both values

WhitespaceNormalizer: strip, collapse, remove line breaks

PunctuationNormalizer: standardize quotes, apostrophes, periods

DiacriticalNormalizer: map accented characters to base form (é→e, ñ→n, ü→u, î→i)

AbbreviationExpander: field-specific expansion ("Co."→"Company", "KY"→"Kentucky")

UnitConverter: field-specific unit normalization (cL→mL, Proof→ABV)

PrefixStripper: remove known prefixes ("NET CONTENTS", "PRODUCT OF")

NumericParser: extract and compare numeric values independently of formatting

4.2 Equivalence Tables

Maintain lookup tables for known equivalences that cannot be derived algorithmically:

Grape variety synonyms (Shiraz/Syrah, Pinot Grigio/Pinot Gris, etc.)

Country name translations (France/Produit de France, Mexico/México, etc.)

Class/type synonyms (Liqueur/Cordial)

US state abbreviation mappings

Common brand diacritical variants

These tables should be version-controlled and regularly updated as new products and edge cases are encountered.

4.3 Confidence Scoring

Rather than binary approve/reject, implement a confidence score for each judgment:

1.0: Exact match after normalization. Auto-approve.

0.8-0.99: Match after applying a well-defined equivalence rule. Auto-approve if field is not Critical-tier.

0.5-0.79: Partial match. Some elements match, others differ. Route to REVIEW with explanation.

0.0-0.49: Clear mismatch on substance. Auto-reject if field is Critical-tier; REVIEW otherwise.

Log the confidence score and the specific rules that fired for every judgment. This creates an audit trail and enables threshold tuning over time.

4.4 Human-in-the-Loop Design

When routing to REVIEW, provide the human reviewer with:

The raw application value and raw extracted value side by side.

The normalized values after each transform step.

The specific rule or rules that were considered but could not reach a conclusion.

The OCR confidence score and any character-level confidence data.

The relevant CFR citation(s) for the field in question.

A suggested disposition with reasoning ("Likely APPROVE because...") that the reviewer can confirm or override.

This transforms the reviewer's job from "evaluate this from scratch" to "confirm or correct this suggestion," dramatically reducing review time.

5. Anti-Patterns to Avoid

5.1 Exact String Matching

The most common failure mode in automated label review is treating the comparison as a string equality check. This produces an overwhelming number of false positives (formatting differences flagged as violations), quickly eroding reviewer trust and rendering the system unusable. If reviewers learn to rubber-stamp flags because "they're always wrong," the system provides negative value.

5.2 Over-Relying on LLM Judgment

Using a vision LLM or text LLM to make the final approve/reject decision without structured rules is unreliable. LLMs are excellent at understanding intent and structuring data, but they lack the precision needed for regulatory compliance judgments. An LLM might approve a label where "Whisky" is used for an Irish product because the difference seems trivial in natural language but is significant under TTB conventions. Use LLMs for structuring and normalization; use deterministic rules for judgment.

5.3 Ignoring Field Criticality

Applying the same tolerance to all fields is incorrect. A missing diacritical in a brand name is cosmetic. A missing comma in the government warning may be a statutory violation. The judgment layer must be field-aware and apply appropriate strictness.

5.4 Treating OCR Confidence as Gospel

High OCR confidence does not guarantee correctness. The digit "0" and letter "O" can both be extracted with 99% confidence. Conversely, low confidence on a correct extraction should not trigger rejection. Use confidence as one signal among many, not as a sole decision criterion.

5.5 Binary Without REVIEW

A system that only produces APPROVE or REJECT will either be too aggressive (rejecting compliant labels) or too permissive (approving violations). The REVIEW category exists specifically for cases where automated judgment cannot be confident. Removing it forces the system into errors.

6. Measuring Judgment Quality

Track these metrics to evaluate and tune the judgment layer:

Metric

Definition

Target

Auto-resolution rate

% of flags resolved without human review

60-80%

False approval rate

% of auto-approved items that were later found non-compliant

< 0.1%

False rejection rate

% of items sent to REVIEW that were trivially compliant

< 20%

Reviewer agreement

% of REVIEW suggestions confirmed by human

> 85%

Mean review time

Average time for human to resolve a REVIEW item

< 30 seconds

Rule coverage

% of mismatches explained by an existing normalization rule

> 90%

Run the 200-case eval set against the judgment layer monthly. Track disposition accuracy by field and by case category. When new false-positive patterns emerge, add normalization rules. When new false-negative patterns emerge, add validation rules. The system should improve monotonically over time.

7. Key Regulatory References

The following regulations govern the mandatory label information that the judgment layer evaluates:

27 CFR Part 4: Labeling and Advertising of Wine

27 CFR Part 5: Labeling and Advertising of Distilled Spirits

27 CFR Part 7: Labeling and Advertising of Malt Beverages

27 USC 215: Alcoholic Beverage Labeling Act (Government Warning requirements)

27 CFR 5.61-5.67: Mandatory label information for distilled spirits

27 CFR 5.63: Alcohol content statement requirements

27 CFR 4.32-4.39: Mandatory label information for wine

TTB Industry Circulars: Periodic guidance on labeling requirements and best practices

Maintain a current copy of these regulations and TTB guidance documents. When regulations change, update the judgment rules accordingly and re-run the eval set to verify no regressions.

End of Document

