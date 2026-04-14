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
- Any Gemini integration must use inline request payloads only with provider logging and data-sharing disabled; no Files API or other durable upload surface is allowed.
- Default cloud single-label review must stay within a 5-second end-to-end target.
- Any explicit local extraction mode must declare a separate slower budget, lower-confidence posture for layout and format claims, and may not silently replace the default reviewer path.
- Planned latency-hardening stories `TTB-208` and `TTB-209` tighten the operational goal to `<= 4,000 ms`, but the current checked-in contract remains `<= 5,000 ms` until those stories land and are re-measured.
- The model may extract and classify, but final compliance outcomes come from deterministic logic and typed contracts.
- Uncertain visual judgments, especially boldness, same-field-of-vision, continuity, and separation, default to `review`.
- Claude-direct UI development is the default in this repo. Automated Stitch and manual Comet remain available as explicit alternate flows when a story benefits from Stitch-generated references.

## Primary personas

See `docs/reference/product-docs/ttb-user-personas.md` for the full stakeholder-derived persona packet. The build must simultaneously serve:

- `Sarah Chen` — leadership evaluator who needs a serious, demoable tool, clear metrics, and sub-5-second performance.
- `Dave Morrison` — veteran reviewer who demands zero-learning UX, judgment-preserving recommendations, and no extra workflow friction.
- `Jenny Park` — junior reviewer who benefits from expandable explanations, citations, confidence signals, and a digitized checklist mental model.
- `Marcus Williams` — IT gatekeeper who evaluates security posture, no-persistence claims, deployment realism, and documentation quality before any production conversation.
- `Janet` — batch-heavy reviewer whose pain drives matching review, dashboard triage, export, and failures-first batch workflows.

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

### 0. Mock internal entry

- open on a prototype-safe Treasury/TTB-flavored mock auth screen before the app shell
- simulate either PIV/CAC or Treasury SSO entry without real authentication
- show the signed-in identity in the shell once the prototype transitions into the app
- allow explicit sign-out back to the mock auth screen

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
- show the deployment-readiness path for restricted-network environments without changing the deterministic validation pipeline
- package the repo and docs as a procurement-ready demo artifact

### 5. Guided review and contextual help

- start an optional guided review from the intake surface or a persistent help entry point
- walk through the finished workflow in short, replayable modules that match real reviewer tasks
- explain dense evidence concepts with contextual indicators and plain-language help
- restart any guide at any time without introducing backend persistence or hidden completion state

## Product surfaces

### UI surfaces

- mock auth entry screen and signed-in shell identity
- extraction mode selector and mode-aware processing states
- single-label intake
- single-label processing
- single-label results
- government warning detail and diff view
- standalone mode
- batch upload and matching review
- batch progress
- batch dashboard and drill-in
- guided review and help entry points
- contextual info indicators and explainer panels
- release-polish states for accessibility, trust copy, and error handling

### Server surfaces

- health route
- single-label review route
- batch review route
- session-scoped export route or export payload generation
- tutorial and help manifest routes
- tutorial recommendation and guided-demo fixture routes
- extraction mode routing, AI provider routing, and extraction adapters
- prompt policy and endpoint-specific extraction guardrails
- deterministic validator engine
- recommendation aggregator

### Shared contract surfaces

