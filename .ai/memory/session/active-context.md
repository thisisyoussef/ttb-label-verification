# Active Context

- Current focus: `TTB-208` is complete with privacy-safe stage timing, routed fallback-path classification, batch-item latency summaries, and synthetic internal core-six smoke assets; active Codex work has moved onto the sibling latency branch `codex/TTB-209-hot-path-optimization` for hot-path tuning, and the restricted-network local mode still remains planned as `TTB-212`.
- Current story branch: `codex/TTB-209-hot-path-optimization` in the clean sibling worktree `/Users/youss/Development/gauntlet/ttb-label-verification-207`.
- User requested that `TTB-WF-002` be pulled forward as the next maintenance story after the active latency branch is finalized and merged.
- `TTB-208` implementation landed in the shared route graph: `src/server/review-latency.ts`, `src/server/review-extractor-factory.ts`, `src/server/openai-review-extractor.ts`, `src/server/gemini-review-extractor.ts`, `src/server/llm-trace.ts`, `src/server/index.ts`, `src/server/request-handlers.ts`, and `src/server/batch-session.ts` now emit typed internal timing summaries for single-label and batch work.
- The shared timing model records stage ids, provider ids, attempt labels, bounded outcomes, fallback-path classification, and total duration without changing the public `VerificationReport` contract.
- Repo-local Gemini runtime config is still present through ignored local env files; bootstrap defaults still seed `GEMINI_VISION_MODEL=gemini-2.5-flash-lite` and `AI_CAPABILITY_LABEL_EXTRACTION_ORDER=gemini,openai`.
- On 2026-04-14, `npm run evals:validate`, `npm run eval:golden`, `npm test`, `npm run typecheck`, and `npm run build` all passed after the latency work landed.
- Fixture-backed probes now show bounded internal summaries on the route graph: review `59 ms` outer / `16 ms` internal, extraction `5 ms` / `2 ms`, warning `5 ms` / `2 ms`, and batch `15 ms` outer / `2 ms` per item.
- Routed observer probes classify the intended cloud branches: primary success `12 ms`, fast-fail fallback success `1 ms`, late-fail retryable exit `17 ms`, and pre-provider failure `0 ms`.
- Synthetic core-six PNGs now exist under `evals/labels/assets/` and were generated through the Gemini image generation path for internal smoke work; they remain explicitly non-authoritative fixtures.
- The current `GEMINI_TIMEOUT_MS=3000` default still timed out on sanitized clean PDF and PNG smoke passes, so the Gemini path is implemented and instrumented but not yet production-ready without `TTB-209` hot-path tuning.
- The remaining privacy checklist gap is operational, not code-level: the Gemini project's AI Studio logging and dataset-sharing settings still require manual verification before anyone calls the Gemini default production-ready.
- `TTB-108` is already complete on `main`: the signed-in extraction-mode selection step, mode-aware processing/failure states, timeout-warning shell behavior, and guided-tour recovery/gating fixes are now part of the live shell baseline that `TTB-209` will optimize against.
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI.
- Current contract anchor: `src/shared/contracts/review.ts`.
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
