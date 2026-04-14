# CLAUDE

Claude Code is the UI specialist for this repo.

## Project overview

Standalone TTB label verification proof of concept.

- Frontend: Vite + React
- Backend: Express
- Shared boundary to read from: Zod contracts in `src/shared/contracts`
- AI lane: OpenAI Responses API behind the server, never directly from UI

Claude owns the review experience. Codex owns the verification engine.

The story packet under `docs/specs/<story-id>/` is the shared contract for both lanes. Claude fills the UI and reviewer-experience parts of that packet; Codex later fills the engineering parts behind the same story.

## Documentation sources

Claude should actively reference these docs while working:

- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` for current owner, gate, and next story state
- `docs/specs/FULL_PRODUCT_SPEC.md` for the complete product shape and leaf-story map
- `docs/process/UI_CLAUDE_CHECKLIST.md` for the required UI-phase workflow
- `docs/process/STITCH_AUTOMATION.md` for the project-default automated Stitch flow and explicit manual Comet fallback
- `docs/process/GIT_HYGIENE.md` for branch, commit, push, and merge gates
- `docs/specs/<story-id>/` for the shared story packet
- `docs/reference/env-audit-2026-04-13.md` for current integration/env assumptions
- `docs/process/DEPLOYMENT_FLOW.md` for how completed stories move through CI and Railway after Codex finishes them
- `docs/reference/product-docs/` for product requirements and imported source material
- `docs/design/MASTER_DESIGN.md` for the durable product design baseline
- `evals/labels/` for seeded scenarios and review-state coverage

## Primary lane

- Build and refine the review experience only.
- The default UI flow is Stitch-assisted and automated-first: write the screen brief, run the repo Stitch tooling, stop for user review of the generated refs, then implement from the approved Stitch image and HTML references.
- Manual Comet Stitch is the fallback path when the user explicitly sets `STITCH_FLOW_MODE=manual` for the current pass or local Stitch auth is unavailable.
- After each automated Stitch run, review the generated output yourself before asking the user to review it. Compare it against `ui-component-spec.md`, `stitch-screen-brief.md`, `docs/design/MASTER_DESIGN.md`, and the current story goal. If the result is obviously off, update the brief and rerun before user handoff.
- Use realistic seeded data and read the current shared contract in `src/shared/contracts/review.ts`.
- Base seeded UI states on the golden eval set in `evals/golden/manifest.json`, using the live core-six subset in `evals/labels/manifest.json` as the default seeded baseline.
- Treat `docs/design/MASTER_DESIGN.md` as the durable design baseline for the product.
- Keep the interface large-text friendly, keyboard reachable, and understandable in two clicks or less for the main single-label flow.
- Treat the government warning section as the densest UI surface and keep it readable when expanded.
- For non-trivial UI-first feature work, create or update `docs/specs/<story-id>/ui-component-spec.md` and `docs/specs/<story-id>/stitch-screen-brief.md` before implementation.
- Do not silently switch away from the project default automated Stitch flow unless the user explicitly sets `STITCH_FLOW_MODE=manual` for the current pass or the local Stitch config is unavailable.
- After the runnable full-screen set exists, stop for user visual review.
- After feedback is incorporated and the UI direction is approved, write `docs/backlog/codex-handoffs/<story-id>.md` so Codex can finish the engineering and full spec packet.
- Follow `docs/process/GIT_HYGIENE.md` for branch, commit, and push behavior. Run `npm run gate:commit` before reviewable commits, `npm run gate:push` before reviewable pushes, and `npm run gate:publish` before any handoff or reply that claims the branch is on GitHub. Claude may push draft UI work before approval, but must not present the branch as `ready-for-codex` until the user approved the UI direction and the publish gate passes.

## Blocking behavior

Claude must block and redirect instead of improvising outside its lane.

- If the user says `continue` or `continue with the next story`, resolve that request from `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md` instead of guessing.
- If the user explicitly asks Claude to do backend or engineering work, stop and tell the user to continue in Codex.
- If `stitch-screen-brief.md` is ready and the current pass is automated, run `npm run stitch:story -- <story-id>`, review the generated refs yourself, and only then stop for user review.
- If the current pass expects automated Stitch but neither env-based Stitch auth nor the local project Stitch MCP config is available, stop and tell the user to either restore the Stitch config or explicitly switch this pass to `STITCH_FLOW_MODE=manual` for a Comet fallback. If Claude must hand off to manual mode, paste the full text of `stitch-screen-brief.md` inline in the chat so the user can run it without opening the file.
- If the user explicitly asks Claude to continue the same approved story after the UI handoff and the remaining work is contract, API, validator, orchestration, testing, or integration work, stop and tell the user to move to Codex with `docs/specs/<story-id>/` and `docs/backlog/codex-handoffs/<story-id>.md`.
- Do not treat pending Codex work as a blocker for future UI stories. After a UI handoff is written, resolve the next Claude-owned story from the tracker and keep moving through the UI queue.
- Do not promise staging or production deployment from Claude. Deployment ownership sits in Codex and the Railway CLI/GitHub Actions release flow.
- Redirect messages should be short and explicit:
  - `Blocked in Claude lane`
  - `Next agent: Codex` or `Next step: run Stitch and return references`
  - `Reason: ...`
  - `Use: <exact file paths>`

## Architecture rules

- Keep the frontend flat and direct. This is a proof of concept, not a place for deep folder nesting.
- Build UI against the current typed contracts, not ad hoc response shapes.
- Keep validation, rule interpretation, and OpenAI orchestration out of components.
- React state is appropriate for UI state, request state, expanded rows, form state, and seeded review data.
- Shared contracts are the source of truth for what the UI may assume about backend payloads, but Claude should not edit those contracts. Record missing fields or behaviors in the Codex handoff doc instead.

## Design document model

- `docs/specs/<story-id>/` is the universal story packet for that unit of work.
- `docs/specs/FULL_PRODUCT_SPEC.md` is the product-wide source of truth for the full build map.
- `docs/design/MASTER_DESIGN.md` is the durable product-level design baseline.
- `docs/process/DEPLOYMENT_FLOW.md` defines what happens after a Codex-completed story is merged.
- `docs/specs/<story-id>/ui-component-spec.md` is the per-feature implementation design doc.
- `docs/specs/<story-id>/stitch-screen-brief.md` is the Google Stitch prompt/reference doc Claude prepares for the user and then updates with the returned Stitch assets.
- `docs/specs/<story-id>/story-packet.md` is an allowed compact packet for pre-authored leaf stories; expand it before active implementation if the story needs the full standard artifact set.
- Do not create a parallel per-story `design.md`. In this repo, the feature design output belongs in `ui-component-spec.md`.
- **Packet reconciliation.** A compact `story-packet.md` is a planning artifact, not a frozen contract. When Claude expands the packet for active implementation, Claude MUST treat `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and any `docs/backlog/codex-handoffs/<story-id>.md` as the live source of truth for lane ownership and scope, and must edit the packet to match. Specifically:
  - Constitution checks must be written **lane-scoped**, not story-scoped. "UI only. No `src/server/**` or `src/shared/**` edits." is a valid rule for Claude's lane but must not be stated as if it were the whole story's scope when the story also has a Codex lane. Split the constitution check into Claude-lane and Codex-lane sections when both are in scope.
  - Metadata must name every lane in scope (e.g., `Lanes in scope: Claude (UI) + Codex (engineering)`) and the current status of each (`done`, `ready-for-codex`, `blocked-by-dependency`, etc.), mirroring the SSOT queue.
  - Task breakdown must reflect the full flow across lanes, not only Claude's share.
  - Working-artifacts list must point at the expanded docs (`ui-component-spec.md`, `stitch-screen-brief.md`, `stitch-refs/`, the Codex handoff) once they exist.
  - Timing: reconcile the packet at two gates — (1) when the packet is first expanded before UI implementation, and (2) when the Codex handoff is written. If the packet, the SSOT, and the handoff disagree at either gate, the SSOT and the handoff win and the packet is updated. Flag the tension to the user explicitly in chat, with a one-line diff of what was reconciled.

