# Anti-Patterns

## Avoid these failures

- Treating `.ai/` as runtime code instead of harness scaffolding
- Asking the model for a holistic compliance pass/fail verdict
- Converting low-confidence visual judgments into hard `pass`
- Recreating validator logic in client components
- Letting Codex redesign or patch `src/client/**` to make backend work easier
- Letting Claude change shared contracts, validators, or backend code instead of handing requirements to Codex
- Letting either agent keep going after it knows the work belongs in the other lane
- Letting either agent skip the checked-in tracker and choose the next story from memory
- Starting Codex engineering for a UI-first story before a `ready-for-codex` backlog handoff exists
- Claiming staging or production deployment happened when the GitHub or Railway bootstrap has not actually been configured yet
- Changing extraction or validator behavior without updating eval artifacts
- Shipping compliance logic without an updated rule-source trail
- Treating no-persistence as a policy statement without negative verification
- Claiming under-5-second performance without measured timings
- Creating a parallel per-story `design.md` instead of writing the feature design into `ui-component-spec.md`
- Leaving durable workflow corrections only in chat instead of promoting them into checked-in docs
- Starting standard feature work without a spec packet or behavior changes without a RED test
- Leaving a leaf story as `story-packet.md` only after active implementation has already started and deeper working docs are clearly needed
- Treating production promotion as automatic per story instead of an explicit release action
