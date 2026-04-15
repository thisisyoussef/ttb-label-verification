# Active Context

- Current focus: Railway staging and production were verified live on 2026-04-15, and the discarded `TTB-212` local-model packet was moved to `docs/specs/archive/TTB-212/` at the user's request.
- Current story branch: local-model work is not active; the old `codex/TTB-212-local-extraction-mode` branch context should be treated as archived history only.
- `TTB-209` kept the public `latencyBudgetMs` contract at `5000`, locked the winning Gemini profile (`gemini-2.5-flash-lite`, raster `low`, PDF `medium`, Flash-family `thinkingBudget=0`), and raised the checked-in `GEMINI_TIMEOUT_MS` default from `3000` to `5000`.
- The shared timing model now records provider name, attempt, observed service tier, and Gemini prompt/thought token counts without changing the public `VerificationReport` contract.
- The repo now includes a checked-in synthetic 20-case latency slice under `evals/labels/assets/` plus `evals/labels/latency-twenty.manifest.json`.
- On 2026-04-14 in the final TTB-209 pass, `npx vitest run src/server/gemini-review-extractor.test.ts src/server/openai-review-extractor.test.ts src/server/review-extractor-factory.test.ts src/server/review-extraction-model-output.test.ts scripts/validate-evals.test.ts`, `npm run evals:validate`, `npm test`, `npm run typecheck`, `npm run build`, and `npm run gate:commit` all passed.
- Measured TTB-209 timeout note: `GEMINI_TIMEOUT_MS=3000` produced `20/20` review timeouts on the checked-in 20-case slice, while `5000` improved the same slice to `13/20` success with `4657 ms` average and `5018 ms` p95.
- The remaining Gemini release caveat is operational, not code-level: AI Studio logging and dataset-sharing settings still require manual verification before any production-ready Gemini-default claim.
- `TTB-108` is already complete on `main`: the signed-in extraction-mode selection step, mode-aware processing/failure states, timeout-warning shell behavior, and guided-tour recovery/gating fixes remain the live shell baseline.
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI.
- Current contract anchor: `src/shared/contracts/review.ts`.
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
- `TTB-210` is now the active Codex story in the sibling worktree `codex/TTB-210-prompt-guardrails`.
- The shared extraction seam now resolves prompt policy from endpoint surface + extraction mode through `src/server/review-prompt-policy.ts`, and structural post-parse degradation through `src/server/review-extractor-guardrails.ts`.
- Local verification for `TTB-210` is green: `npm run test`, `npm run typecheck`, `npm run build`, `npm run eval:golden`, and `npm run langsmith:smoke`.
- External trace publication for `TTB-210` is still blocked by LangSmith auth: the Vitest tracked eval path fails on `401 /datasets`, and direct traced upload attempts return `403 Forbidden` after generating local trace ids.
