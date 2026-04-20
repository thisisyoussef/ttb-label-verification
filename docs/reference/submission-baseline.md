# Approach, Tools, Assumptions, Trade-Offs, And Limitations

Last updated: 2026-04-19

This is the short submission brief for the current prototype. It complements the deeper [Architecture And Decisions](../ARCHITECTURE_AND_DECISIONS.md) writeup by answering the practical review questions up front: what was built, how it was built, which runtime tools and development harnesses were used, what assumptions were filled independently, and where the current trade-offs and limits still are.

## Deliverables

### 1. Source code repository

- Repository URL: [github.com/thisisyoussef/ttb-label-verification](https://github.com/thisisyoussef/ttb-label-verification)
- Source code: `src/client`, `src/server`, `src/shared`, `scripts`, and checked-in docs
- Local setup and run instructions: [README.md](../../README.md)
- Architecture and major engineering choices: [docs/ARCHITECTURE_AND_DECISIONS.md](../ARCHITECTURE_AND_DECISIONS.md)
- Approach, tools, assumptions, trade-offs, and limitations: this document

### 2. Deployed application URL

- Production review URL: [ttb-label-verification-production-f17b.up.railway.app](https://ttb-label-verification-production-f17b.up.railway.app)
- Staging URL: [ttb-label-verification-staging.up.railway.app](https://ttb-label-verification-staging.up.railway.app)
- Verification performed on 2026-04-19:
  - `GET /api/health` returned `status=ok`
  - production and staging both returned the committed prototype shell

## Current Approach

### Product shape

- The prototype is a standalone TTB label-verification workstation, not a COLAs replacement.
- The primary flow is single-label review with optional application-form fields, evidence-rich results, OCR preview, and a post-result refine pass.
- The secondary flow is batch review with CSV plus image intake, preflight validation, queue execution, retry, export, and drill-in review.
- The UI is intentionally reviewer-first: it surfaces evidence, confidence, and review states instead of claiming autonomous compliance approval.

### Engineering shape

- **Frontend:** React 19 + Vite 7 render the workstation, intake/results flows, batch surfaces, help overlay, and prototype auth shell.
- **Backend:** Express 4 handles multipart uploads, extraction orchestration, deterministic validation, batch sessions, and static asset serving.
- **Shared contracts:** Zod-backed contracts in `src/shared/contracts` keep client and server behavior typed end to end.
- **Privacy posture:** uploads, intake values, batch state, and reports are kept in memory only; the OpenAI path is configured with `store: false`; no application database or durable report store is part of the runtime.

### Decision split: AI vs deterministic logic

- **AI handles extraction and visual interpretation only.** The model reads the label, extracts structured fields, estimates warning/layout signals, and returns confidence-bearing evidence.
- **Deterministic code handles compliance outcomes.** Warning validation, field matching, beverage rules, cross-field logic, and recommendation aggregation are implemented in typed server modules.
- **The human reviewer stays in charge.** The UI presents evidence and recommendations; it is not framed as an autonomous approval system.

## Tools Used

### Runtime and application stack

- TypeScript
- React 19
- Vite 7
- Express 4
- Zod 4
- Tesseract OCR
- Sharp and the image-processing utilities used by the warning/OCV pipeline

### AI and extraction tooling

- Gemini extraction adapter for the primary cloud VLM path
- OpenAI Node SDK with the Responses API for the OpenAI extraction path and provider fallback, configured with `store: false`
- Ollama with Qwen2.5-VL for the local or air-gapped extraction path
- Local fixture-backed evals and trace-driven prompt tuning for extractor and resolver behavior

### Development workflow and custom harness

- **Spec-driven delivery:** the repo is organized around a checked-in product blueprint, ordered story index, and per-story packets under `docs/specs/<story-id>/` so implementation, tests, evals, and handoffs are tied to explicit acceptance criteria instead of ad hoc chat memory.
- **Checked-in project control docs:** `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `docs/process/BRANCH_TRACKER.md` act as the workflow control plane for active story state, branch lifecycle, and handoff readiness.
- **Harness memory bank:** `.ai/memory/project/` and `.ai/memory/session/` hold concise architecture, pattern, anti-pattern, technical-debt, active-context, decision, and blocker notes so agent work stays grounded in checked-in repo truth.
- **Custom evaluator harness:** the in-app Toolbench is the built-in reviewer harness for loading known samples, switching single versus batch flows, checking health, and exercising provider-mode variants without manual setup.
- **Trace-driven development:** prompt, model, retry, and routing behavior are tuned through local fixture loops, timing summaries, and checked-in eval artifacts instead of external tracing services.
- **Publish and branch gates:** the repo uses checked-in commit, push, and publish gates plus PR-driven merge flow so deployable changes are validated before they are claimed as reviewable.

### UI design and implementation tooling

- **Claude UI lane:** UI-first stories follow the checked-in lane split, with Claude responsible for initial design direction and Codex responsible for engineering completion and integration.
- **Stitch for UI reference generation:** on stories that explicitly used Stitch, the repo supports automated Stitch runs and manual Comet fallback so UI references can be generated, reviewed, and preserved in the story packet before implementation.
- **Direct packet-driven UI work:** Stitch is not mandatory on every story; the default mode is direct implementation from the approved UI packet, master design, and seeded scenarios.

### Development and quality tooling

- Vitest for unit, contract, and integration coverage
- Stryker for targeted mutation testing on high-risk pure logic
- Checked-in eval manifests and run artifacts under `evals/`
- Codex in this workspace for engineering and documentation work
- Claude for the UI-first design lane where story handoffs call for it

### Deployment and release tooling

- GitHub Actions for CI, staging deploys, and production-promotion workflows
- Railway for hosted staging and production runtime verification

Codex, Claude, and Stitch are development tools only. They are not runtime dependencies and are not part of the deployed verifier stack.

## Assumptions Made

These are the material assumptions the prototype fills independently:

1. **Government warning source text**
   - The assignment referenced a standard warning but did not provide a canonical machine-readable source, so the project relies on researched TTB/CFR language.

2. **Beverage-type-specific checks**
   - Spirits, wine, and beer rules are modeled as researched prototype rules rather than as a full production-grade legal rules engine.

3. **No persistence is a deliberate design choice**
   - Because the prototype may touch sensitive label and application content, the safest proof-of-concept posture is to persist nothing and to keep sessions bounded in memory.

4. **Cloud and local model paths are both acceptable for the prototype**
   - The repo supports cloud extraction and local extraction because the brief and user research suggest deployment posture may vary by environment.

5. **Standalone prototype over direct COLAs integration**
   - The prototype assumes value can be demonstrated without integrating directly into the legacy COLAs stack or agency identity systems.

6. **Recommendations, not decisions**
   - The system assumes reviewers remain responsible for the final compliance call even when every check passes.

7. **Prototype auth is theater, not security**
   - The mock Treasury-style entry and signed-in shell are presentation cues only. No real credentials, tokens, cookies, or server sessions are involved.

8. **The checked-in eval corpus is representative enough to prove direction, not completeness**
   - The current GoldenSet and live core subset are used to evaluate engineering direction and regressions, not to claim exhaustive regulatory coverage.

## Trade-Offs

1. **Trust over automation aggressiveness**
   - The architecture prefers evidence plus deterministic review outcomes over end-to-end model judgment. That reduces false certainty, but it also means more `Needs review` outcomes on hard labels.

2. **Fast first answer over exhaustive first-pass analysis**
   - OCR preview, extraction prefetch, and the post-result refine pass are all designed to make the first screen feel fast. The trade-off is that some borderline cases improve only after the first result has already rendered.

3. **No persistence over auditability**
   - Keeping uploads and results out of storage is the right privacy posture for the prototype, but it limits historical analytics, supervisor replay, and full audit reconstruction.

4. **Provider abstraction over single-provider optimization**
   - Supporting Gemini, OpenAI, and local Ollama/Qwen paths improves deployment flexibility, but it increases prompt, eval, and performance-tuning complexity.

5. **Prototype-safe batch sessions over durable background jobs**
   - Batch mode is fast to inspect and easy to demo, but it is not meant to survive process restarts or act like a production queueing system.

## Limitations

- Same-field-of-vision and placement judgments are still heuristic. The system does not perform true package-geometry verification.
- Boldness, stylization, and low-contrast typography remain model-sensitive and often resolve to `review`.
- The prototype cannot prove physical type-size compliance from a photo alone.
- The encoded rule set is intentionally partial. It covers the key demo surfaces, not the full TTB regulatory universe.
- The production deployment is a working software environment, not a government-accredited hosting posture.
- There is no real authentication, authorization, case-management integration, or durable audit ledger.
- The current eval corpus is useful for regression control and demonstration, but it is not exhaustive enough to justify production claims by itself.

## Core Demo / Eval Labels

The default six-label baseline remains:

1. Perfect spirit label
2. Spirit label with warning errors
3. Spirit label with cosmetic brand mismatch
4. Wine label missing appellation
5. Beer label with forbidden ABV abbreviation
6. Deliberately low-quality image

See [evals/README.md](../../evals/README.md) for the canonical slice definitions and when to use the full golden set versus the live core-six subset.

## Evaluation Criteria Mapping

| Criterion | Current evidence | Open gap / caution |
| --- | --- | --- |
| Correctness and completeness of core requirements | Live review route, warning validator, field comparison/report builder, batch orchestration, and checked-in eval results in `evals/results/` | Final release-gate evidence under `TTB-401` is still open |
| Code quality and organization | Split `src/client`, `src/server`, and `src/shared/contracts`; typed contracts; tests across review, warning, batch, help, and env seams | The README and submission pack needed this baseline because the previous top-level docs were still scaffold-grade |
| Appropriate technical choices for the scope | AI is limited to extraction; deterministic code owns compliance outcomes; no persistence; Railway/GitHub Actions keep deployment simple | Provider-routing hardening (`TTB-206+`) is not complete yet |
| User experience and error handling | Prototype auth shell, guided help, upload validation, retry paths, batch drill-in, review-error contract, fallback help manifest | Final polish and release-gate acceptance still depend on later stories |
| Attention to requirements | `store: false`, in-memory handling, standalone posture, batch support, evidence-rich results, checked-in rules/evals/process docs | Formal final-pack docs and latency proof are not closed yet |
| Creative problem-solving | Warning character diff, replayable help manifest, signed-in shell treatment, session-scoped batch export, evidence-focused recommendation model | Keep these framed as prototype value, not as finished production capabilities |

## Evidence Pointers

- Review contract: [src/shared/contracts/review.ts](../../src/shared/contracts/review.ts)
- Review route and health route: [src/server/index.ts](../../src/server/index.ts)
- OpenAI extraction boundary: [src/server/extractors/openai-review-extractor.ts](../../src/server/extractors/openai-review-extractor.ts)
- Warning validator: [src/server/validators/government-warning-validator.ts](../../src/server/validators/government-warning-validator.ts)
- Recommendation/report builder: [src/server/review/review-report.ts](../../src/server/review/review-report.ts)
- Batch session engine: [src/server/batch/batch-session.ts](../../src/server/batch/batch-session.ts)
- Guided help runtime: [src/client/help-runtime.ts](../../src/client/help-runtime.ts)
- Current eval guidance: [evals/README.md](../../evals/README.md)
- Current release-gate packet: [docs/specs/TTB-401/story-packet.md](../specs/TTB-401/story-packet.md)

## What Still Needs To Close Before Production-Grade Use

- A larger, more authoritative eval corpus across more beverage classes and harder image conditions
- Additional deterministic rule ingestion beyond the current high-signal prototype checks
- A real identity, authorization, and audit story
- Deployment hardening for a government or similarly constrained environment
- More complete latency and failure-characterization evidence across providers and image-quality bands
