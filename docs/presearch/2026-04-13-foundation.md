# Presearch: TTB Label Verification Foundation

Date: 2026-04-13  
Project root: `/Users/youss/Development/gauntlet/ttb-label-verification`

## Objective

Create the first project scaffold for a standalone TTB label verification proof of concept with:

- a Codex-first engineering harness for the intelligence layer
- a Claude-first UI harness for presentation work
- a shared contract boundary that lets both lanes move independently

## Inputs reviewed

### Product docs extracted from `files.zip`

- `ttb-prd-comprehensive.md`
- `ttb-product-spec-final.md`
- `ttb-implementation-roadmap-final.md`

### Official sources checked

- OpenAI Responses API migration guide: <https://developers.openai.com/api/docs/guides/migrate-to-responses>
- OpenAI Structured Outputs guide: <https://developers.openai.com/api/docs/guides/structured-outputs>
- OpenAI Images and Vision guide: <https://developers.openai.com/api/docs/guides/images-vision>
- OpenAI data controls guide: <https://developers.openai.com/api/docs/guides/your-data>
- TTB Health Warning Statement: <https://www.ttb.gov/public-information/ttb-audiences/public/health-warning-statements>
- TTB Distilled Spirits Mandatory Label Information: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-brand-label>
- TTB Distilled Spirits Health Warning: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning>
- TTB Wine Labeling: Appellation of Origin: <https://www.ttb.gov/labeling-wine/wine-labeling-appellation-of-origin>
- TTB Wine Labeling: Brand Label: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/labeling-wine/wine-labeling-brand-label>
- TTB Malt Beverage Mandatory Label Information: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-mandatory-label-information>
- TTB Malt Beverage Mandatory Information Checklist: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-labeling-checklist>
- TTB Beverage Alcohol Manual for wine: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/beverage-alcohol-manual>
- TTB Public COLA Registry: <https://www.ttb.gov/what-we-do/online-services/public-cola-registry>
- eCFR 27 CFR 4.34 class and type: <https://www.ecfr.gov/current/title-27/part-4/section-4.34>

## Hard product constraints

- Standalone proof of concept only. No direct COLAs Online integration in the first build.
- No persistence of uploaded labels, application data, or review results.
- Single-label verification should complete in under 5 seconds.
- Agents need different outputs: senior reviewers want judgment, junior reviewers want explicit checklisting, and leadership wants a demoable workflow.
- The government warning check is the showcase capability.
- Same-field-of-vision and typography judgments are high value but uncertainty-prone, so the system must prefer `review` over false certainty.

## Workflow conclusions

- Canonical repo guidance should live in checked-in docs, not only in hidden tool prompts.
- The agent layer should be modular and testable, with typed boundaries and explicit verification.
- Complex orchestration should be governed by a service boundary, not smeared across UI code.
- A flat, direct frontend structure keeps UI work fast and understandable.
- Performance and layout stability matter more than decorative complexity.
- `.ai` should mirror canonical repo docs rather than becoming a second source of truth.
- Explicit workspace indexes and read order reduce wasted context.
- Separate the research contract from implementation instructions.

## Researcher vs. critic

### 1. Where should the harness be authoritative?

Researcher: Put the main workflow in `.ai` so agents can find it quickly.  
Critic: Hidden harness docs drift unless the repo root documents are canonical.  
Decision: `AGENTS.md` and `CLAUDE.md` are canonical. `.ai` mirrors those rules for tool-specific execution.

### 2. How should Codex and Claude split work?

Researcher: Let Claude build the frontend shell with hardcoded review states while Codex builds the intelligence layer behind shared contracts.  
Critic: That only works if the contract boundary is explicit and stable.  
Decision: Shared Zod contracts in `src/shared/contracts` are the handshake. Claude owns UI surfaces. Codex owns extraction, validation, API, tests, and integration.

### 3. What is the safest AI validation shape?

Researcher: Use one vision call to extract facts from the label and application, then run deterministic rule checks on the extracted structure.  
Critic: Some judgments are visual and cannot be reduced to pure OCR.  
Decision: Use one structured extraction pass as the baseline, with optional bounded recovery for ambiguous visual checks. Typography and same-field-of-vision remain advisory; uncertainty maps to `review`, never silent `pass`.

### 4. What scaffold best fits phase one?

Researcher: A single-package Vite React plus Express stack is enough for a standalone proof of concept and keeps the seam between UI and API obvious.  
Critic: A monorepo might age better if the project expands.  
Decision: Start with one package and shared contracts inside `src/`. The first need is speed of iteration and clean ownership, not monorepo machinery.

## Foundation decisions

### Decision A: OpenAI integration

- Use the Responses API for new model work because it is agent-oriented, supports tool flows cleanly, and aligns with structured outputs.
- Use structured outputs for extraction schemas instead of loose JSON mode.
- Set `store: false` on every request because the product requirement is no persistence.
- Avoid background mode in the first iteration because it introduces retention and lifecycle complexity that does not help a sub-5-second single-label review.

### Decision B: Compliance engine shape

- Extract once into a typed review input model.
- Run deterministic validators for:
  - exact government warning comparison
  - required-field presence
  - formatting and placement checks where the source is unambiguous
  - beverage-type specific rules
  - cross-field consistency between label and application data
- Separate hard failures from human-review conditions.

### Decision C: Delivery split

- Claude builds presentation states first with seed fixtures.
- Codex wires live server data later by preserving the shared contract and replacing seed fetches.
- This lets UI iteration continue while rule ingestion and OpenAI evaluation mature.

## Initial system shape

### Frontend

- Vite + React
- Single-label review shell first
- Batch mode represented in the scaffold as a planned lane, not fully implemented yet
- Accessibility and large-text readiness from the start

### Backend

- Express API
- Seed health endpoint
- Seed review endpoint returning typed sample data
- Placeholder location for OpenAI orchestration and deterministic validator modules

### Shared boundary

- Zod schemas for health and review payloads
- Seed fixture doubles as UI/demo data and contract lock
- Tests protect the contract before any model calls exist

## Target latency budget

- Request parsing and validation: under 250 ms
- Vision extraction: target 3 seconds or less
- Deterministic validators: under 250 ms
- Serialization and UI render response: under 1 second
- Total target: under 5 seconds for a single label

## Initial backlog after scaffold

1. Formalize the extraction schema per beverage type.
2. Add deterministic validators for the health warning text, presence, and severity mapping.
3. Add a model adapter using the Responses API with `store: false`.
4. Add upload handling with strict size and mime limits, while keeping data ephemeral.
5. Replace the seed review endpoint with a real extraction-plus-validation flow.
6. Extend the UI into upload, processing, result, and error states using the shared contract.
7. Add golden-label fixtures and evaluator coverage for false-positive and false-negative edge cases.

## Risks and open questions

- TTB guidance is spread across regulations, manuals, checklists, and product-specific pages. Rule ingestion will need source-by-source normalization before a production-grade validator exists.
- Boldness, continuity, and same-field-of-vision are partially visual judgments. The system must expose confidence and downgrade uncertainty to `review`.
- The Public COLA Registry is useful as a research and future cross-check input, but the first scaffold should not depend on live registry access.
- Batch processing exists in the roadmap, but the first scaffold should optimize the single-label path and add bounded concurrency later.

## Scaffold acceptance criteria

- Project exists in its own directory under `gauntlet`.
- Canonical repo instructions exist in `AGENTS.md` and `CLAUDE.md`.
- `.ai` mirrors the Codex and Claude workflow without becoming the authority.
- Shared contract and seed fixture exist and are tested.
- A minimal UI and API run locally and demonstrate the ownership split.
