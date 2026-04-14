# Technical Plan

## Scope

Create the provider-routing and policy foundation needed for a Gemini-primary multimodal extraction story without changing the current live default yet.

## Planned modules and files

- `src/server/ai-provider-policy.ts`
  - capability enum, provider enum, env parsing, ordered-provider resolution, and fallback eligibility helpers
- `src/server/ai-provider-policy.test.ts`
  - unit coverage for config parsing, duplicate/unknown providers, and fallback classification
- `src/server/review-extractor-factory.ts`
  - create the extractor from ordered providers instead of binding OpenAI directly in `index.ts`
- `src/server/openai-review-extractor.ts`
  - adapt the existing OpenAI extractor to the new provider interface without changing its live behavior
- `src/server/index.ts`
  - consume the factory/router instead of hard-coding OpenAI at boot
- `src/server/batch-session.ts`
  - use the same extractor abstraction so batch inherits provider policy automatically
- `scripts/bootstrap-local-env.ts`
  - add Gemini env slots and provider-order defaults

## Capability policy

- Capability-specific order:
  - `label-extraction` -> configured separately for `TTB-207`
- Default order for all other model-backed capabilities:
  - `openai,gemini`
- Initial named capabilities:
  - `label-extraction`
  - `structured-text`
  - `embeddings`

The repo only implements `label-extraction` today, but future callsites must route through the same policy and inherit the default Gemini fallback order instead of instantiating provider SDKs directly.

## Provider contract

Each provider leg should expose:

- `provider`: `openai` or `gemini`
- `supports(capability)`
- `execute(...)`
- normalized failure metadata:
  - `kind`
  - `retryable`
  - `fallbackAllowed`
  - `reason`

`fallbackAllowed` is the key router control. Privacy violations, unsupported capability mismatches, and deterministic normalization bugs should fail closed instead of silently hopping to another provider.

## Privacy policy

- OpenAI remains bound to Responses + `store: false`.
- Gemini must use inline bytes only for this product. The official Files API stores files for 48 hours, which is incompatible with the product invariant.
- The target Gemini project must keep API logging disabled. AI Studio logging is opt-in, persists logs for 55 days by default, and shared datasets may be used for model improvement.

## Risks and fallback

- Risk: a generic provider layer becomes heavier than the codebase needs.
  - Fallback: keep the abstraction capability-scoped and flat. One resolver file, one extractor factory, one adapter per provider.
- Risk: future callsites bypass the router and recreate provider drift.
  - Fallback: centralize runtime config and factory creation so new AI features have one obvious path.
- Risk: fallback logic hides meaningful provider regressions.
  - Fallback: normalize provider errors, allow only explicit fallback classes, and require route-level tests that prove which provider won.

## Testing strategy

- unit:
  - provider-order env parsing
  - capability resolution
  - fallback eligibility classification
- integration:
  - extractor-factory routing with injected fake providers
  - route boot with Gemini absent / OpenAI present
  - route boot with invalid provider order config
- contract:
  - current OpenAI-backed `ReviewExtraction` and `VerificationReport` payloads stay unchanged
- mutation-worthy modules:
  - provider-order parser and fallback classifier
