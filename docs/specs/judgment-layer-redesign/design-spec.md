# Judgment Layer Redesign — Design Spec

## Context

The current judgment layer uses exact string matching to compare application data against extracted label text. Eval results on 28 real TTB-approved labels show 0% auto-approval rate — the system treats real approved labels identically to intentionally broken ones.

Root causes (from eval analysis):
- 27/28 class-type mismatches: TTB regulatory class vs consumer-facing label text
- 25/28 brand name mismatches: case differences and parent-vs-product brand names
- 24/28 ABV mismatches: format variations ("40% Alc./Vol." vs "40% ALC./VOL.")
- 24/28 net contents mismatches: unit format differences and null extractions
- 26/28 government warning: exact text match fails on minor OCR noise
- Binary verdict: any single `review` check blocks the `approve` verdict

The imported judgment guidance document (`docs/reference/judgment-guidance.md`) defines a complete decision framework for resolving these false positives.

## Architecture

### Pipeline

```
extract → normalize → field-specific rules → confidence score → weighted verdict
```

### New modules (all `src/server/`)

#### 1. `judgment-normalizers.ts`

Composable normalization pipeline. Eight pure functions:

- `normalizeCase` — lowercase
- `normalizeWhitespace` — strip, collapse, remove line breaks
- `normalizePunctuation` — curly→straight quotes, em-dash→hyphen, strip OCR noise
- `normalizeDiacriticals` — é→e, ñ→n, ü→u, î→i
- `expandAbbreviations(field, value)` — "Co."→"Company", "KY"→"Kentucky"
- `convertUnits(field, value)` — cL→mL, proof→ABV%, "FL OZ" normalize
- `stripFieldPrefixes(field, value)` — remove "NET CONTENTS", "PRODUCT OF"
- `parseNumericValue(value)` — extract numeric for ABV/net-contents

Export: `runNormalizationPipeline(field, appValue, extValue)` chains applicable transforms, returns normalized values + transform log.

#### 2. `judgment-equivalence.ts`

Version-controlled lookup tables:

- `CLASS_TYPE_TAXONOMY` — maps TTB regulatory classes to acceptable label text variations. E.g., `"ale"` accepts `["ale", "ipa", "india pale ale", "pale ale", "stout", "porter", "bitter", "brown ale", "amber ale"]`
- `GRAPE_SYNONYMS` — Shiraz↔Syrah, Pinot Grigio↔Pinot Gris, Garnacha↔Grenache
- `COUNTRY_TRANSLATIONS` — France↔Produit de France, Mexico↔México
- `US_STATE_ABBREVIATIONS` — NY↔New York, etc.
- `ABV_FORMAT_PATTERNS` — regex patterns for all acceptable ABV formats
- `BRAND_DIACRITICAL_MAP` — common brand accent variants

#### 3. `judgment-field-rules.ts`

One judgment function per field. Each returns:

```typescript
type FieldJudgment = {
  disposition: 'approve' | 'review' | 'reject';
  confidence: number;
  rule: string;       // which rule fired
  note: string;       // human-readable explanation
  tier: 'critical' | 'high' | 'medium' | 'low';
};
```

Field rules (from guidance doc):

| Field | Tier | Auto-approve | Review | Reject |
|---|---|---|---|---|
| alcohol-content | critical | Numeric match after format normalization, proof↔ABV | Confidence <70%, ambiguous chars | Numeric differs (0 tol spirits, 1% wine same class) |
| government-warning | critical | Levenshtein ≤5 from canonical | 5-15 edits, missing punctuation, partial extraction | Word substitution/deletion, >15 edits |
| class-type | high | Taxonomy match or sub-type qualifier | Unknown qualifier, whisky/whiskey context | Different base type |
| country-of-origin | high | Translation match, abbreviation expansion | "Product of" vs "Distilled in" | Different country |
| varietal | high | Grape synonym table match | "Cabernet" alone vs full name | Informal abbreviation, single vs blend |
| vintage | high | Numeric year match, Roman↔Arabic, NV | — | Any year difference |
| brand-name | medium | Case, diacriticals, "The" prefix, "&"/"and" | Additional text captured, parent vs product | Spelling difference |
| net-contents | medium | Unit conversion match (mL/cL/L/fl oz) | Null extraction | Numeric volume differs |
| importer | medium | Abbreviation, address partial, ZIP | — | Different company name |

#### 4. `judgment-scoring.ts`

Replaces binary `deriveVerdict`. Criticality-weighted scoring:

- Critical tier review weight: 3x
- High tier: 2x
- Medium tier: 1x
- Low tier: 0.5x

Any `reject` from critical or high tier → verdict `reject`.
Weighted review score above threshold → verdict `review`.
Otherwise → verdict `approve`.

A single cosmetic brand case-mismatch (medium, 1x) no longer blocks approval.

### Modified existing files

| File | Change |
|---|---|
| `review-report-helpers.ts` | Replace `compareFieldValues` with judgment pipeline calls. Replace `deriveVerdict` with weighted scoring. |
| `review-report-field-checks.ts` | Wire field checks through `judgment-field-rules.ts`. |
| `government-warning-validator.ts` | Replace exact-text match with fuzzy Levenshtein. Keep structural sub-checks. |

### Unchanged

- `ReviewExtraction` contract shape
- `VerificationReport` contract shape
- `NormalizedReviewIntake`
- Client/UI code
- Extraction pipeline (OCR pre-pass + VLM structuring)

## Verification

1. `npm test` — all existing tests pass (no contract changes)
2. Cola-cloud-real eval: target 40-60% auto-approve (up from 0%)
3. Supplemental-negative eval: reject controls maintain or improve
4. Core-six eval: perfect-spirit-label should auto-approve

## References

- `docs/reference/judgment-guidance.md` — imported decision framework
- `evals/results/2026-04-15-TTB-EVAL-001-batch-real-corpus.json` — baseline eval data
