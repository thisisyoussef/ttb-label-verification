# Active Context

- Current focus: `TTB-207` is complete with Gemini-primary cloud routing, a shared cross-provider extraction schema/prompt layer, sanitized LangSmith comparison traces, and a documented not-yet-production-ready latency note; `TTB-208` is now the next ready Codex story, `TTB-108` remains the next Claude story, `TTB-209` still follows the latency-observability work, and the restricted-network local mode remains planned as `TTB-212`.
- Current story branch: `codex/TTB-207-gemini-cloud-fallback` in the clean sibling worktree `/Users/youss/Development/gauntlet/ttb-label-verification-207`.
- `TTB-207` implementation landed in the shared provider stack: `src/server/gemini-review-extractor.ts`, `src/server/review-extraction-model-output.ts`, `src/server/review-extractor-factory.ts`, `src/server/index.ts`, and `src/server/batch-session.ts` now route label extraction through `gemini,openai` while preserving the existing typed extraction/report contract.
- The shared extraction prompt/profile identifiers now read as `review-extraction/cloud-cross-provider-v1` and `structured-output-shared-schema-v1` in `src/server/llm-policy.ts`, and `src/server/llm-trace.ts` now annotates the actual provider inferred from the returned model id.
- Repo-local Gemini runtime config is now present through ignored local env files; bootstrap defaults now seed `GEMINI_VISION_MODEL=gemini-2.5-flash-lite` and `AI_CAPABILITY_LABEL_EXTRACTION_ORDER=gemini,openai`.
- On 2026-04-14, `LANGSMITH_TRACING=true npm run eval:golden` passed with 18/18 fixture-backed endpoint evals green and recorded experiment sessions for the review, extraction, warning, and batch route families.
- On the same day, sanitized real-provider comparison traces favored `gemini-2.5-flash-lite` over `gpt-5.4` on generated PDF labels: clean `4548 ms` vs `11612 ms`, warning-defect `5284 ms` vs `11394 ms`, blank/no-text `4419 ms` vs `9920 ms`.
- The current `GEMINI_TIMEOUT_MS=3000` default still timed out on sanitized clean PDF and PNG smoke passes, so the Gemini path is implemented but not yet production-ready without the timing and policy work in `TTB-208` and `TTB-209`.
- Fast retryable fallback and late-timeout behavior are now measured at the routed surface: forced early Gemini failure recovered through OpenAI in `258 ms`, while a forced late timeout returned a `504` in `344 ms` without starting a second provider call.
- The remaining privacy checklist gap is operational, not code-level: the Gemini project's AI Studio logging and dataset-sharing settings still require manual verification before anyone calls the Gemini default production-ready.
- The live core-six image-backed comparison slice is still blocked by the missing binaries under `evals/labels/assets/`, so `TTB-207` records sanitized local fixture traces as the interim provider-comparison evidence.
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI.
- Current contract anchor: `src/shared/contracts/review.ts`.
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
