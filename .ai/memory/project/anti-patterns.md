# Anti-Patterns

## Avoid these failures

- Reintroducing a standing Claude-vs-Codex lane split or treating `ready-for-codex` as a default blocker for new work
- Letting workflow rules sprawl across many docs until the agent spends more time reading process than touching code
- Turning simple implementation work into mandatory spec-writing before any code moves
- Creating linked worktrees inside the repo root or tracking `.claude/worktrees/**` in git
- Letting an isolated worktree depend on `.env` values that only exist in a different checkout, or surfacing missing-provider chatter before repo-local env bootstrap has run
- Starting new story work on `main`, `production`, or an unrelated story branch
- Choosing the next story from chat memory instead of SSOT
- Treating Stitch as mandatory, or continuing to teach `claude-direct` as the current mode name instead of `direct`
- Narrating minor tracker inconsistencies or speculative continuity clues to the user instead of just fixing the checked-in docs
- Disabling the source-size guard entirely just because `main` already drifted past the cap
- Treating `.ai/` as runtime code instead of harness scaffolding
- Asking the model for a holistic compliance pass or fail verdict
- Converting low-confidence visual judgments into hard `pass`
- Recreating validator logic in client components
- Claiming staging or production deployment happened when the GitHub or Railway step has not actually completed
- Changing extraction or validator behavior without updating eval artifacts
- Shipping compliance logic without an updated rule-source trail
- Treating no-persistence as a policy statement without negative verification