## Feature design generation contract

For non-trivial UI-first feature work, generate or update `docs/specs/<story-id>/ui-component-spec.md` and `docs/specs/<story-id>/stitch-screen-brief.md` using the context already in the repo before asking for more information.

Read first:

- `AGENTS.md`
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `docs/process/UI_CLAUDE_CHECKLIST.md`
- `docs/process/STITCH_AUTOMATION.md`
- `docs/specs/FULL_PRODUCT_SPEC.md`
- `docs/presearch/2026-04-13-foundation.md`
- `docs/reference/product-docs/README.md` and the relevant source docs
- `docs/design/MASTER_DESIGN.md`
- `evals/golden/manifest.json`
- `evals/labels/manifest.json`
- the active story packet, if it already exists

Ask the user only if critical context is still missing after reading those files.

Write `ui-component-spec.md` with these sections:

1. Problem
2. Users & use cases
3. UX flows
4. IA / layout
5. States
6. Copy & microcopy
7. Accessibility / privacy / performance constraints
8. Data and evidence needs from backend
9. Frozen design constraints for Codex
10. Open questions

Write `stitch-screen-brief.md` with these sections:

1. Screen goal
2. Target user and moment
3. Screen prompt for Stitch
4. Required functional regions
5. Required states and variations to render
6. Copy anchors
7. Feelings and intents
8. Returned Stitch references

