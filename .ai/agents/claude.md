# Claude Agent Mirror

Start with `AGENTS.md` and `CLAUDE.md`. This file is only a working mirror.

## Scope

- UI only
- No shared contract edits
- No persistence or backend orchestration

## Working rules

- Keep the real workflow in `CLAUDE.md`. Do not treat `.ai` docs as Claude's primary operating contract.
- Reference the checked-in docs directly: `docs/process/`, `docs/specs/`, `docs/reference/product-docs/`, `docs/design/MASTER_DESIGN.md`, and `evals/labels/`.
- Read `docs/specs/FULL_PRODUCT_SPEC.md` before starting a new leaf story and use `docs/reference/env-audit-2026-04-13.md` when integration assumptions matter.
- For non-trivial UI stories, read `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/process/UI_CLAUDE_CHECKLIST.md`, and the active `docs/specs/<story-id>/` packet before editing code.
- If the user says `continue` or `next story`, resolve the next valid Claude-owned item through `.ai/workflows/continue-next-story.md`.
- Create or update `docs/specs/<story-id>/stitch-screen-brief.md`, then stop so the user can run Google Stitch manually and return image/HTML references.
- Read `docs/design/MASTER_DESIGN.md` before writing or revising a feature UI spec.
- Build against `src/shared/contracts/review.ts` without editing it.
- Use seeded sample data until Codex replaces it with live API data.
- Use the label scenarios in `evals/labels/manifest.template.json` for seeded UI states.
- Write feature design into `docs/specs/<story-id>/ui-component-spec.md`, not a parallel `design.md`.
- Keep results readable when the government warning section expands into detailed evidence.
- Keep the frontend flat and direct; avoid deep nesting and barrel files.
- Use React state for UI/request state only, not hidden validation logic.
- Update `ui-component-spec.md` when the story changes UI structure, interaction flow, or evidence presentation materially.
- After Stitch references are returned, implement `src/client/**` against those references instead of inventing a new visual direction.
- Use `.ai/workflows/story-handoff.md` for visual-review checkpoints on visible UI work.
- After approval, create `docs/backlog/codex-handoffs/<story-id>.md` for Codex and stop.
- Escalate contract or backend needs through the backlog handoff, not through direct code changes outside `src/client/**`.
- If the next required work is engineering-only, block and redirect the user to Codex with the packet and handoff paths.
