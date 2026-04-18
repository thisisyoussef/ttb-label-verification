# CLAUDE

Claude Code is the primary developer on this repo. Full-stack — UI, server,
contracts, extractors, judges, evals, docs, infra glue.

## Project overview

Standalone TTB label verification proof of concept.

- Frontend: Vite + React 19, TailwindCSS, custom theme
- Backend: Express on Node 20
- Contracts: Zod at `src/shared/contracts/**` — single source of truth for
  the UI/API boundary and for eval/export consumers
- AI lane: Gemini 2.5 Flash-Lite for vision, OpenAI as fallback; OCR via
  Tesseract pre-pass; warning OCV; LLM uncertainty resolver; all
  orchestrated server-side
- Deploy: Railway (staging + production environments, same service)
- Dev: `npm run dev` boots Vite on 5176 + API on 8787

## Documentation sources

Reference actively while working:

- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` — current story state and queue
- `docs/specs/FULL_PRODUCT_SPEC.md` — product shape and leaf-story map
- `docs/specs/<story-id>/` — per-story packet (UI spec, plan, notes)
- `docs/design/MASTER_DESIGN.md` — durable product design baseline
- `docs/reference/env-audit-2026-04-13.md` — env var assumptions
- `docs/process/DEPLOYMENT_FLOW.md` — how completed stories ship
- `docs/specs/verification-mode-extraction.md` — planned architecture
  shift for identifier fields (brand/fanciful/class/country/address)
- `evals/labels/` and `evals/golden/manifest.json` — seeded scenarios
- `src/shared/contracts/**` — read every schema before writing code that
  depends on it; update thoughtfully when the contract needs to evolve

## Primary lane

- Ship end-to-end. UI and server are the same lane.
- Edit `src/client/**`, `src/server/**`, `src/shared/**`, tests, evals,
  and docs with the same judgment.
- Preserve the Zod contract as the UI/API boundary. A contract change is
  a deliberate act: update the schema, update every consumer in the same
  pass, update tests that encode the old shape.
- Keep feature flags for risky behavioral shifts so we can A/B against
  the current eval baseline without a forked deployment.
- Default UI flow stays `STITCH_FLOW_MODE=claude-direct`: build directly
  from the checked-in packet and master design. Automated/manual Stitch
  passes remain opt-in per `docs/process/STITCH_AUTOMATION.md`.
- Use realistic seeded data from `evals/labels/manifest.json` and the
  scenario set in `evals/golden/manifest.json` until the pipeline is
  exercised with live COLA Cloud data.
- Treat `docs/design/MASTER_DESIGN.md` as the durable design baseline.
- Keep the interface large-text friendly, keyboard reachable, and
  understandable in two clicks or less for the main single-label flow.
- Treat the government warning section as the densest UI surface and
  keep it readable when expanded.
- Follow `docs/process/GIT_HYGIENE.md` for branch, commit, push behavior.
  Run the gate scripts before reviewable commits/pushes/publishes.
- Starting a new story or feature means opening a fresh
  `claude/<story-id>-<summary>` branch before packet or code edits.
- If Claude opens or updates a PR, the description must use
  `.github/pull_request_template.md` and stay production-grade:
  changed surfaces, tests added or updated, exact validation run,
  risks, screenshots or manual QA, and follow-ups must all be explicit.
- Once a branch is approved, published, validated, and mergeable, merge
  into `main` before treating the work as complete unless the user
  explicitly asks to hold it or a concrete blocker exists.
- Railway env parity (staging/production) is a release-readiness check,
  not an afterthought. Verify before large behavioral changes and after
  adding new feature flags.

## Architecture rules

- Keep the frontend flat and direct. This is a proof of concept, not a
  place for deep folder nesting.
- Build UI against the current typed contracts, not ad hoc response shapes.
- Keep validation, rule interpretation, and AI orchestration on the server.
- React state is fine for UI state, request state, expanded rows, form
  state, and seeded review data.
- The Zod contract is shared across surfaces. When a new field or shape
  is needed, update the schema, every server path that writes it, every
  UI path that reads it, and the tests that encode the old shape — all
  in the same commit.
- Judgment lives in `src/server/judgment-*` and `src/server/review-report-*`.
  Don't recreate judgment in the UI — the client formats for display,
  never for decisions.
- Extraction orchestration (VLM call, OCR prepass, warning OCV, resolver,
  warning vote) lives in `src/server/**-review-extractor.ts`,
  `ocr-field-extractor.ts`, `warning-*`, and `review-llm-resolver*`.
  Keep components composable: the streaming extractor path and the
  one-shot path share the same finalizer.

## Design document model

- `docs/specs/<story-id>/` is the universal story packet.
- `docs/specs/FULL_PRODUCT_SPEC.md` is the product-wide source of truth.
- `docs/design/MASTER_DESIGN.md` is the durable design baseline.
- `docs/specs/<story-id>/ui-component-spec.md` is the per-feature UI
  spec for non-trivial UI-first work.
- `docs/specs/<story-id>/stitch-screen-brief.md` is the Stitch prompt doc
  — produced only when the pass uses Stitch.
- `docs/specs/<story-id>/story-packet.md` is the compact packet for
  pre-authored leaf stories; expand before active implementation.
- Plan docs under `docs/specs/<feature-name>.md` capture durable
  architectural direction for feature work (example:
  `verification-mode-extraction.md`, `gemini-synthetic-labels.md`).

### Packet reconciliation

A compact `story-packet.md` is a planning artifact, not a frozen
contract. When expanding for active implementation:

- Treat `docs/process/SINGLE_SOURCE_OF_TRUTH.md` as the live source of
  truth for scope and status.
- Mirror the SSOT queue: "done", "ready-for-review", "blocked", etc.
- Split constitution checks by surface when the story touches multiple
  surfaces (UI + server + evals); list per-surface rules, not a single
  aggregate rule.
- Reconcile at two gates: (1) when the packet is first expanded before
  implementation, and (2) when the story is ready to ship. If the
  packet and SSOT disagree at either gate, the SSOT wins and the packet
  is updated.

### Feature design generation contract

For non-trivial feature work, generate or update
`docs/specs/<story-id>/ui-component-spec.md` before implementation,
and generate or update `docs/specs/<story-id>/stitch-screen-brief.md`
only when the selected pass uses Stitch.

Read first (before asking for more context):

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

Ask the user only if critical context is still missing after reading.

Write `ui-component-spec.md` with these sections:

1. Problem
2. Users & use cases
3. UX flows
4. IA / layout
5. States
6. Copy & microcopy
7. Accessibility / privacy / performance constraints
8. Data and evidence needs from backend
9. Frozen design constraints
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

Writing rules for `stitch-screen-brief.md`:

- **State the platform explicitly: web only.** Every Stitch prompt must
  open by declaring the platform is web and instructing Stitch to
  generate web output only — not mobile/iOS/Android/tablet-app artifacts.
  Desktop-first web with graceful responsive behavior on narrower
  browser widths; touch is not the primary input.
- **Describe intent, not execution.** Stitch owns visual design
  decisions — color, typography, spacing, component styling,
  iconography, exact layout. The brief tells Stitch who the user is,
  what moment they're in, what outcome each region must produce, what
  states and variations must be visible, and what the experience should
  feel like.
- **Do not prescribe visual specifics.** Never name specific colors,
  fonts, pixel sizes, border styles, margins, grids, shadow values, or
  component names that bake in styling. Describe the functional
  behavior or emotional outcome.
- **Prefer interaction outcomes over widget names.**
- **Describe feelings and anti-feelings.** Capture the emotional target
  and what the design must not feel like.
- **Copy anchors stay exact.** Product copy is content, not design.
- **States and variations are non-negotiable.** Enumerate every state
  Stitch should render.
- **Tie to the TTB reviewer workflow and the six eval scenarios when
  relevant**, but express that as user intent and required variations.
- **Once Stitch references return, implement from them.**
- **At the Stitch-prep handoff stop, paste the full brief inline in
  chat** so the user can run it without opening the file.

## Folder structure

```text
ttb-label-verification/
├── src/
│   ├── client/              # React UI + client helpers
│   ├── server/              # Express API + AI orchestration
│   └── shared/contracts/    # Zod contracts + shared constants
├── docs/                    # process, presearch, specs, decisions
├── evals/                   # manifests, fixtures, results
├── scripts/                 # eval harness, seed loaders, deploy helpers
├── .ai/                     # workflow mirrors
├── AGENTS.md
└── CLAUDE.md
```

## Naming conventions

- Components: PascalCase
- Hooks: camelCase with `use` prefix
- Utilities: camelCase
- Constants: UPPER_SNAKE_CASE
- Do not add barrel files; import directly from source

## Code hygiene

- Soft cap source files at 300 lines. Hard cap at 500. Extract
  subcomponents, hooks, or helpers before a file becomes unmaintainable.
- One primary responsibility per component, hook, or server module.
- Extract repeated structure or logic once it appears in 2 meaningful
  places or when duplication starts hiding intent.
- Keep domain, validation, and transport logic out of UI components.
- Prefer presentational + state-wrapper splits when state, effects,
  or branching become non-trivial.
- Avoid effect-heavy components. Multiple unrelated `useEffect` blocks
  usually means state ownership should split.
- Keep props narrow and intention-revealing.
- Prefer explicit view-state models over scattered booleans.
- If a cleanup is required to preserve these rules, do it in the same
  pass rather than leaving a known messy seam.

## Do

- Ship end-to-end: UI, contract, server, tests, evals, docs together.
- Implement upload, form, processing, result, error, and batch-dashboard
  flows with deterministic sample data until live data is wired.
- Use the seeded scenarios to cover actual product edge cases: warning
  text defects, cosmetic brand mismatch, wine dependency failures,
  forbidden ABV format, low-quality image confidence.
- Preserve stable layout as statuses expand, rows open, and long
  warning text diff content appears.
- Prefer simple component composition over clever abstractions.
- Update the shared contract when the UI needs new fields or shapes
  from the server — propagate the change to every consumer in the
  same commit.
- Update `ui-component-spec.md` when screens, flows, or evidence
  presentation change materially.
- Update `stitch-screen-brief.md` when the requested screen direction
  changes or when Stitch references are returned.
- Write plan docs under `docs/specs/<feature>.md` for durable
  architectural direction; ship the build in follow-up commits.
- Run `npm run gate:commit` before reviewable commits and
  `npm run gate:push` before reviewable pushes.
- Verify Railway env parity (staging + production) before large
  behavioral changes and when adding new env-backed flags.
- Use direct imports and Prettier-default formatting.

## Do not

- Add server-side persistence beyond the ephemeral request lifecycle.
- Recreate compliance logic in the client.
- Deploy directly to production without first validating against the
  golden eval set (`cola-cloud-all` slice is the gold standard).
- Bypass the Zod contract by accepting arbitrary shapes from the
  server — if the UI needs data the contract doesn't expose, extend
  the contract.
- Introduce deeply nested folder structures for routine work.
- Ship destructive migrations without a rollback plan.
- Skip git hooks (`--no-verify`, `--no-gpg-sign`) unless the user
  explicitly asks.

## Full-feature flow

1. Read `AGENTS.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`,
   `docs/specs/FULL_PRODUCT_SPEC.md`, `docs/design/MASTER_DESIGN.md`,
   `evals/labels/README.md`, and the active story packet.
2. If the user said `continue` or `next story`, resolve through
   `.ai/workflows/continue-next-story.md`.
3. If the active leaf story only has `story-packet.md`, expand before
   implementation.
4. Create or update `docs/specs/<story-id>/ui-component-spec.md` for
   non-trivial UI work. Create or update `stitch-screen-brief.md` only
   for Stitch-assisted passes.
5. Open a fresh `claude/<story-id>-<summary>` branch before packet or
   code edits.
6. Default path: `STITCH_FLOW_MODE=claude-direct`. Implement directly
   from the checked-in design context.
7. For automated Stitch passes, run `npm run stitch:story -- <story-id>`
   and review the generated output before showing it to the user.
8. Implement:
   - Update the contract if the shape needs to change.
   - Build the server path: extractor, judge rules, validator wiring.
   - Build the UI: screens, states, evidence panels.
   - Add or update unit tests next to the code they cover.
   - Add eval coverage where behavior is interesting against the
     golden set.
9. Verify: `npx tsc --noEmit`, `npx vitest run`, preview the change
   with `preview_start` + snapshot, run the relevant eval slice.
10. Ship:
    - `npm run gate:commit` before commit.
    - `npm run gate:push` before push.
    - PR uses `.github/pull_request_template.md`.
    - Merge to `main` once approved, validated, and mergeable.
11. Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
12. Deploy via the Railway flow in `docs/process/DEPLOYMENT_FLOW.md`;
    verify `/api/health` and a smoke run against the live endpoint.

## Starting-point behaviors when the user says "continue"

- Resolve the active story from `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
  and the continue-next-story workflow.
- Don't treat pending work in other surfaces as a blocker — the lane
  is end-to-end.
- If the user's message is a blocker or question, answer first, then
  keep moving.

## Collaboration contract

- Claude is the primary developer. Code, contracts, infra glue, docs.
- The user directs priority and taste. Claude defers on product
  direction and visual design choices that haven't been decided yet.
- When a design/taste call could go multiple ways, stop and ask —
  don't guess.
