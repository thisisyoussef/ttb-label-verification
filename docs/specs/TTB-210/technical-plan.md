# Technical Plan

## Scope

Harden the shared extraction path with endpoint-aware and mode-aware prompt policy plus structural guardrails so every current model-backed route serves the user promise of that route without forking the contract surface.

## Follow-up slice: literal anchor field priority

This follow-up keeps the original `TTB-210` top-down vs bottom-up split but
applies it more directly at the field row:

- strong literal anchors on app-backed text fields should beat a contradictory
  bottom-up read for that field
- whole-label verdicts must still flow through the existing deterministic
  blocker and weighted-verdict path
- warning text, warning visual signals, and other layout/spatial judgments stay
  bottom-up only
- sparse, partial, and equivalent-only anchor signals stay advisory rather than
  taking priority over the row on their own

This preserves the speed and precision of the "does the label contain the
approved text?" path without letting anchor-only evidence wash out unrelated
defects elsewhere on the label.

## Planned modules and files

- `src/server/review-prompt-policy.ts`
  - base extraction policy, endpoint overlays, mode overlays, and provider-agnostic prompt assembly
- `src/server/review-prompt-policy.test.ts`
  - unit coverage for overlay selection, persona/user priorities, and prompt composition
- `src/server/review-extractor-guardrails.ts`
  - structural output checks, suspicious-output classification, and route-aware degradation helpers
- `src/server/review-extractor-guardrails.test.ts`
  - unit coverage for sparse output, hallucination patterns, warning-block completeness, and safe degradation
- `src/server/review-relevance.ts`
  - OCR-backed relevance preflight that scores label-specific signals before the expensive extract-only path
- `src/server/review-relevance.test.ts`
  - unit coverage for likely, uncertain, unlikely, multi-image, and OCR-unavailable quick-scan decisions
- `src/server/review-relevance-route.test.ts`
  - route coverage proving `/api/review/relevance` stays extractor-free and merges dual-image OCR signals
- `src/server/trace-runtime.ts`
  - local no-op trace wrapper that keeps metadata flow and timing helpers intact without depending on an external tracing service
- `src/server/openai-review-extractor.ts`
  - consume the prompt-policy and guardrail modules instead of embedding a route-agnostic prompt string, without wrapping the client in an external trace adapter
- `src/server/gemini-review-extractor.ts`
  - consume the same prompt-policy and guardrail modules once the Gemini path exists
- `src/server/review-extractor-factory.ts`
  - pass endpoint intent through the shared extraction entry point
- `eval.vitest.config.ts`
  - dedicated local eval config for the fixture-backed endpoint gate after the external trace-specific harness removal
- `scripts/bootstrap-local-env.ts`
  - keep repo-local env bootstrap focused on runtime model configuration instead of external tracing credentials
- `src/server/index.ts`
  - route `/api/review`, `/api/review/extraction`, and `/api/review/warning` through explicit endpoint intents
- `src/client/ReviewRelevanceBanner.tsx`
  - intake-only quick-break warning state for unlikely uploads
- `src/client/useExtractionPrefetch.ts`
  - call the relevance preflight first, then start extract-only only when the quick scan says the upload is likely relevant
- `src/client/useSingleReviewFlow.ts`
  - gate Verify on `unlikely-label` quick-scan results unless the reviewer explicitly continues anyway
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

## Relevance-preflight model

Add one deterministic pre-provider branch before the existing extract-only prefetch:

- upload normalize
- OCR prepass on the selected image set
- derive label-specific relevance signals:
  - alcohol content
  - net contents
  - government warning
  - beverage class/type
  - applicant or country cues
- classify:
  - `likely-label`
  - `uncertain`
  - `unlikely-label`
- only `likely-label` starts the background extract-only prefetch automatically

The canonical `/api/review` route remains unchanged. The preflight is a speed and UX gate, not a hard validator.

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
- Risk: the quick relevance preflight becomes overconfident and blocks real labels with weak OCR.
  - Fallback: keep the preflight advisory only, preserve `Continue anyway`, and bias ambiguous reads to `uncertain` rather than `unlikely-label`.

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
  - run the smallest approved local slice that exercises clean, warning-defect, cosmetic-mismatch, low-quality, standalone, and batch-consistency behavior
  - preserve timing and metadata flow locally without requiring external trace auth or storage
- mutation-worthy modules:
  - guardrail classifier and any new pure prompt-policy branching helpers
