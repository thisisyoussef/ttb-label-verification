# Rule Source Map

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment

## Rules and heuristics touched

| Rule ID | Applies To | Severity | Source Docs | Deterministic or Advisory | Uncertainty Fallback | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `EXTRACT-FIELD-PRESENCE` | all beverage types | note | `docs/reference/product-docs/ttb-implementation-roadmap-final.md`; `docs/reference/product-docs/ttb-product-spec-final.md` | advisory model extraction | absent or low-confidence fields stay explicit | fields must be reported as absent rather than guessed |
| `BEVERAGE-TYPE-APPLICATION` | all beverage types | major | `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | deterministic | none | explicit application beverage type wins when present |
| `BEVERAGE-TYPE-CLASS-INFERENCE` | all beverage types | major | `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | deterministic | fall through to model hint or strict fallback | class/type text drives inference when application input is `auto` |
| `BEVERAGE-TYPE-STRICT-FALLBACK` | ambiguous auto-detect cases | major | `docs/reference/product-docs/ttb-implementation-roadmap-final.md`; `docs/reference/product-docs/ttb-product-spec-final.md` | deterministic | `unknown` when there is no trustworthy alcohol-label evidence | label-like ambiguous cases may still default to distilled spirits because it is the strictest path, but non-label or no-text cases must not masquerade as spirits |
| `IMAGE-QUALITY-SIGNAL` | all beverage types | note | `docs/reference/product-docs/ttb-product-spec-final.md`; `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | advisory model extraction | low-confidence or no-text state | quality issues inform later `review` behavior but do not create fake passes |
| `WARN-VISUAL-SIGNAL` | labels with a government warning | major | `docs/reference/product-docs/ttb-implementation-roadmap-final.md` | advisory model extraction | explicit uncertainty | visual boldness and separation remain probabilistic until later validation |
