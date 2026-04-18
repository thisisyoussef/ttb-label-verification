# Active Context

- Current focus: finish the `TTB-EVAL-002` merge flow from `/Users/youss/Development/gauntlet/ttb-label-verification-ttb-eval-002`, then return the queue to `TTB-210` persona-centered prompt profiles and endpoint plus mode guardrails.
- Current story branch: `codex/TTB-EVAL-002-gemini-batch-golden-set`.
- `TTB-EVAL-002` adds an opt-in inline Gemini Batch benchmark path for the approved live extraction corpus, reuses the runtime Gemini extraction request plus schema seam, and preserves `npm run eval:golden` as the canonical fixture-backed gate.
- 2026-04-18 dry-run verification is green: `npx tsx scripts/run-gemini-batch-extraction-benchmark.ts --dry-run --output evals/results/2026-04-18-TTB-EVAL-002-gemini-batch-dry-run.json` reported 35 approved cases and an estimated inline payload of `2,104,561` bytes, well under the `19,922,944` byte ceiling.
- Live Gemini Batch submission is intentionally opt-in; job `batches/zciec1j41bshzbm1n77tufdc3a85ynp9578o` was launched during publish verification and remains provider-side async until the results file is ready.
- `TTB-WF-003` is fully merged via PRs #106 and #108, so direct branch work, automatic repo-local env bootstrap, and tracker-closeout hygiene are all part of the baseline workflow.
- The next queue blocker after this merge is `TTB-210`, where traced LangSmith evidence is still blocked by `401 /datasets` in the tracked eval flow and `403` on direct trace upload.
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI.
- Current contract anchor: `src/shared/contracts/review.ts`.
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