- request contract for single-label review
- request contract for batch review
- response contract for single-label evidence
- response contract for batch progress and batch summary
- tutorial manifest and contextual-help contracts
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
- planned extraction routing should be two-stage so label extraction resolves an explicit execution mode (`cloud` or `local`) before choosing a provider path inside that mode
- planned cloud routing should stay capability-based so label extraction can run Gemini-primary with OpenAI fallback while other model-backed capabilities remain OpenAI-primary with Gemini fallback
- planned latency hardening should add stage-level timing and budget enforcement for the default cloud single-label path before the contract is cut over from `5,000 ms` to `4,000 ms`
- planned local extraction mode should run through a self-hosted Ollama-backed vision model and share the same typed extraction contract plus deterministic validators, while degrading weak formatting and spatial claims to uncertainty
- planned prompt hardening should move extraction prompts behind persona-centered, endpoint-aware, mode-aware prompt profiles and structural guardrails so every model-backed route serves reviewer trust before raw field coverage
- planned eval hardening should score all model-backed endpoints across cloud and local execution modes against persona-specific promises, not just generic extraction correctness
- first model pass is structured extraction only
- deterministic validators run after extraction
- response shaping is a separate layer from extraction and validation
- guided review and help content should be delivered from typed, deterministic manifests
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
- `TTB-206`: extraction mode routing foundation and privacy-safe cloud/local provider policy
- `TTB-207`: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation
- `TTB-208`: cloud/default latency observability and sub-4-second budget framing
- `TTB-209`: cloud/default single-label hot-path optimization to `<= 4 seconds`
- `TTB-212`: local extraction mode: Ollama-hosted Qwen2.5-VL with degraded-confidence guardrails
- `TTB-210`: persona-centered prompt profiles and endpoint plus mode guardrails
- `TTB-211`: LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates
- `TTB-103`: batch intake, matching review, and progress UI
- `TTB-104`: batch dashboard, drill-in shell, and export UI
- `TTB-301`: batch parser, matcher, orchestration, and session export
- `TTB-105`: accessibility, trust copy, and final UI polish
- `TTB-106`: guided review, replayable help, and contextual info layer
- `TTB-107`: mock Treasury auth entry and signed-in shell identity
- `TTB-108`: extraction mode selector and mode-aware processing states
- `TTB-401`: final privacy, performance, eval, and submission pack

## Lane split

### Claude

- owns frontend design in `src/client/**`
- defaults to direct UI implementation, and prepares Stitch briefs only when a pass explicitly uses automated or manual Stitch
- stops at visual approval, writes Codex handoffs, and then continues the next UI story

### Codex

- owns contracts, server, validators, OpenAI integration, tests, evals, LangSmith trace-driven development, privacy, performance, and submission docs
- preserves the approved UI without redesigning it and may wire approved `src/client/**` surfaces to live behavior
- blocks and returns to Claude when a required UI change appears

## Compact packet rule

- Every leaf story has a checked-in packet under `docs/specs/<story-id>/`.
- During planning, that packet may be a compact `story-packet.md`.
- Before active implementation, any agent may create or expand the packet into the standard working docs needed to move the story forward. Lane ownership still controls implementation and handoff work.

## Env and integration needs

- required for MVP implementation: `OPENAI_API_KEY`
- required config values: `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_STORE=false`, `PORT`
- planned extraction-mode and provider config: `GEMINI_API_KEY`, `GEMINI_VISION_MODEL`, `GEMINI_TEXT_MODEL`, `GEMINI_EMBEDDING_MODEL`, `AI_CAPABILITY_DEFAULT_ORDER`, `AI_CAPABILITY_LABEL_EXTRACTION_ORDER`, `AI_EXTRACTION_MODE_DEFAULT`, `AI_EXTRACTION_MODE_ALLOW_LOCAL`, `OLLAMA_HOST`, `OLLAMA_LABEL_EXTRACTION_MODEL` (do not require these until `TTB-206`, `TTB-207`, and `TTB-212` land)
- optional local trace-driven development: `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING=false` by default
- local runtime bootstrap: `npm run env:bootstrap` creates or refreshes an ignored repo `.env` from the local gauntlet env inventory, and the server auto-loads `.env` / `.env.local`
- LangSmith bootstrap resolves `LANGSMITH_API_KEY` from either `LANGSMITH_API_KEY` or legacy `LANGCHAIN_API_KEY` in the local gauntlet env inventory
- trace-driven development is a local-only engineering loop; do not trace staging or production user submissions
- optional automated Stitch generation can use a local `STITCH_API_KEY` or the ignored project-local Stitch MCP config
- optional local-only Stitch tooling values: `STITCH_PROJECT_ID`, `STITCH_FLOW_MODE`

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
- every UI umbrella packet has a backfilled `ui-component-spec.md`, with `stitch-screen-brief.md` present whenever that packet uses Stitch
- LangSmith trace-driven development is wired for future AI stories via repo-local env bootstrap, `npm run langsmith:smoke`, and checked-in workflow docs, while staying off by default
- the leaf-story map is explicit enough that no one has to infer the next slice from memory
- the deployment scaffold is checked in even if the external GitHub and Railway bootstrap still needs user credentials and project linkage
