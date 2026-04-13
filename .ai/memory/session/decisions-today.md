# Decisions Today

- Adopt the default gauntlet workflow baseline in this repo.
- Use `docs/process/SINGLE_SOURCE_OF_TRUTH.md` as the checked-in active story and lane tracker.
- Split execution into a Claude UI checklist and a Codex engineering checklist against the same tracker.
- Treat `docs/specs/<story-id>/` as the universal packet for both lanes rather than separate frontend and backend specs.
- For any story with material UI scope, Codex waits until Claude finishes the UI phase and the handoff is approved.
- Both agents must block and redirect the user when work is in the wrong lane or a prerequisite from the other lane is missing.
- Require spec packets for standard feature work and TDD for all behavior changes.
- Capture durable lessons in project memory and promote recurring corrections into `AGENTS.md` or workflow docs.
- Add a dedicated `continue-next-story` workflow so either agent can recover the next valid story from checked-in state.
- Adopt `docs/specs/FULL_PRODUCT_SPEC.md` plus executable `TTB-1xx` through `TTB-4xx` leaf stories as the full product build map.
- Allow compact leaf `story-packet.md` files during planning, with expansion into the full working packet before active implementation.
- Record the local env audit and treat `OPENAI_API_KEY` as the only required live product key for the MVP path.
- Use a branch-linked Railway deployment model: `main` deploys staging, `production` deploys production, and production promotion is explicit.
