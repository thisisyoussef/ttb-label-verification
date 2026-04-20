# Active Context

- Current focus: `TTB-210` refine warning guard follow-up on `codex/TTB-210-refine-warning-guard`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: prevent the post-results refine merge from replacing a correct reviewer-facing `government-warning` review row with a worse same-status second-pass reading while still allowing true warning upgrades to `pass`, and make the evaluator-facing docs more explicit at the top of the README
- Current implementation shape: `mergeRefinedReport` stays upward-only for all review rows, `government-warning` now accepts only review-to-pass upgrades during refine, the quick-load batch sample affordance is removed from Batch Upload so Toolbench remains the canonical reviewer harness, and the submission brief plus README entry points now call out architecture, tools, assumptions, trade-offs, and limitations more directly
- Current verification state: `npm run test`, `npm run typecheck`, `npm run build`, and `npm run gate:commit` are green; the branch commit is complete and the rebase onto `origin/main` is in progress for publish
- Current durable caution: this guard is intentionally scoped to `government-warning`; other refinable review rows still accept same-status swaps when the refined evidence changes
- GitHub repo and Railway project remain live; this follow-up is now publish-ready
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
