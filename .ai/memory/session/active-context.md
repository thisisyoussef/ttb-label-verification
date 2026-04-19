# Active Context

- Current focus: `TTB-210` persona-centered prompt profiles and endpoint plus mode guardrails
- Current story branch: `codex/TTB-210-batch-single-source`, cut from `origin/main` to publish the batch-alignment slice without dragging unrelated local branch history into the merge
- Current objective: publish the remaining traced LangSmith evidence for `TTB-210` after the auth path is repaired
- Current tooling cleanup: `STITCH_FLOW_MODE=direct` is now the canonical default, with `claude-direct` accepted only as a legacy alias
- Current workflow baseline: new linked worktree creation bootstraps repo-local `.env` automatically, including Gemini when present; story PRs auto-open as ready; PR CI is lightweight; and routine env sync plus check-wait chatter stays out of progress updates unless it still blocks live work
- `TTB-EVAL-002` adds an opt-in inline Gemini Batch benchmark path for the approved live extraction corpus while keeping `npm run eval:golden` as the canonical fixture-backed gate.
- `TTB-304` is being published from `/Users/youss/Development/gauntlet/ttb-label-verification-304-publish` after isolating it from unrelated `TTB-210` changes in the main checkout.
- Next queue blocker after the workflow cleanup and eval merge remains `TTB-210`, where traced LangSmith evidence is still blocked by `401 /datasets` in the tracked eval flow and `403` on direct trace upload
- Current `TTB-210` slice hardens beverage auto-detect so decorative art, sparse non-label reads, and no-text extractions stay `unknown` unless the extraction still carries trustworthy alcohol-label evidence.
- Current `TTB-210` batch-alignment slice removes the old batch-only prompt overlay and deferred aggregated resolver path so batch run/retry item processing now uses the same canonical review prompt and inline report pipeline as single review.
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
