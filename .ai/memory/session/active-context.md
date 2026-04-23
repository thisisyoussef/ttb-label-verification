# Active Context

- Current focus: `TTB-000` live COLA Cloud exclusion follow-up on `codex/TTB-000-cola-cloud-live-exclude`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification-cola-cloud-live-exclude`
- Current objective: prevent unreadable live COLA record `26107001000011` from resurfacing through Toolbench `Fetch live` or a future stored-corpus refresh, then verify this fix on top of merged `TTB-209` before publish/deploy
- Current implementation shape: a shared `isBlockedColaCloudTtbId(...)` helper gates both `src/server/routes/eval-cola-cloud-routes.ts` and the COLA corpus refresh scripts, while the live-route tests reset the in-memory summary cache between cases; this branch is being rebased onto the merged `TTB-209` first-result-budget work
- Current verification state: focused Vitest coverage, `npm run test`, `npm run typecheck`, `npm run build`, and `npm run gate:commit` were green before rebase; `npm run eval:golden` plus the full combined rerun are next on top of merged `origin/main`
- Current durable caution: the checked-in stored corpus never contained this TTB id; the exclusion only affects live rotation and future refreshes unless the corpus is explicitly regenerated later
- GitHub repo and Railway project remain live; `TTB-209` is merged and this follow-up is being rebased for combined verification before publish
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
