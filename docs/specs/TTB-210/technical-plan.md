# Technical Plan

## Scope

Harden the shared extraction path with endpoint-aware and mode-aware prompt policy plus structural guardrails so every current model-backed route serves the user promise of that route without forking the contract surface.

## Planned modules and files

- `src/server/review-prompt-policy.ts`
  - base extraction policy, endpoint overlays, mode overlays, and provider-agnostic prompt assembly
- `src/server/review-prompt-policy.test.ts`
  - unit coverage for overlay selection, persona/user priorities, and prompt composition
- `src/server/review-extractor-guardrails.ts`
  - structural output checks, suspicious-output classification, and route-aware degradation helpers
- `src/server/review-extractor-guardrails.test.ts`
  - unit coverage for sparse output, hallucination patterns, warning-block completeness, and safe degradation
- `src/server/openai-review-extractor.ts`
  - consume the prompt-policy and guardrail modules instead of embedding a route-agnostic prompt string
- `src/server/gemini-review-extractor.ts`
  - consume the same prompt-policy and guardrail modules once the Gemini path exists
- `src/server/review-extractor-factory.ts`
  - pass endpoint intent through the shared extraction entry point
- `src/server/index.ts`
  - route `/api/review`, `/api/review/extraction`, and `/api/review/warning` through explicit endpoint intents
- `src/server/batch-session.ts`
  - route item processing through the same canonical `review` extraction overlay and inline report pipeline used by single review while keeping batch session orchestration intact

## Prompt-policy model

Use one shared prompt-policy contract:

- common extraction baseline:
  - extract only
  - never decide compliance
  - never infer unsupported text from application data
  - prefer explicit absence, low confidence, and notes over fabricated certainty
  - always return bounded uncertainty for weak visual judgments
- endpoint overlay:
  - `review`
  - `extraction`
  - `warning`
- mode overlay:
  - `cloud`
  - `local`
- provider surface:
  - OpenAI and Gemini consume the same policy intent on the shipped path

This keeps the repo from growing separate prompt strings per route or per execution mode while still acknowledging that route goals and model limits differ.

## Guardrail model

Guardrails should operate after schema parse and before route response shaping.

Targets:

- reject outputs that are structurally incomplete in a way the route cannot trust
- downgrade suspicious certainty instead of preserving brittle high-confidence claims
- preserve valid "field absent" or "warning absent" evidence when the output is internally consistent
- keep batch failures item-local without creating a separate batch-only extraction or resolver path

Examples:

- `review`: protect against sparse but overconfident field extraction that would create noisy comparison results for Dave
- `review`: keep non-label or no-text auto-detect cases at `unknown` instead of letting the strict distilled-spirits fallback create a fake commodity classification
- `warning`: require explicit warning field plus warning-signal blocks, but allow genuine warning absence to flow into deterministic validation
- `extraction`: preserve the richest bounded notes for debugging and follow-on validators
- `batch`: keep the session moving while flagging the specific row that degraded, but derive extraction and report behavior from the same single-review path
- `local` mode: aggressively downgrade weak formatting or spatial certainty before it reaches deterministic checks

## User-centered intent

- Dave: reduce "that's not dumb" failures by preferring abstention over overconfident guesses.
- Jenny: keep confidence and note quality high enough that expanded evidence panels remain useful.
- Sarah: align endpoint behavior so demos do not contradict themselves.
- Marcus: make prompt privacy and failure handling documentable as policy.
- Janet: keep per-item degradation contained and stable in batch runs.

## Risks and fallback

- Risk: prompt overlays become too different and create route drift.
  - Fallback: keep one shared baseline and make overlays small, purpose-specific deltas only.
- Risk: local-mode prompts fork too far from cloud mode and become a second extraction product.
  - Fallback: keep local behavior changes limited to conservative confidence posture and unsupported-claim abstention.
- Risk: guardrails become so strict that valid missing-field evidence is treated as adapter failure.
  - Fallback: guardrail only on structural inconsistency and suspicious certainty, not on deterministic compliance outcomes.
- Risk: prompt growth pushes latency upward.
  - Fallback: keep overlays short, measure prompt/guardrail overhead explicitly, and trim wording before touching the provider/model choice.

## Testing strategy

- unit:
  - prompt assembly and overlay selection
  - guardrail classification and route-aware degradation
- contract:
  - current `ReviewExtraction` and `VerificationReport` payloads remain stable
  - non-default submitted values survive through route handlers using the new prompt-policy path
- integration:
  - `/api/review`
  - `/api/review/extraction`
  - `/api/review/warning`
  - batch item execution through the shared extractor
- trace and eval:
  - run the smallest approved slice that exercises clean, warning-defect, cosmetic-mismatch, low-quality, standalone, and batch-consistency behavior
- mutation-worthy modules:
  - guardrail classifier and any new pure prompt-policy branching helpers
