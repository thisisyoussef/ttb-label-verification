# Decisions Today

- Keep the default agent contract lean: SSOT, branch tracker, memory bank, TDD, and clean code are the core workflow.
- Treat Claude and Codex as full agents in this repo; do not maintain a standing UI-only vs engineering-only split.
- Default new work to a fresh story branch in the current checkout; use sibling linked worktrees only for parallel tasks or dirty-checkout isolation.
- Keep `docs/specs/<story-id>/` as the universal story packet, but make spec expansion proportional to the size and risk of the change.
- Use `docs/process/SINGLE_SOURCE_OF_TRUTH.md` as the checked-in active story tracker and next-step resolver.
- Use `docs/process/CODEX_CHECKLIST.md` as the generic implementation checklist even though the filename is historical.
- Make `STITCH_FLOW_MODE=direct` the workspace default for UI work, and keep `claude-direct` only as a backward-compatible alias.
- Keep automated Stitch behind self-review and explicit user review instead of auto-implementing from unreviewed generated refs.
- `TTB-WF-003` is complete; linked worktree creation now bootstraps repo-local env automatically, routine env recovery stays out of user-facing progress chatter unless it still blocks live work, and branch tracker closeout commits can pass local gates after the row moves into closed history.
- Keep `TTB-210` as the next blocking story after `TTB-WF-003`; the remaining blocker there is LangSmith auth, not local implementation quality.
- Keep user-facing progress updates brief and action-oriented; do not surface minor tracker mismatches as speculative analysis.
- Treat visible or API-backed feature completion as incomplete until the real API path and the real browser flow have both been verified, with Comet as the browser path.
- Treat mergeable story work as incomplete until it has been pushed and merged, not just committed locally.
