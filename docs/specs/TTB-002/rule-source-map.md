# Rule Source Map

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## Rules touched

| Rule ID | Applies To | Severity | Source Docs | Deterministic or Advisory | Uncertainty Fallback | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `GOV-WARN-EXACT` | all beverages at or above 0.5% ABV | blocker | `docs/rules/RULE_SOURCE_INDEX.md`; `27 CFR 16.21`; product spec; implementation roadmap | deterministic when text extraction is clear | `review` if extraction is incomplete or low confidence | whitespace is normalized before comparison; case and punctuation remain literal |
| `GOV-WARN-FORMAT` | all beverages at or above 0.5% ABV | blocker | `docs/rules/RULE_SOURCE_INDEX.md`; `27 CFR 16.22`; TTB health warning guidance; product spec | mixed | `review` for boldness, separation, or continuity ambiguity | includes all-caps prefix, punctuation, bold prefix, non-bold body; the approved UI carries separation inside the `legibility` sub-check |
| `BRAND-FUZZY-COSMETIC` | all beverage types | minor | product spec fuzzy match rules | deterministic comparison plus advisory explanation | `review` | case, whitespace, and small punctuation differences are not hard fails |
| `SPIRITS-SAME-FOV` | distilled spirits | major | rule index; product spec distilled spirits rules | advisory unless evidence is strong | `review` | same-field-of-vision is valuable but uncertainty-prone |
| `WINE-VINTAGE-APPELLATION` | wine | major | product spec wine rules and cross-field rules | deterministic when the relevant fields are present | `fail` only on clear dependency violation | vintage or varietal claims activate appellation expectations |
| `BEER-ABV-FORMAT` | malt beverage | major | product spec beer rules | deterministic | `fail` | forbidden `ABV` format is a baseline eval case |
| `IMAGE-QUALITY` | all beverage types | note | product spec edge cases | advisory | `review` | low quality should influence confidence and reviewer messaging, not create fake certainty |
