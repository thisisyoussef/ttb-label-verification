# Active Context

- Current focus: `TTB-WF-002` maintenance cleanup is complete on `codex/TTB-WF-002-source-cleanup`; next Codex pickup is `TTB-212`.
- Current story branch: `codex/TTB-WF-002-source-cleanup` in `/Users/youss/Development/gauntlet/ttb-label-verification-wf-002`.
- `TTB-209` kept the public `latencyBudgetMs` contract at `5000`, locked the winning Gemini profile (`gemini-2.5-flash-lite`, raster `low`, PDF `medium`, Flash-family `thinkingBudget=0`), and raised the checked-in `GEMINI_TIMEOUT_MS` default from `3000` to `5000`.
- The shared timing model now records provider name, attempt, observed service tier, and Gemini prompt/thought token counts without changing the public `VerificationReport` contract.
- The repo now includes a checked-in synthetic 20-case latency slice under `evals/labels/assets/` plus `evals/labels/latency-twenty.manifest.json`.
- On 2026-04-14 in the final TTB-209 pass, `npx vitest run src/server/gemini-review-extractor.test.ts src/server/openai-review-extractor.test.ts src/server/review-extractor-factory.test.ts src/server/review-extraction-model-output.test.ts scripts/validate-evals.test.ts`, `npm run evals:validate`, `npm test`, `npm run typecheck`, `npm run build`, and `npm run gate:commit` all passed.
- Measured TTB-209 timeout note: `GEMINI_TIMEOUT_MS=3000` produced `20/20` review timeouts on the checked-in 20-case slice, while `5000` improved the same slice to `13/20` success with `4657 ms` average and `5018 ms` p95.
- The remaining Gemini release caveat is operational, not code-level: AI Studio logging and dataset-sharing settings still require manual verification before any production-ready Gemini-default claim.
- `TTB-WF-002` kept runtime behavior stable while shrinking the remaining mixed-responsibility auth, guided-tour, and server app composition files; the source-size guard remains wired into commit and push gates.
- `TTB-108` is already complete on `main`: the signed-in extraction-mode selection step, mode-aware processing/failure states, timeout-warning shell behavior, and guided-tour recovery/gating fixes remain the live shell baseline.
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI.
- Current contract anchor: `src/shared/contracts/review.ts`.
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
