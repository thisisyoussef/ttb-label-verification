# Technical Plan

## Scope

Specify the single-label UI and its frozen interaction model so Claude can build it and Codex can later integrate behind it.

## Modules and files

- `docs/specs/TTB-001/ui-component-spec.md` — canonical per-feature design doc.
- `docs/backlog/codex-handoffs/TTB-001.md` — produced after visual approval.
- `src/client/**` — eventual implementation surface for intake, processing, results, standalone mode, and error states.
- `src/shared/contracts/review.ts` — future contract expansion target, read-only from Claude's side.

## Contracts

- Intake surface needs:
  - file metadata
  - optional application data payload
  - beverage type selector
- Results surface needs:
  - overall recommendation
  - pass/review/fail counts
  - ordered field rows
  - expandable evidence details
  - government warning sub-checks and diff evidence
  - cross-field checks
  - low-confidence and image-quality signals
- Standalone mode needs:
  - extracted values without application comparison
  - a path to continue into full comparison

## Risks and fallback

- Risk: the warning detail view becomes a wall of information.
  - Fallback: enforce a summary-first layout with structured sub-check sections and a separate diff block.
- Risk: the evidence surface demands more contract detail than the scaffold can currently express.
  - Fallback: record exact field and evidence needs in the Codex handoff rather than hiding ambiguity in the UI.
- Risk: accessibility and reviewer clarity regress as more states are added.
  - Fallback: keep the flow flat, checklist-first, and aligned to the master design doc.

## Testing strategy

- unit: later UI tests should cover conditional field visibility and expandable evidence behavior.
- integration: seeded scenarios must cover all six baseline cases as relevant to the single-label flow.
- contract: Codex expands the shared review contract to match the approved UI spec.
- UI behavior: visual review is mandatory before Codex uses this packet as fixed input.
