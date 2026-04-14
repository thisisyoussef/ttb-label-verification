# Rule Source Map

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Rules and heuristics touched

| Rule ID | Applies To | Severity | Source Docs | Deterministic or Advisory | Uncertainty / Failure Fallback | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `CLOUD-LABEL-PROVIDER-ORDER` | cloud label extraction | major | `docs/specs/FULL_PRODUCT_SPEC.md`; `docs/specs/TTB-207/feature-spec.md` | deterministic routing policy | none | cloud label extraction should attempt Gemini before OpenAI |
| `INLINE-ONLY-MEDIA` | image and PDF label intake | blocker | `docs/specs/FULL_PRODUCT_SPEC.md`; `docs/specs/TTB-207/constitution-check.md` | deterministic privacy policy | fail closed | Gemini path may use inline bytes only, not Files API or durable uploads |
| `RETRYABLE-CLOUD-FALLBACK` | Gemini cloud failures | major | `docs/specs/TTB-207/feature-spec.md`; `docs/specs/TTB-207/performance-budget.md` | deterministic routing policy | retryable error when fallback is not safe | OpenAI fallback is allowed only for explicitly retryable and budget-safe failures |
| `FAIL-CLOSED-PRIVACY-OR-PARSE` | Gemini privacy, capability, or normalization failures | blocker | `docs/specs/TTB-207/feature-spec.md`; `docs/specs/TTB-207/privacy-checklist.md` | deterministic routing policy | structured error | privacy-boundary, unsupported-capability, and deterministic parse/normalization failures must not fall through |
| `MODEL-ONLY-EXTRACTION` | all extraction routes | blocker | `docs/specs/FULL_PRODUCT_SPEC.md`; `AGENTS.md` | deterministic architecture policy | validators downgrade uncertainty to `review` | provider swap must not move compliance judgment into the model |
