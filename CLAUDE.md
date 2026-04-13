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
- `docs/specs/<story-id>/` for the shared story packet
- `docs/reference/env-audit-2026-04-13.md` for current integration/env assumptions
- `docs/process/DEPLOYMENT_FLOW.md` for how completed stories move to staging and production after Codex finishes them
- `docs/reference/product-docs/` for product requirements and imported source material
- `docs/design/MASTER_DESIGN.md` for the durable product design baseline
- `evals/labels/` for seeded scenarios and review-state coverage

## Primary lane

- Build and refine the review experience only.
- The default UI flow is Stitch-assisted: write the screen brief, wait for the user to run Google Stitch manually, then implement from the returned Stitch image and HTML references.
- Use realistic seeded data and read the current shared contract in `src/shared/contracts/review.ts`.
- Base seeded UI states on the six required label scenarios in `evals/labels/manifest.template.json`, not ad hoc examples.
- Treat `docs/design/MASTER_DESIGN.md` as the durable design baseline for the product.
- Keep the interface large-text friendly, keyboard reachable, and understandable in two clicks or less for the main single-label flow.
- Treat the government warning section as the densest UI surface and keep it readable when expanded.
- For non-trivial UI-first feature work, create or update `docs/specs/<story-id>/ui-component-spec.md` and `docs/specs/<story-id>/stitch-screen-brief.md` before implementation.
- Do not try to run Google Stitch yourself. The user runs Stitch and returns the references Claude should implement against.
- After the runnable full-screen set exists, stop for user visual review.
- After feedback is incorporated and the UI direction is approved, write `docs/backlog/codex-handoffs/<story-id>.md` so Codex can finish the engineering and full spec packet.

## Blocking behavior

Claude must block and redirect instead of improvising outside its lane.

- If the user says `continue` or `continue with the next story`, resolve that request from `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md` instead of guessing.
- If the requested next step is backend or engineering work, stop and tell the user to continue in Codex.
- If `stitch-screen-brief.md` is ready but the user has not yet returned a Stitch image reference and Stitch HTML/code reference, stop and tell the user to run Stitch manually and come back with those references.
- If the UI is approved and the remaining work is contract, API, validator, orchestration, testing, or integration work, stop and tell the user to move to Codex with `docs/specs/<story-id>/` and `docs/backlog/codex-handoffs/<story-id>.md`.
- If the next ready story in the tracker belongs to Codex instead of Claude, stop and tell the user to continue in Codex with the exact story path.
- Do not promise staging or production deployment from Claude. Deployment ownership sits in Codex and the external bootstrap flow.
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

## Feature design generation contract

For non-trivial UI-first feature work, generate or update `docs/specs/<story-id>/ui-component-spec.md` and `docs/specs/<story-id>/stitch-screen-brief.md` using the context already in the repo before asking for more information.

Read first:

- `AGENTS.md`
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `docs/process/UI_CLAUDE_CHECKLIST.md`
- `docs/specs/FULL_PRODUCT_SPEC.md`
- `docs/presearch/2026-04-13-foundation.md`
- `docs/reference/product-docs/README.md` and the relevant source docs
- `docs/design/MASTER_DESIGN.md`
- `evals/labels/manifest.template.json`
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
2. Target user moment
3. Screen prompt for Stitch
4. Required sections and components
5. Required states to visualize
6. Copy anchors and terminology
7. Constraints and must-avoid notes
8. Returned Stitch references

Writing rules:

- Be specific. Prefer concrete labels, examples, and edge cases over abstractions.
- Optimize for implementation by a full-stack engineer without extra interpretation.
- Tie the feature back to the actual TTB reviewer workflow and the six eval scenarios when relevant.
- Stay in the UI lane. Do not design backend architecture, validators, or contract ownership.
- If backend capabilities are required, describe them in section 8 and in the Codex handoff doc instead of editing shared or server code.
- Once the user returns Stitch references, implement from those references instead of re-designing the visual direction from scratch.

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
8. Stop for a Stitch prep handoff using `.ai/workflows/story-handoff.md` so the user can run Google Stitch manually.
9. Wait for the user to return a Stitch image reference and Stitch HTML/code reference, then record them in `docs/specs/<story-id>/stitch-screen-brief.md`.
10. Implement the screens in `src/client/**` against the returned Stitch references. Use mock data or no data where possible until Codex wires live behavior.
11. Before handing off for visual review, start the dev server yourself and open the app in Comet:
   - run `npm run dev` in the background (Vite on 5176, API on 8787; Vite auto-bumps the port if 5176 is occupied — read the background log for the actual URL)
   - open the resolved URL in Comet via `open -a "Comet" "<url>"`
   - confirm `/api/health` responds with `store: false` through the proxy before handing off
   - include the live URL, the seed scenarios to cycle through, and the specific states to inspect in the handoff message
12. Stop for user visual review using `.ai/workflows/story-handoff.md`.
13. After approval, write `docs/backlog/codex-handoffs/<story-id>.md` with:
   - Stitch image reference and Stitch HTML/code reference used for implementation
   - approved screens and routes
   - files touched in `src/client/**`
   - frozen layout, copy, and interaction constraints Codex must preserve
   - relevant eval scenarios the UI demonstrates
   - required data fields, API behavior, validation behavior, and error/loading states Codex must support
   - privacy and latency constraints the backend must preserve
   - open questions or known engineering gaps
14. Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, then stop. Codex picks it up from there.

## Lane exceptions

- If a story has no material UI scope, Claude may not be needed.
- If a story is UI-only and does not require backend or shared-contract work, Codex may not be needed.
- If a story has UI scope and engineering scope, Claude always finishes the UI phase first and Codex waits for the approved handoff.

## Collaboration contract

- Claude owns `src/client/**`.
- Codex consumes the approved UI as fixed input and should not redesign it.
- If the engineering work exposes a UI change, that change goes back to Claude through the backlog, not through direct Codex redesign.
