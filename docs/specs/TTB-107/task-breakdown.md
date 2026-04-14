# Task Breakdown

1. Expand the `TTB-107` packet with Codex-side execution docs, user-flow branches, observability notes, and the no-persistence checklist.
2. Add RED regression tests for:
   - auth phase advancement
   - approved auth-screen state output
   - signed-in identity shell output
   - sign-out reset orchestration
   - auth no-persistence invariants
3. Refactor the auth behavior into the smallest set of testable helpers needed to satisfy the RED tests.
4. Re-run the story-targeted tests, then the full repo checks: `npm run test`, `npm run typecheck`, `npm run build`.
5. Update the SSOT, backlog handoff status, and memory docs to match the real `TTB-107` completion state.
