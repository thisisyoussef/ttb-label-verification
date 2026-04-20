# Active Context

- Current focus: `TTB-WF-004` automatic production promotion after verified staging deploy on `chore/TTB-WF-004-auto-prod-promotion`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification-wf-004-auto-prod-promotion`
- Current objective: remove the fragile production release handoff that depended on a workflow-updated `production` branch and a later workflow run, and replace it with one trustworthy staging-to-production automation path
- Current implementation shape: `.github/workflows/railway-post-deploy.yml` now stages first and auto-promotes the same verified `main` SHA to Railway production before syncing `production`; `.github/workflows/promote-production.yml` now deploys a selected validated ref directly to Railway production and only then syncs `production`
- Recent baseline landed: `TTB-WF-002` now keeps `src/server/` and `scripts/` grouped into shallow reviewer-friendly concern folders, updates package entrypoints and docs to match, and removes the visible `latencyBudgetMs` report field in favor of measured latency references.
- Current verification state: YAML parses cleanly, `npm run test`, `npm run typecheck`, and `npm run build` are green in this worktree after reusing the root checkout's `node_modules` because disk space was too low for a fresh install
- Current durable caution: the repo has only about 116 MiB free on `/System/Volumes/Data`, so new worktrees may need shared `node_modules` reuse until disk pressure is relieved
- GitHub repo and Railway project remain live; this story is local-only so far
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