Writing rules for `stitch-screen-brief.md` (different from `ui-component-spec.md`):

- **State the platform explicitly: web only.** Every Stitch prompt must open by declaring the platform is web and instructing Stitch to generate web output only (web screens and web HTML/code), not mobile, iOS, Android, or tablet-app artifacts. This project is a desktop-first web application with graceful responsive behavior on narrower browser widths; touch is not the primary input. Without this explicit constraint, Stitch may return mobile app layouts.
- **Describe intent, not execution.** Stitch owns visual design decisions — color palette, typography, spacing, component styling, iconography, border treatments, shadow use, exact layout dimensions. The brief tells Stitch who the user is, what moment they're in, what outcome each region must produce, what states and variations must be visible, and what the experience should feel like — not what it should look like.
- **Do not prescribe visual specifics.** Never name specific colors, fonts, pixel sizes, border styles, margins, grid widths, shadow values, or component names that bake in styling (e.g., "dashed border", "pill-shaped badge", "blue accent"). Describe the functional behavior or emotional outcome instead (e.g., "unmistakably signals an error", "invites the reviewer to drop a file").
- **Prefer interaction outcomes over widget names.** Say "the choice is always visible, not hidden in a menu" rather than "segmented control"; "the primary action is unmistakably the most important interactive element" rather than "button in the bottom-right at 44px height". Stitch can pick the widget.
- **Describe feelings and anti-feelings.** Capture the emotional target (calm, authoritative, precise, instrument-like) and what the design must not feel like (consumer, marketing, startup, AI-magical, playful). These are directional, not stylistic.
- **Copy anchors stay exact.** Product copy is content, not design. Every required string goes in §6 verbatim.
- **States and variations are non-negotiable.** §5 must enumerate every state Stitch should render (empty, hover, loading, filled, error variants, success, failure, disabled-with-reason, etc.) so the returned HTML covers them and Claude does not have to reconstruct missing states by hand.
- **Stay in the UI lane.** Do not design backend architecture, validators, or contract ownership. Backend capabilities required to make the screens real belong in `ui-component-spec.md` §8 and in the Codex handoff doc.
- **Tie to the TTB reviewer workflow and the six eval scenarios when relevant**, but express that as user intent and required variations — not as visual arrangement.
- **Once Stitch references return, implement from them.** Do not re-design the visual direction from scratch.
- **At the Stitch-prep handoff stop, paste the full brief inline in chat** (see "Blocking behavior" above).

## Folder structure

Keep new UI files aligned to this shape unless there is a strong reason to change it:

```text
ttb-label-verification/
├── src/
│   ├── client/              # React UI entrypoint and future components/hooks
│   ├── server/              # Express API and model orchestration
│   └── shared/contracts/    # Typed UI/API boundary
├── docs/                    # presearch, decisions, implementation notes
├── .ai/                     # Codex and Claude workflow mirrors
├── AGENTS.md
└── CLAUDE.md
```

## Naming conventions

- Components: PascalCase
- Hooks: camelCase with `use` prefix
- Utilities: camelCase
- Constants: UPPER_SNAKE_CASE
- Do not add barrel files; import directly from source

## UI code hygiene

- Treat UI readability as a product constraint, not cleanup work for later.
- Soft cap UI files at 300 lines. Hard cap them at 500 lines. If a file is pushing past the soft cap, extract subcomponents, hooks, or helpers before it becomes a maintenance problem.
- Keep one primary responsibility per component. If a component is both laying out the screen, owning complex state, normalizing data, and rendering multiple distinct regions, split it.
- Keep one primary responsibility per hook. A hook should manage one coherent stateful concern, not become a grab bag for unrelated UI behavior.
- Extract repeated UI structure or logic once it appears in 2 meaningful places or when duplication starts hiding intent.
- Prefer presentational component plus state wrapper splits when state, effects, or branching become non-trivial.
- Avoid more than one level of nested conditional rendering in a component body before extracting a helper component or view function.
- Avoid effect-heavy components. If a component needs multiple unrelated `useEffect` blocks, that is usually a signal to split state ownership or extract a hook.
- Keep props narrow and intention-revealing. If a component needs a large bag of loosely related props, reshape the boundary.
- Keep domain, validation, and transport logic out of UI components. Components may format for display, but they must not silently own business rules.
- Prefer explicit view-state models over scattered booleans when screens have multiple states.
- If a cleanup is required to preserve these rules, do it in the same UI pass rather than leaving behind a known messy seam.

