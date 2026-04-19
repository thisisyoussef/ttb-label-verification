# Rule Source Index

This is the repo-level source trail for the compliance engine.

| Rule ID | Applies To | Severity Class | Outcome Shape | Source Trail | Implementation Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `GOV-WARN-EXACT` | all beverages at or above 0.5% ABV | blocker | hard fail when exact wording or punctuation is provably wrong; review on uncertain extraction | `docs/presearch/2026-04-13-foundation.md`; `docs/reference/product-docs/ttb-product-spec-final.md`; `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | implemented | Exact text is the showcase requirement, but body-letter case alone is not a separate failure when the wording otherwise matches. |
| `GOV-WARN-FORMAT` | all beverages at or above 0.5% ABV | blocker | fail for deterministic heading-format defects; review when boldness, separation, or continuity is uncertain | `docs/presearch/2026-04-13-foundation.md`; `docs/reference/product-docs/ttb-product-spec-final.md`; `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | implemented | Scope the uppercase/bold rule to the opening `GOVERNMENT WARNING` heading only; compare heading boldness to the words immediately after it. |
| `SPIRITS-SAME-FOV` | distilled spirits | major | pass/fail only when spatial evidence is strong; otherwise review | `docs/presearch/2026-04-13-foundation.md`; `docs/reference/product-docs/ttb-product-spec-final.md` | planned | Same-field-of-vision is valuable but uncertainty-prone. |
| `BRAND-FUZZY-COSMETIC` | all beverage types | minor | cosmetic differences downgrade to review, not fail | `docs/reference/product-docs/ttb-product-spec-final.md`; `docs/reference/product-docs/ttb-prd-comprehensive.md` | planned | Case, whitespace, and light punctuation differences are not automatic failures. |
| `WINE-VINTAGE-APPELLATION` | wine | major | fail when dependency is clearly violated | `docs/reference/product-docs/ttb-product-spec-final.md`; `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | planned | Vintage and varietal claims activate appellation expectations. |
| `BEER-ABV-FORMAT` | malt beverage | major | fail when forbidden ABV format is present | `docs/reference/product-docs/ttb-product-spec-final.md`; `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | planned | Example scenario is `5.2% ABV` instead of allowed format. |
