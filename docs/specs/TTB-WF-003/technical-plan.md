# Technical Plan

## Scope

Add a checked-in branch tracker plus a local helper command that keeps branch lifecycle metadata consistent with the repo’s existing story-branch rules.

## Modules and files

- Add `docs/process/BRANCH_TRACKER.md`
- Add `docs/specs/TTB-WF-003/**`
- Add `scripts/branch-tracker.ts`
- Add `scripts/branch-tracker.test.ts`
- Add `scripts/story-branch.ts`
- Update `scripts/git-story-gate.ts`
- Update `package.json`
- Update `AGENTS.md`
- Update `.ai/codex.md`
- Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- Update `docs/process/GIT_HYGIENE.md`
- Update `docs/process/CODEX_CHECKLIST.md`
- Update `.ai/workflows/story-lookup.md`
- Update `.ai/docs/WORKSPACE_INDEX.md`
- Update `docs/specs/PROJECT_STORY_INDEX.md`
- Update `docs/specs/README.md`
- Update `.ai/memory/project/patterns.md`
- Update `.ai/memory/session/decisions-today.md`

## Design

### Tracker format

- Keep the tracker as readable Markdown under `docs/process/BRANCH_TRACKER.md`
- Use one active table and one closed-history table
- Store branch description, story id, lane, status, PR cell, opened date, updated date, base branch, and notes
- Keep stable HTML comment markers around each managed table so the helper can update the file without reflowing the rest of the document

### Helper command

- `npm run story:branch -- open ...`
  - validate lane, story id, summary, and description
  - refuse to run from a dirty worktree
  - create and switch to the new branch
  - add or update the active branch row
- `npm run story:branch -- update ...`
  - update status, description, PR cell, or notes for the current branch or an explicit branch
- `npm run story:branch -- close ...`
  - remove the active branch row
  - append a closed-history row with final status and notes

### Gate integration

- `scripts/git-story-gate.ts` should verify that the current story branch has a matching active tracker row
- the row must have a non-placeholder description
- the gate should keep existing branch-name validation intact

## Risks and fallback

- Risk: a shared tracker table can drift if branches bypass the helper.
- Mitigation: fail commit and push gates when the branch row is missing or still placeholder-only.
- Risk: branch-table merge conflicts become annoying when many branches edit the same file.
- Mitigation: keep rows narrow, stable, and sorted by branch name; keep lifecycle history separate from active rows.
- Risk: users try to start a new branch from a dirty worktree.
- Mitigation: the helper refuses `open` on dirty state and points users to an isolated worktree flow.

## Testing strategy

- Add focused unit tests around tracker upsert and close behavior in `scripts/branch-tracker.test.ts`
- Run `npm run test`
- Run `npm run typecheck`
- Run `npm run build`