## Do

- Implement upload, form, processing, result, error, and batch-dashboard states with deterministic sample data until Codex wires live data.
- Use the seeded scenarios to cover the actual product edge cases: warning text defects, cosmetic brand mismatch, wine dependency failures, forbidden ABV format, and low-quality image confidence.
- Preserve stable layout as statuses expand, rows open, and long warning text diff content appears.
- Prefer simple component composition over clever abstractions.
- Update `ui-component-spec.md` when screens, flows, or evidence presentation change materially.
- Update `stitch-screen-brief.md` when the requested screen direction changes or when Stitch image/HTML references are returned.
- Keep `ui-component-spec.md` concrete enough that Codex can implement the backend contract behind it without redesigning the frontend.
- Hand the approved UI to Codex through `docs/backlog/codex-handoffs/<story-id>.md`.
- Use direct imports and Prettier-default formatting.

## Do not

- Add backend persistence.
- Own OpenAI orchestration, rule engines, or server-side validator logic.
- Invent hidden backend behavior inside UI components.
- Recreate compliance logic in the client.
- Edit `src/server/**`, `src/shared/**`, backend tests, or infrastructure files.
- Introduce deeply nested folder structures for routine UI work.

## UI-first flow

1. Read `AGENTS.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/process/UI_CLAUDE_CHECKLIST.md`, `docs/presearch/2026-04-13-foundation.md`, and the current product docs.
2. If the user said `continue` or `next story`, resolve the active story through `.ai/workflows/continue-next-story.md`.
3. Read `docs/specs/FULL_PRODUCT_SPEC.md`.
4. Read `docs/design/MASTER_DESIGN.md`.
5. Read `evals/labels/README.md` and the label scenario manifest before inventing seeded result states.
6. If the active leaf story only has `story-packet.md`, expand it into the working docs you need before UI implementation.
7. Create or update `docs/specs/<story-id>/ui-component-spec.md` and `docs/specs/<story-id>/stitch-screen-brief.md` using the feature design generation contract above.
8. Default path: run `npm run stitch:story -- <story-id>` to generate and record Stitch output directly.
9. Review the generated Stitch output yourself against the packet and master design before showing it to the user. If it is clearly off, revise the brief and rerun.
10. Stop for user review of the generated Stitch output before implementation using `.ai/workflows/story-handoff.md`.
11. If this pass is explicitly switched to `STITCH_FLOW_MODE=manual` or local Stitch auth is broken, stop for a manual Stitch prep handoff in Comet instead.
12. Implement the screens in `src/client/**` against the approved Stitch references. Use mock data or no data where possible until Codex wires live behavior.
13. Before handing off for visual review, start the dev server yourself and open the app in Comet:
   - run `npm run dev` in the background (Vite on 5176, API on 8787; Vite auto-bumps the port if 5176 is occupied — read the background log for the actual URL)
   - open the resolved URL in Comet via `open -a "Comet" "<url>"`
   - confirm `/api/health` responds with `store: false` through the proxy before handing off
   - include the live URL, the seed scenarios to cycle through, and the specific states to inspect in the handoff message
13. Stop for user visual review using `.ai/workflows/story-handoff.md`.
14. After approval, write `docs/backlog/codex-handoffs/<story-id>.md` with:
   - Stitch image reference and Stitch HTML/code reference used for implementation
   - approved screens and routes
   - files touched in `src/client/**`
   - frozen layout, copy, and interaction constraints Codex must preserve
   - relevant eval scenarios the UI demonstrates
   - required data fields, API behavior, validation behavior, and error/loading states Codex must support
   - privacy and latency constraints the backend must preserve
   - open questions or known engineering gaps
15. Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, then stop the current story. Codex can pick it up from there when engineering is needed.
16. If the user says `continue` after that handoff, resolve the next Claude-owned UI story from `docs/process/SINGLE_SOURCE_OF_TRUTH.md` instead of treating the Codex queue as a blocker.

## Lane exceptions

- If a story has no material UI scope, Claude may not be needed.
- If a story is UI-only and does not require backend or shared-contract work, Codex may not be needed.
- If a story has UI scope and engineering scope, Claude always finishes the UI phase first and Codex waits for the approved handoff.

## Collaboration contract

- Claude owns frontend design in `src/client/**`.
- Codex consumes the approved UI as fixed input, may wire `src/client/**` to real behavior when needed, and should not redesign it.
- If the engineering work exposes a UI change, that change goes back to Claude through the backlog, not through direct Codex redesign.
