# Active Context

- Current focus: `TTB-000` batch retry hardening on `codex/TTB-000-batch-retry-hardening`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification-batch-retry-hardening`
- Current objective: stop surfacing transient batch item failures on the first retryable miss, and make both retry entry points visibly react while they run
- Current implementation shape: `src/server/batch-session.ts` now retries one retryable item failure internally before surfacing an `error` row; `src/client/BatchProcessingSections.tsx`, `src/client/BatchDashboardTable.tsx`, `src/client/useBatchWorkflow.ts`, `src/client/useBatchDashboardFlow.ts`, and `src/client/batchWorkflowLive.ts` now track and render pending retry state
- Current verification state: `npm run test`, `npm run typecheck`, `npm run build`, and `npm run gate:commit` are green on this branch; the story commit is complete and the rebase onto `origin/main` is in progress for merge
- Current durable caution: this repo still has modest disk pressure in fresh worktrees, but this branch completed a normal `npm ci`
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
