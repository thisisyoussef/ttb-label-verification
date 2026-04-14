# Feature Spec

## Story

- Story ID: `TTB-206`
- Title: extraction mode routing foundation and privacy-safe cloud/local provider policy

## Problem statement

The intelligence layer currently hard-codes one cloud extraction path at the callsite boundary. That blocks both halves of the tailored roadmap:

- cloud mode with Gemini-primary and OpenAI fallback
- local mode with no outbound model calls

Without a top-level extraction-mode router, the app cannot express Marcus's restricted-network deployment story cleanly, and any future fallback behavior risks mixing cloud and local concerns in the wrong place.

## User-facing outcomes

- Cloud vs local extraction becomes an explicit product capability instead of an env accident.
- Provider outages or temporary capability gaps no longer require route rewrites inside a mode boundary.
- Single-label and batch execution can share one typed extraction-mode and provider-selection policy.
- The current review payload and approved UI stay unchanged while the provider layer evolves.

## Acceptance criteria

1. The server has a typed extraction-mode policy that resolves `cloud` vs `local` before provider selection happens.
2. The default extraction mode remains `cloud`, while a request-scoped override seam exists for the later UI selector story.
3. Inside cloud mode, the default order remains `openai,gemini` for unspecified capabilities, while label extraction stays independently configurable for the later Gemini-primary cutover.
4. Local mode resolves through its own provider path and does not silently fall back into cloud providers when explicitly selected.
5. Existing OpenAI extraction logic is wrapped behind the new abstraction instead of being instantiated directly in routes or batch orchestration.
6. Provider and mode failures normalize into the existing `ReviewError` taxonomy and include enough structure for the router to decide whether fallback is allowed inside a mode boundary.
7. Env/bootstrap docs add Gemini, local-mode, and Ollama config without changing the live default behavior yet.
8. Privacy rules are explicit and testable for both boundaries: Gemini stays inline-only with logging disabled, and local mode stays no-cloud when selected.

## Edge cases

- Gemini credentials are missing but OpenAI is configured.
- Local mode is selected but Ollama is unavailable.
- A capability requests a provider that is unknown or duplicated in env config.
- A provider is selected for a capability it does not support yet.
- A provider returns a schema/parse failure that is unsafe to silently hide.
- A fallback would cross the cloud/local boundary and violate the user's execution-mode choice.

## Out of scope

- Making Gemini the live default label-extraction provider.
- Shipping the local execution adapter itself.
- Changing `VerificationReport`, `ReviewExtraction`, or the approved UI contract.
- Using Gemini Files API, AI Studio datasets, or any durable provider-side upload surface.
