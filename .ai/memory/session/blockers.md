# Blockers

- `TTB-EVAL-002` has no code blocker. Live Gemini Batch execution remains intentionally opt-in because submitting the provider job spends external API cost and completes asynchronously.
- Current broader-queue blocker: `TTB-210` traced evidence still cannot publish after the batch-to-single prompt/report alignment because the current LangSmith credentials fail with `401 Unauthorized` on `/datasets` in the tracked eval flow and `403 Forbidden` on direct trace upload.
- Targeted mutation coverage for `src/server/review-extraction.ts` is still blocked locally because the current Stryker harness first exhausted temp space (`ENOSPC`) and then failed a sandbox asset copy (`ENOENT` on hashed `dist/assets` output).
- Authoritative live core-six extraction verification is still blocked by the absence of curated internal label files; `evals/labels/assets/` contains synthetic smoke PNGs, but they are not the final source-of-truth corpus.
- AI Studio logging and dataset-sharing settings for the Gemini project cannot be verified from repo code or the API key alone; that remains a manual release gate before any production-ready Gemini-default claim.
- Known future dependency: rule-ingestion work will need authoritative TTB source normalization before production-grade validators can be completed.
- Known future dependency: `TTB-401` remains blocked on `TTB-210`.
- `TTB-304`: no functional blocker in the clean publish worktree; remaining work is publish flow only.
