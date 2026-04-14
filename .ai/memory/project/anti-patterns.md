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
- Letting a later `ready-for-codex` UI handoff bypass an earlier unfinished workflow, eval, or other foundation story
- Preferring later blocking `TTB-2xx+` engineering work when a ready approved `TTB-1xx` handoff is still waiting after foundations clear
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
- Adding multipart upload middleware globally instead of constraining it to the route that actually handles uploads
- Letting `src/client/**` keep a parallel report model after `src/shared/contracts/review.ts` has already been expanded for the same UI state
- Re-parsing optional multipart `fields` ad hoc inside route handlers instead of using the shared intake normalizer
- Treating standalone review requests as invalid just because the multipart `fields` part is omitted
- Leaving dev-only fixture controls visible in normal runtime mode so seeded behavior silently overrides the live path
- Treating a seed or staging adapter as “wired” because the schema parses, while non-default submitted values are still dropped before they reach the visible result
- Leaving the main `POST /api/review` route on a seed fixture after extraction and validator slices already exist, instead of composing those live modules into the real report path
- Rebuilding batch matching or dashboard shaping separately in the client after the server has already produced a typed canonical payload
- Turning batch execution into hidden durable state or a background queue when the checked-in product contract still requires ephemeral in-memory sessions only
- Reusing shared optional-field Zod schemas directly for Responses structured outputs instead of adapting them into required-plus-nullable API schemas
- Letting the warning diff collapse into overly broad case-mismatch spans that stop matching the approved UI evidence semantics
