# Anti-Patterns

## Avoid these failures

- Reintroducing a standing Claude-vs-Codex lane split or treating `ready-for-codex` as a default blocker for new work
- Letting workflow rules sprawl across many docs until the agent spends more time reading process than touching code
- Turning simple implementation work into mandatory spec-writing before any code moves
- Creating linked worktrees inside the repo root or tracking `.claude/worktrees/**` in git
- Letting an isolated worktree depend on `.env` values that only exist in a different checkout, or surfacing missing-provider chatter before repo-local env bootstrap has run
- Starting new story work on `main`, `production`, or an unrelated story branch
- Treating draft PRs, ready-for-review transitions, or background check waits as something the user needs to hear about on normal story work
- Hiding normal story completion behind auto-merge or auto-update workflows instead of pushing, opening the PR, and merging directly
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
- Claiming the active single-label latency target without measured timings
- Adding Gemini through the Files API or any other provider-managed durable upload surface inside a no-persistence product
- Treating the Gemini Batch runner as a replacement for `npm run eval:golden`, or widening it from the approved checked-in live corpus to reviewer submissions or arbitrary local files
- Declaring the Gemini default production-ready without recorded live or sanitized trace evidence, timeout behavior, and a manual verification note for AI Studio logging and dataset-sharing settings
