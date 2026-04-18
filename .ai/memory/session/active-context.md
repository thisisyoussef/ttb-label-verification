# Active Context

- Current focus: `TTB-WF-003` lean agent workspace and direct-branch story workflow in `/Users/youss/Development/gauntlet/ttb-label-verification-wf-003-lean`
- Current story branch: `chore/TTB-WF-003-worktree-env-bootstrap`
- Current objective: add automatic repo-local env bootstrap for new linked worktrees, keep routine env sync out of normal progress chatter, and finish the workflow cleanup cleanly
- Current tooling cleanup: `STITCH_FLOW_MODE=direct` is now the canonical default, with `claude-direct` accepted only as a legacy alias
- Current workflow baseline: new linked worktree creation bootstraps repo-local `.env` automatically, including Gemini when present, and routine env sync stays out of progress chatter unless it still blocks live work
- Next queue blocker after this workflow cleanup: `TTB-210`, where traced LangSmith evidence is still blocked by `401 /datasets` in the tracked eval flow and `403` on direct trace upload
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
