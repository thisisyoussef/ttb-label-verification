# Full Product Spec

This document is the product-wide blueprint for the TTB Label Verification proof of concept. It turns the imported source material and umbrella packets into a concrete build map that Claude and Codex can execute story by story.

## Product goal

Build a standalone web application that helps TTB reviewers verify alcohol beverage labels faster and more consistently by:

- extracting structured facts from a label image
- comparing them against optional COLA application fields
- applying deterministic beverage-specific validation rules
- returning a reviewer-facing recommendation with evidence and explicit uncertainty

## Hard constraints

- No uploaded image, application input, or verification result may be persisted.
- OpenAI integration must use the Responses API with `store: false`.
- Single-label review must stay within a 5-second end-to-end target.
- The model may extract and classify, but final compliance outcomes come from deterministic logic and typed contracts.
- Uncertain visual judgments, especially boldness, same-field-of-vision, continuity, and separation, default to `review`.
- Google Stitch is manual. Claude writes the brief, the user runs Stitch, Claude implements against the returned image and HTML/code references.

## Primary user journeys

### 1. Single-label comparison

- upload one label image
- optionally enter application fields
- run review
- inspect recommendation, checklist rows, warning detail, cross-field checks, and original image
- reset or export

### 2. Standalone image-only check

- upload one label image without application data
- extract fields and run format/compliance checks only
- surface editable extracted values and a path back into full comparison

### 3. Batch review

- upload many label images plus one CSV
- confirm or fix matching
- watch progress
- triage results in a dashboard
- drill into any row using the same evidence language as single-label review
- export the session result set

### 4. Evaluation and demo

- prove the six baseline label cases
- show privacy and performance posture clearly
- package the repo and docs as a procurement-ready demo artifact

## Product surfaces

### UI surfaces

- single-label intake
- single-label processing
- single-label results
- government warning detail and diff view
- standalone mode
- batch upload and matching review
- batch progress
- batch dashboard and drill-in
- release-polish states for accessibility, trust copy, and error handling

### Server surfaces

- health route
- single-label review route
- batch review route
- session-scoped export route or export payload generation
- OpenAI extraction adapter
- deterministic validator engine
- recommendation aggregator

### Shared contract surfaces

- request contract for single-label review
- request contract for batch review
- response contract for single-label evidence
- response contract for batch progress and batch summary
- warning sub-check and diff evidence objects
- confidence and uncertainty metadata

## Rule families

- government warning exact-text and format checks
- required field presence checks
- fuzzy cosmetic comparison handling
- beverage-specific rules for spirits, wine, and malt beverages
- cross-field dependency rules
- image quality and low-confidence handling

## Recommendation model

- `approve`: no blocker or major issue remains
- `review`: cosmetic mismatch, uncertainty, or advisory issue needs human eyes
- `reject`: clear deterministic violation exists

## Architecture direction

- React + Vite frontend
- Express API
- shared Zod contracts in `src/shared/contracts`
- first model pass is structured extraction only
- deterministic validators run after extraction
- response shaping is a separate layer from extraction and validation
- no database, no queue, no background job for the proof of concept

## Story architecture

### Umbrella packets

- `TTB-EVAL-001`: eval baseline
- `TTB-001`: single-label reviewer experience
- `TTB-002`: single-label intelligence path
- `TTB-003`: batch workflow
- `TTB-004`: hardening and submission gate

### Executable leaf stories

- `TTB-101`: single-label intake and processing UI
- `TTB-102`: single-label results, warning evidence, and standalone UI
- `TTB-201`: shared review contract expansion and seed fixture alignment
- `TTB-202`: single-label upload intake, normalization, and ephemeral file handling
- `TTB-203`: extraction adapter, beverage inference, and image-quality assessment
- `TTB-204`: government warning validator and diff evidence
- `TTB-205`: field comparison, beverage rules, cross-field checks, and recommendation aggregation
- `TTB-103`: batch intake, matching review, and progress UI
- `TTB-104`: batch dashboard, drill-in shell, and export UI
- `TTB-301`: batch parser, matcher, orchestration, and session export
- `TTB-105`: accessibility, trust copy, and final UI polish
- `TTB-401`: final privacy, performance, eval, and submission pack

## Lane split

### Claude

- owns all frontend design and implementation in `src/client/**`
- prepares Stitch briefs and blocks until Stitch references are returned
- stops at visual approval and writes Codex handoffs

### Codex

- owns contracts, server, validators, OpenAI integration, tests, evals, privacy, performance, and submission docs
- preserves the approved UI without redesigning it
- blocks and returns to Claude when a required UI change appears

## Compact packet rule

- Every leaf story has a checked-in packet under `docs/specs/<story-id>/`.
- During planning, that packet may be a compact `story-packet.md`.
- Before active implementation, the owning agent expands the packet into the standard working docs it needs.

## Env and integration needs

- required for MVP implementation: `OPENAI_API_KEY`
- required config values: `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_STORE=false`, `PORT`
- optional only if tracing is enabled later: `LANGSMITH_API_KEY` or `LANGFUSE_PUBLIC_KEY` plus `LANGFUSE_SECRET_KEY`
- no Google Stitch repo key is required because Stitch is run manually by the user outside the app

## Deployment shape

- local bootstrap script creates the GitHub repo and pushes `main` plus `production`
- GitHub Actions runs CI on pull requests and on pushes to `main` and `production`
- Railway `staging` environment should track `main`
- Railway `production` environment should track `production`
- Railway should wait for CI before auto-deploying
- post-deploy verification should hit `/api/health`
- production promotion should be explicit and should update the `production` branch from a validated source ref

## Definition of ready to build

The product is ready to develop through the harness when:

- the live tracker points to the next ready leaf story
- the owning agent can resolve `continue` from checked-in state
- every UI umbrella packet has a backfilled `stitch-screen-brief.md`
- the leaf-story map is explicit enough that no one has to infer the next slice from memory
- the deployment scaffold is checked in even if the external GitHub and Railway bootstrap still needs user credentials and project linkage
