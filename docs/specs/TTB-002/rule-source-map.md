# Rule Source Map

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## Rules touched

| Rule ID | Applies To | Severity | Source Docs | Deterministic or Advisory | Uncertainty Fallback | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `GOV-WARN-EXACT` | all beverages at or above 0.5% ABV | blocker | `docs/rules/RULE_SOURCE_INDEX.md`; product spec; implementation roadmap | deterministic when text extraction is clear | `review` if extraction is incomplete or low confidence | canonical text match is the showcase feature |
| `GOV-WARN-FORMAT` | all beverages at or above 0.5% ABV | blocker | `docs/rules/RULE_SOURCE_INDEX.md`; product spec | mixed | `review` for boldness, separation, or continuity ambiguity | includes all-caps prefix, punctuation, bold prefix, non-bold body |
| `BRAND-FUZZY-COSMETIC` | all beverage types | minor | product spec fuzzy match rules | deterministic comparison plus advisory explanation | `review` | case, whitespace, and small punctuation differences are not hard fails |
| `SPIRITS-SAME-FOV` | distilled spirits | major | rule index; product spec distilled spirits rules | advisory unless evidence is strong | `review` | same-field-of-vision is valuable but uncertainty-prone |
| `WINE-VINTAGE-APPELLATION` | wine | major | product spec wine rules and cross-field rules | deterministic when the relevant fields are present | `fail` only on clear dependency violation | vintage or varietal claims activate appellation expectations |
| `BEER-ABV-FORMAT` | malt beverage | major | product spec beer rules | deterministic | `fail` | forbidden `ABV` format is a baseline eval case |
| `IMAGE-QUALITY` | all beverage types | note | product spec edge cases | advisory | `review` | low quality should influence confidence and reviewer messaging, not create fake certainty |
