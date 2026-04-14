# Claude Agent Mirror

Start with `AGENTS.md` and `CLAUDE.md`. This file is only a working mirror.

## Scope

- UI only
- No shared contract edits
- No persistence or backend orchestration

## Working rules

- Keep the real workflow in `CLAUDE.md`. Do not treat `.ai` docs as Claude's primary operating contract.
- Reference the checked-in docs directly: `docs/process/`, `docs/specs/`, `docs/reference/product-docs/`, `docs/design/MASTER_DESIGN.md`, `evals/golden/`, and `evals/labels/`.
- Read `docs/specs/FULL_PRODUCT_SPEC.md` before starting a new leaf story and use `docs/reference/env-audit-2026-04-13.md` when integration assumptions matter.
- Read `docs/process/STITCH_AUTOMATION.md` when the story uses Stitch or the local Stitch workflow is being configured.
- Read `docs/process/GIT_HYGIENE.md` before committing, pushing, or preparing a reviewable UI branch. Use `npm run gate:commit` before reviewable commits, `npm run gate:push` before reviewable pushes, and `npm run gate:publish` before any handoff that claims the branch is on GitHub or marks a UI story ready for Codex.
- Once a reviewable UI branch is approved, published, validated, and mergeable, merge it into `main` instead of leaving it hanging, unless the user explicitly asks to hold it or a concrete blocker exists. `archive/*`, `rewrite/*`, and `production` are exceptions.
- For non-trivial UI stories, read `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/process/UI_CLAUDE_CHECKLIST.md`, and the active `docs/specs/<story-id>/` packet before editing code.
- If the user says `continue` or `next story`, resolve the next valid Claude-owned item through `.ai/workflows/continue-next-story.md`.
- Create or update `docs/specs/<story-id>/stitch-screen-brief.md`, then default to the local automated Stitch flow. Review the generated result yourself before asking the user to review it. Only fall back to a user-run Stitch pass in Comet if the user explicitly switches this pass to `STITCH_FLOW_MODE=manual` or local Stitch auth is unavailable.
- Read `docs/design/MASTER_DESIGN.md` before writing or revising a feature UI spec.
- Build against `src/shared/contracts/review.ts` without editing it.
- Use seeded sample data until Codex replaces it with live API data.
- Use the golden scenarios in `evals/golden/manifest.json` for seeded UI states, with `evals/labels/manifest.json` as the default core-six live subset.
- Write feature design into `docs/specs/<story-id>/ui-component-spec.md`, not a parallel `design.md`.
- Keep results readable when the government warning section expands into detailed evidence.
- Keep the frontend flat and direct; avoid deep nesting and barrel files.
- Follow the UI hygiene rules in `CLAUDE.md`: 300-line soft cap, 500-line hard cap, single-purpose components and hooks, and extraction before duplication or branching becomes muddy.
- Use React state for UI/request state only, not hidden validation logic.
- Update `ui-component-spec.md` when the story changes UI structure, interaction flow, or evidence presentation materially.
- After Stitch references are returned, implement `src/client/**` against those references instead of inventing a new visual direction.
- Use `.ai/workflows/story-handoff.md` for visual-review checkpoints on visible UI work.
- After approval, create `docs/backlog/codex-handoffs/<story-id>.md` for Codex and stop.
- Escalate contract or backend needs through the backlog handoff, not through direct code changes outside `src/client/**`.
- If the user explicitly asks Claude to perform engineering-only work, block and redirect to Codex with the packet and handoff paths.
- After a UI handoff is written, Claude should resolve the next Claude-owned story from `docs/process/SINGLE_SOURCE_OF_TRUTH.md` instead of treating pending Codex work as a blocker.
