# Task Breakdown

1. Create the `TTB-WF-003` packet and add the canonical branch tracker doc.
   - Validation: `docs/specs/TTB-WF-003/` exists and `docs/process/BRANCH_TRACKER.md` exists.

2. Add tracker helpers plus focused tests.
   - Validation: `scripts/branch-tracker.ts`, `scripts/branch-tracker.test.ts`, and `scripts/story-branch.ts` exist and tests cover active-row upsert plus closeout behavior.

3. Wire the helper into package scripts and gate enforcement.
   - Validation: `package.json` exposes `story:branch`, and `scripts/git-story-gate.ts` fails when a story branch lacks a tracker row or description.

4. Update the checked-in workflow docs and indexes.
   - Validation: the process docs, workspace index, and story index all explain the split between story tracking and branch tracking.

5. Run the verification set.
   - Validation: `npm run test`, `npm run typecheck`, and `npm run build` pass.
