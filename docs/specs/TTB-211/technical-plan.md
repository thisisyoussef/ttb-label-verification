# Technical Plan

## Scope

Turn the existing corpus-first eval setup into an endpoint-aware, mode-aware, and persona-aware regression gate for the current model-backed route graph.

## Planned files

- `evals/golden/manifest.json`
  - add endpoint-applicability and extraction-mode metadata plus any new route-oriented slices that keep the corpus selection small
- `evals/llm/review-surfaces.eval.ts`
  - LangSmith-backed fixture golden tests for `/api/review`, `/api/review/extraction`, and `/api/review/warning`
- `evals/llm/batch-surfaces.eval.ts`
  - LangSmith-backed fixture golden tests for `/api/batch/run` and `/api/batch/retry`
- `evals/llm-endpoint-matrix.md`
  - checked-in route-to-promise matrix for the current model-backed surfaces
- `evals/persona-scorecards.md`
  - explicit Sarah, Dave, Jenny, Marcus, and Janet review questions
- `evals/README.md`
  - document how endpoint-aware and mode-aware slices plus persona scorecards are selected
- `evals/results/TEMPLATE.md`
  - add endpoint/mode/provider/prompt-profile/guardrail/persona result sections
- `src/server/llm-trace.ts`
  - privacy-safe LangSmith wrappers for the shared extraction capability plus root surface traces and nested deterministic follow-on spans
- `src/server/llm-policy.ts`
  - extraction-mode, provider, prompt-profile, guardrail-policy, and endpoint-surface identity constants
- `docs/process/TRACE_DRIVEN_DEVELOPMENT.md`
  - add endpoint and prompt-profile recording expectations for trace reviews
- `.github/workflows/ci.yml`
  - run the fixture-backed golden LLM gate before staging deploy can trigger
- `docs/specs/TTB-401/story-packet.md`
  - consume the new endpoint-aware eval evidence at release time

## Endpoint matrix

- `/api/review`
  - primary reviewer trust surface
  - compare `cloud` vs `local` where supported
  - personas: Sarah, Dave, Jenny, Marcus
- `/api/review/extraction`
  - extraction completeness and uncertainty surface
  - compare `cloud` vs `local` where supported
  - personas: Jenny, Codex engineering, Marcus
- `/api/review/warning`
  - showcase warning-fidelity surface
  - compare `cloud` vs `local` where supported
  - personas: Sarah, Jenny, Dave
- batch item processing (`/api/batch/run`, retry path)
  - high-volume stability surface
  - compare `cloud` vs `local` where supported
  - personas: Janet, Sarah, Marcus

## Persona scorecards

- Sarah:
  - demo consistency
  - latency discipline
  - clear failure behavior
- Dave:
  - no dumb false rejects or false reviews on cosmetic cases
  - uncertainty stays reversible
- Jenny:
  - evidence completeness
  - confidence usefulness
  - warning-fidelity quality
- Marcus:
  - no-persistence proof in eval/trace artifacts
  - provider, mode, and prompt provenance is documented
- Janet:
  - batch item consistency
  - repeated-run stability
  - failure containment per row

## Risks and fallback

- Risk: endpoint scorecards become subjective prose instead of repeatable evidence.
  - Fallback: keep the scorecards tied to named cases, route surfaces, and concrete pass/fail heuristics.
- Risk: the eval matrix grows too large to run routinely.
  - Fallback: preserve the smallest-applicable-slice rule and make endpoint slices additive rather than mandatory full-set runs.
- Risk: trace notes leak more user data than the runtime allows.
  - Fallback: keep fixture-only trace runs and record only bounded technical metadata in run logs.

## Verification strategy

- documentation diff review for new endpoint metadata and templates
- manifest validation after any golden/live manifest changes
- one recorded dry run using the updated template and endpoint plus mode matrix during implementation
- targeted route tests proving the server uses the surface-level trace wrappers instead of tracing only the extractor
