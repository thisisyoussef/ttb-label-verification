# Claude UI Checklist

Use this checklist whenever Claude is the active lane owner for a story.

## Start gate

- [ ] If the user said `continue` or `continue with the next story`, resolve the current story through `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md`.
- [ ] Confirm `docs/process/SINGLE_SOURCE_OF_TRUTH.md` shows the story as Claude-owned or Claude-first.
- [ ] Confirm the work is UI design and interaction work, not backend or shared-contract engineering.
- [ ] Confirm the universal story packet exists under `docs/specs/<story-id>/`, or create the packet folder and the needed UI-facing docs.
- [ ] If the story only has `story-packet.md`, expand it into the working UI docs before implementation begins.
- [ ] If the next required work is engineering-only, stop and redirect the user to Codex instead of continuing in Claude.

## Read set

- [ ] `AGENTS.md`
- [ ] `CLAUDE.md`
- [ ] `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- [ ] `docs/process/DEPLOYMENT_FLOW.md`
- [ ] `docs/specs/FULL_PRODUCT_SPEC.md`
- [ ] `docs/specs/PROJECT_STORY_INDEX.md`
- [ ] `docs/presearch/2026-04-13-foundation.md`
- [ ] `docs/reference/product-docs/README.md`
- [ ] `docs/design/MASTER_DESIGN.md`
- [ ] `evals/labels/README.md`
- [ ] `evals/labels/manifest.template.json`
- [ ] `docs/specs/<story-id>/ui-component-spec.md` when it already exists
- [ ] `docs/specs/<story-id>/stitch-screen-brief.md` when it already exists
- [ ] `src/shared/contracts/review.ts`

## Design and Stitch prep

- [ ] Treat the story packet as the shared contract for both agents. Update the UI-facing parts without forking a second spec tree.
- [ ] Treat `story-packet.md` as a valid compact planning artifact, but do not stay there once active UI implementation starts.
- [ ] Update `docs/specs/<story-id>/ui-component-spec.md` with problem, users, flows, IA/layout, states, copy, constraints, backend data needs, frozen constraints, and open questions.
- [ ] Create or update `docs/specs/<story-id>/stitch-screen-brief.md` with the screen description the user will run through Google Stitch.
- [ ] Stop for a Stitch prep handoff before implementation and ask the user to return a Stitch image reference plus Stitch HTML/code reference.
- [ ] Record the returned Stitch references in `docs/specs/<story-id>/stitch-screen-brief.md`.
- [ ] If Stitch references are still missing, stay blocked and tell the user exactly what to return.

## Implementation from Stitch

- [ ] Implement the full screens in `src/client/**` against the returned Stitch image and HTML references, using mock data or no data where possible.
- [ ] Do not re-design the visual hierarchy after Stitch references exist unless the user explicitly asks for a new Stitch pass.
- [ ] Keep all temporary fixtures client-side. Do not invent backend behavior inside components.
- [ ] Cover the relevant empty, loading, processing, result, error, and low-confidence states for the story.
- [ ] Keep the UI aligned to `docs/design/MASTER_DESIGN.md` and the seeded label scenarios.
- [ ] Do not edit `src/server/**`, `src/shared/**`, validators, tests, or infrastructure.
- [ ] Record required backend fields, evidence payloads, and API behavior in the UI spec instead of changing contracts directly.

## Visual review gate

- [ ] Run the app and verify the designed screens are runnable.
- [ ] Use `.ai/workflows/story-handoff.md` to package the visual-review checkpoint.
- [ ] Stop for explicit user visual review before any Codex engineering handoff.
- [ ] Incorporate requested UI changes and get explicit approval on the direction.

## Codex handoff

- [ ] Create or update `docs/backlog/codex-handoffs/<story-id>.md`.
- [ ] Set the handoff status to `ready-for-codex` only after explicit user approval.
- [ ] List the Stitch image reference, the Stitch HTML/code reference, touched `src/client/**` files, approved routes/views, frozen layout/copy/interaction constraints, relevant eval scenarios, backend data needs, supported states, privacy/latency constraints, and open engineering questions.
- [ ] Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md` with the new status and next owner.
- [ ] Stop. Codex owns the next step only if the story also has engineering scope.
- [ ] When stopping, tell the user explicitly to switch to Codex and point to `docs/specs/<story-id>/` plus `docs/backlog/codex-handoffs/<story-id>.md`.
