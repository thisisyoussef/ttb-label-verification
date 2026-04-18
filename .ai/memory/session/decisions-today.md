# Decisions Today

- Keep the default agent contract lean: SSOT, branch tracker, memory bank, TDD, and clean code are the core workflow.
- Default new work to a fresh story branch in the current checkout; use sibling linked worktrees only for parallel tasks or dirty-checkout isolation.
- Keep `docs/specs/<story-id>/` as the universal story packet, but make spec expansion proportional to the size and risk of the change.
- Use `docs/process/SINGLE_SOURCE_OF_TRUTH.md` as the checked-in active story tracker and next-step resolver.
- Make `STITCH_FLOW_MODE=direct` the workspace default for UI work, and keep `claude-direct` only as a backward-compatible alias.
- Keep automated Stitch behind self-review and explicit user review instead of auto-implementing from unreviewed generated refs.
- `TTB-WF-003` is complete; linked worktree creation now bootstraps repo-local env automatically, routine env recovery stays out of user-facing progress chatter unless it still blocks live work, and branch tracker closeout commits can pass local gates after the row moves into closed history.
- Open story PRs as ready by default, keep PR CI lightweight, and remove hidden auto-merge or auto-update workflows so agents push, merge, and only mention GitHub checks when they truly block the path.
- Keep `TTB-210` as the next blocking story after `TTB-WF-003`; the remaining blocker there is LangSmith auth, not local implementation quality.
- Keep user-facing progress updates brief and action-oriented; do not surface minor tracker mismatches as speculative analysis.
- Treat visible or API-backed feature completion as incomplete until the real API path and the real browser flow have both been verified, with Comet as the browser path.
- Treat mergeable story work as incomplete until it has been pushed and merged, not just committed locally.
- Keep `TTB-EVAL-002` inline-only: use Gemini Batch only for approved checked-in live eval assets, fail closed before any request size that would require the Files API, and keep the path out of shipped review routes.
- Keep `npm run eval:golden` as the canonical fixture-backed gate; the Gemini Batch runner is opt-in cost tooling for non-urgent live corpus sweeps.
