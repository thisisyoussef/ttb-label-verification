# Active Context

- Current focus: `TTB-209` first-result timeout follow-up on `codex/TTB-209-first-result-timeout`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: keep pathological single-review requests from hanging for tens of seconds or minutes by enforcing an internal 8s first-result budget, clamping provider waits to the remaining route budget, and only starting fallback when the next attempt can still fit
- Current implementation shape: `src/server/review/review-latency.ts` now carries `firstResultBudgetMs`, single-review route captures wire that budget through `src/server/routes/register-review-routes.ts` and `src/server/routes/review-stream-route.ts`, Gemini and OpenAI clamp their own request lifetime to the remaining budget, the extractor factory uses the next provider's attempt budget plus a deterministic reserve for fallback handoff, and `src/server/llm/llm-trace.ts` skips or clamps optional helper stages near the deadline
- Current verification state: focused extractor/latency tests, adjacent trace and route latency suites, full `npm run test`, `npm run typecheck`, `npm run build`, and `npm run --silent guard:source-size` are green; `npm run gate:commit` needs one final rerun after tracker and memory sync
- Current durable caution: the public latency claim stays `5000 ms`; the new `8000 ms` value is an internal tail bound for first result behavior, not a new reviewer-facing promise
- GitHub repo and Railway project remain live; this follow-up is still local and unpublished
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
