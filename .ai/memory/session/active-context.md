# Active Context

- Current focus: `TTB-210` persona-centered prompt profiles and endpoint plus mode guardrails
- Current story branch: next work should start from a fresh branch off `origin/main`; `TTB-WF-003` closed cleanly on `chore/TTB-WF-003-tracker-closeout`
- Current objective: publish the remaining traced LangSmith evidence for `TTB-210` after the auth path is repaired
- Current tooling cleanup: `STITCH_FLOW_MODE=direct` is now the canonical default, with `claude-direct` accepted only as a legacy alias
- Current workflow baseline: new linked worktree creation bootstraps repo-local `.env` automatically, including Gemini when present, and routine env sync stays out of progress chatter unless it still blocks live work
- Next queue blocker after this workflow cleanup: `TTB-210`, where traced LangSmith evidence is still blocked by `401 /datasets` in the tracked eval flow and `403` on direct trace upload
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
