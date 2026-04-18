# TDD Pipeline

1. Start from acceptance criteria and the active packet.
2. Pick the smallest viable test layer.
3. Write a failing test first for non-trivial behavior or tooling changes.
4. Make the smallest change that turns RED to GREEN.
5. Refactor after GREEN.
6. Re-run focused tests while iterating.
7. Before handoff, run:
   - `npm run test`
   - `npm run typecheck`
   - `npm run build`
8. Update SSOT and memory if durable truth changed.
