# Technical Plan

## Scope

Create the extraction-mode and provider-policy foundation needed for a dual-mode extraction architecture without changing the current live default yet.

## Planned modules and files

- `src/server/ai-provider-policy.ts`
  - capability enum, extraction-mode enum, provider enum, env parsing, mode resolution, ordered-provider resolution, and fallback eligibility helpers
- `src/server/ai-provider-policy.test.ts`
  - unit coverage for config parsing, duplicate/unknown providers, and fallback classification
- `src/server/review-extractor-factory.ts`
  - create the extractor from selected extraction mode and ordered providers instead of binding OpenAI directly in `index.ts`
- `src/server/openai-review-extractor.ts`
  - adapt the existing OpenAI extractor to the new provider interface without changing its live behavior
- `src/server/index.ts`
  - consume the mode-aware factory/router instead of hard-coding OpenAI at boot
- `src/server/batch-session.ts`
  - use the same extractor abstraction so batch inherits provider policy automatically
- `scripts/bootstrap-local-env.ts`
  - add Gemini env slots, extraction-mode defaults, and local-mode env slots

## Extraction-mode policy

- Mode-specific resolution:
  - `cloud`
  - `local`
- Default mode:
  - `cloud`
- Request-scoped override:
  - planned here as a first-class seam so `TTB-108` can wire a UI selector later without inventing a second routing path

Mode is the top-level boundary. Cloud fallback stays inside cloud mode. Local mode stays local-only when explicitly selected.

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

`fallbackAllowed` is the key router control. Privacy violations, unsupported capability mismatches, deterministic normalization bugs, and cross-mode escapes should fail closed instead of silently hopping to another provider.

## Privacy policy

- OpenAI remains bound to Responses + `store: false`.
- Gemini must use inline bytes only for this product. The official Files API stores files for 48 hours, which is incompatible with the product invariant.
- The target Gemini project must keep API logging disabled. AI Studio logging is opt-in, persists logs for 55 days by default, and shared datasets may be used for model improvement.
- Local mode must not make outbound cloud model calls once explicitly selected. The local host target should default to loopback or same-host deployment wiring.

## Risks and fallback

- Risk: a generic mode and provider layer becomes heavier than the codebase needs.
  - Fallback: keep the abstraction flat. One resolver file, one extractor factory, one adapter per provider.
- Risk: future callsites bypass the router and recreate provider drift.
  - Fallback: centralize runtime config and factory creation so new AI features have one obvious path.
- Risk: fallback logic hides meaningful provider regressions.
  - Fallback: normalize provider errors, allow only explicit fallback classes, and require route-level tests that prove which provider won.
- Risk: local-mode selection later gets bolted on as a second routing path outside the foundation.
  - Fallback: define the request-scoped mode seam now, even though the selector UI lands in a later story.

## Testing strategy

- unit:
  - extraction-mode env parsing
  - provider-order env parsing
  - capability resolution
  - fallback eligibility classification, including cross-mode fail-closed cases
- integration:
  - extractor-factory routing with injected fake providers
  - route boot with local mode configured but unavailable
  - route boot with Gemini absent / OpenAI present
  - route boot with invalid provider order config
- contract:
  - current OpenAI-backed `ReviewExtraction` and `VerificationReport` payloads stay unchanged
- mutation-worthy modules:
  - provider-order parser and fallback classifier
