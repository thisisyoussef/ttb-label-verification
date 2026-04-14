# Claude UI Checklist

Use this checklist whenever Claude is the active lane owner for a story.

## Start gate

- [ ] If the user said `continue` or `continue with the next story`, resolve the current story through `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md`.
- [ ] Confirm `docs/process/SINGLE_SOURCE_OF_TRUTH.md` shows the story as Claude-owned or Claude-first.
- [ ] Confirm the work is UI design and interaction work, not backend or shared-contract engineering.
- [ ] Before packet or code edits, confirm the current branch already belongs to this story. If the worktree is on `main`, `production`, or another story branch, switch immediately to a fresh `claude/<story-id>-<summary>` branch.
- [ ] Confirm the universal story packet exists under `docs/specs/<story-id>/`, or create the packet folder and the needed UI-facing docs.
- [ ] If the story only has `story-packet.md`, expand it into the working UI docs before implementation begins.
- [ ] **Reconcile the packet with the live tracker.** When expanding a compact packet, rewrite it so its metadata, constitution check, task breakdown, and working-artifacts list agree with `docs/process/SINGLE_SOURCE_OF_TRUTH.md`. Constitution-check rules must be written lane-scoped (Claude-lane vs. Codex-lane), not story-scoped, whenever both lanes are in scope. If the packet, the SSOT, and any existing Codex handoff disagree, the SSOT and handoff win — update the packet, and tell the user in chat what was reconciled.
- [ ] If the user explicitly asks Claude to do engineering-only work, stop and redirect the user to Codex instead of continuing in Claude.

## Read set

- [ ] `AGENTS.md`
- [ ] `CLAUDE.md`
- [ ] `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- [ ] `docs/process/STITCH_AUTOMATION.md`
- [ ] `docs/process/DEPLOYMENT_FLOW.md`
- [ ] `docs/process/GIT_HYGIENE.md`
- [ ] `docs/specs/FULL_PRODUCT_SPEC.md`
- [ ] `docs/specs/PROJECT_STORY_INDEX.md`
- [ ] `docs/presearch/2026-04-13-foundation.md`
- [ ] `docs/reference/product-docs/README.md`
- [ ] `docs/design/MASTER_DESIGN.md`
- [ ] `evals/golden/README.md`
- [ ] `evals/golden/manifest.json`
- [ ] `evals/labels/README.md`
- [ ] `evals/labels/manifest.json`
- [ ] `docs/specs/<story-id>/ui-component-spec.md` when it already exists
- [ ] `docs/specs/<story-id>/stitch-screen-brief.md` when it already exists
- [ ] `src/shared/contracts/review.ts`

## Design and Stitch prep

- [ ] Treat the story packet as the shared contract for both agents. Update the UI-facing parts without forking a second spec tree.
- [ ] Treat `story-packet.md` as a valid compact planning artifact, but do not stay there once active UI implementation starts.
- [ ] Update `docs/specs/<story-id>/ui-component-spec.md` with problem, users, flows, IA/layout, states, copy, constraints, backend data needs, hard constraints, flexible implementation space, and open questions.
- [ ] Create or update `docs/specs/<story-id>/stitch-screen-brief.md` only when the current pass uses Stitch.
- [ ] Default path: keep `STITCH_FLOW_MODE=claude-direct`, implement directly from the checked-in design context, and stop for user visual review.
- [ ] Automated path: only run `npm run stitch:story -- <story-id>` when the pass is explicitly set to `STITCH_FLOW_MODE=automated`, then record the generated Stitch refs in the packet.
- [ ] Manual path: only stop for a manual Comet Stitch handoff if the pass is explicitly set to `STITCH_FLOW_MODE=manual`.
- [ ] Record the returned Stitch references in `docs/specs/<story-id>/stitch-screen-brief.md` when the pass uses Stitch.
- [ ] Review the generated Stitch output yourself against `ui-component-spec.md`, `stitch-screen-brief.md`, and `docs/design/MASTER_DESIGN.md` before asking the user to review it.
- [ ] If the generated result is clearly off, revise the brief and rerun automated Stitch before handing anything to the user.
- [ ] Stop for user review of the generated Stitch output only after the self-review gate is complete.
- [ ] If Stitch references are still missing for an automated/manual pass, stay blocked and tell the user exactly what to return.

## Implementation

- [ ] Implement the full screens in `src/client/**` directly in `claude-direct` mode, or against the returned Stitch image and HTML references when the selected pass uses Stitch.
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
- [ ] **Reconcile the packet again.** Update `story-packet.md` so its Claude-lane status reflects `done` (UI approved) and its Codex-lane status reflects `ready-for-codex`, and so its task breakdown and working-artifacts list point at the final UI spec, Stitch refs, and handoff doc. If the packet's constitution check still reads as "UI only" when the story actually has a Codex lane, rewrite it lane-scoped before handoff.
- [ ] Set the handoff status to `ready-for-codex` only after explicit user approval.
- [ ] List the Stitch image reference, the Stitch HTML/code reference, touched `src/client/**` files, approved routes/views, hard constraints/non-negotiables, flexible areas Codex may change, relevant eval scenarios, backend data needs, supported states, privacy/latency constraints, and open engineering questions.
- [ ] Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md` with the new status and next owner.
- [ ] Stop the current story.
- [ ] If the user explicitly asks for engineering on that same story, tell them to switch to Codex and point to `docs/specs/<story-id>/` plus `docs/backlog/codex-handoffs/<story-id>.md`.
- [ ] If the user says `continue`, resolve the next Claude-owned UI story from the tracker instead of treating the Codex queue as a blocker.

## Git gate

- [ ] Keep the branch scoped to this story or tightly-coupled workflow change.
- [ ] Before commit, sync the packet, tracker, and handoff state with the actual UI status.
- [ ] Before commit, run `npm run gate:commit`.
- [ ] Use an intentional commit message that includes the story id.
- [ ] Push to a story branch, never directly to `main` or `production`.
- [ ] Before a reviewable push, run `npm run gate:push`.
- [ ] Before marking a handoff `ready-for-codex` or telling the user the branch is on GitHub, run `npm run gate:publish`.
- [ ] If the branch is only draft UI work, do not label the handoff `ready-for-codex` and do not imply engineering readiness in the push.
