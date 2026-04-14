# Feature Spec

## Story

- Story ID: `TTB-206`
- Title: provider routing foundation and privacy-safe Gemini/OpenAI capability policy

## Problem statement

The intelligence layer currently hard-codes OpenAI at the callsite boundary. That blocks a Gemini-primary multimodal migration, makes fallback behavior ad hoc, and leaves no single place to enforce cross-provider privacy rules or future capability defaults.

## User-facing outcomes

- Provider outages or temporary capability gaps no longer require route rewrites.
- Single-label and batch execution can share one typed provider-selection policy.
- The current review payload and approved UI stay unchanged while the provider layer evolves.

## Acceptance criteria

1. The server has a typed provider capability registry that resolves an ordered provider list per capability.
2. The default order is `openai,gemini` for unspecified capabilities, while label extraction is independently configurable for the later Gemini-primary cutover.
3. Existing OpenAI extraction logic is wrapped behind the provider interface instead of being instantiated directly in routes or batch orchestration.
4. Provider failures normalize into the existing `ReviewError` taxonomy and include enough structure for the router to decide whether fallback is allowed.
5. Env/bootstrap docs add Gemini credentials and provider-order config without changing the live default behavior yet.
6. Privacy rules for Gemini are explicit and testable: no Files API, no opt-in API logging/datasets, and no raw prompt/response dumping.
7. The packet defines the routing bridge future OpenAI-backed capabilities must use if they want Gemini fallback, instead of inventing a second provider pattern later.

## Edge cases

- Gemini credentials are missing but OpenAI is configured.
- A capability requests a provider that is unknown or duplicated in env config.
- A provider is selected for a capability it does not support yet.
- A provider returns a schema/parse failure that is unsafe to silently hide.
- A fallback would violate the single-label latency budget because the primary failure arrived too late.

## Out of scope

- Making Gemini the live default label-extraction provider.
- Changing `VerificationReport`, `ReviewExtraction`, or the approved UI contract.
- Using Gemini Files API, AI Studio datasets, or any durable provider-side upload surface.
