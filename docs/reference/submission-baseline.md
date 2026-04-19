# Submission Baseline

Last updated: 2026-04-14

This document records the deliverables, approach, tools, assumptions, and evaluation framing for the prototype as it exists today. It is intentionally grounded in checked-in code, live deployment checks, and checked-in eval artifacts instead of wishful roadmap claims.

## Deliverables

### 1. Source code repository

- Repository URL: [github.com/thisisyoussef/ttb-label-verification](https://github.com/thisisyoussef/ttb-label-verification)
- Source code: `src/client`, `src/server`, `src/shared`, `scripts`, and checked-in docs
- Local setup and run instructions: [README.md](../../README.md)
- Approach, tools, assumptions, and evaluation mapping: this document

### 2. Deployed application URL

- Working prototype URL: [ttb-label-verification-staging.up.railway.app](https://ttb-label-verification-staging.up.railway.app)
- Verification performed on 2026-04-14:
  - `GET /api/health` returned `status=ok`
  - browser load returned the committed prototype shell

Use staging as the external review URL for now. The repo and Railway docs also track a production environment, but the current submission-oriented public prototype URL is staging.

## What Is Implemented So Far

- Prototype-safe mock Treasury-style entry with signed-in shell identity treatment
- Single-label review flow:
  - image upload
  - optional application-field intake or Toolbench-loaded real COLA samples
  - cloud extraction with typed provider adapters
  - deterministic government warning, field comparison, beverage, and cross-field checks
  - evidence-rich results
- Batch flow:
  - batch preflight
  - batch run stream
  - dashboard summary
  - drill-in review
  - retry
  - JSON export
- Replayable contextual help:
  - remote help manifest endpoint
  - local fallback manifest
  - client replay state
- Evaluation harness:
  - Toolbench sample loader
  - COLA Cloud API fetch path
  - checked-in golden-set and live-subset docs under `evals/`
- Deployment and workflow baseline:
  - GitHub-hosted source repo
  - Railway deployment wiring
  - checked-in git hygiene, hooks, publish gate, and rebase-only mainline policy

## Approach

### Architecture

- **Frontend:** React 19 + Vite 7 render the workstation, intake/results flows, batch surfaces, help overlay, and prototype auth shell.
- **Backend:** Express 4 handles multipart uploads, extraction orchestration, deterministic validation, batch sessions, and static serving for built assets.
- **Shared contracts:** Zod-backed types in `src/shared/contracts` define the client/server seam and keep the payloads typed end to end.

### Decision split: AI vs deterministic logic

- **AI handles extraction only.** The model reads the image, extracts structured fields, estimates warning visual signals, and reports confidence.
- **Deterministic code handles compliance outcomes.** Warning validation, field matching, beverage rules, cross-field logic, and recommendation aggregation are implemented in typed server modules.
- **The human reviewer stays in charge.** The UI presents evidence and recommendations; it is not framed as an autonomous approval system.

### Privacy and runtime posture

- Uploads, application data, batch sessions, and reports stay in memory for the lifetime of the request/session only.
- The OpenAI Responses API is configured with `store: false`.
- Trace instrumentation is development-only and off by default.

## Tools Used

- TypeScript
- React 19
- Vite 7
- Express 4
- Zod 4
- Gemini and OpenAI provider adapters with typed extraction contracts
- OpenAI Node SDK / Responses API with `store: false`
- Tesseract OCR
- Vitest
- Stryker
- Railway
- GitHub Actions
- Local fixture-backed trace/eval tuning (development-only)

## Assumptions Made

These are the material gaps we filled independently and should keep documenting as part of the submission:

1. **Government warning source text**
   - The assignment referenced a standard warning but did not provide a canonical machine-readable source, so the project relies on researched TTB/CFR language.

2. **Beverage-type-specific checks**
   - Spirits, wine, and beer rules are modeled as researched prototype rules rather than as a full production-grade legal rules engine.

3. **No persistence is a deliberate design choice**
   - Because the prototype may touch sensitive label/application content, the safest prototype posture is to persist nothing.

4. **Cloud AI is acceptable for the prototype**
   - The current build uses a cloud extraction path as the best-evidenced reviewer workflow, with the assumption that a government deployment may require a stricter restricted-network posture later.

5. **Standalone prototype over direct COLAs integration**
   - The prototype assumes value can be demonstrated without integrating into the legacy COLAs stack.

6. **Recommendations, not decisions**
   - The system assumes reviewers remain responsible for the final compliance call even when every check passes.

7. **Prototype auth is theater, not security**
   - The mock Treasury-style entry and signed-in shell are presentation cues only. No real credentials, tokens, cookies, or server sessions are involved.

## Trade-Offs and Known Limitations

- Same-field-of-vision judgments are simplified heuristics, not true container-layout verification.
- Bold-text assessment relies on AI interpretation and confidence, not pixel-level typography analysis.
- The prototype cannot prove physical type-size compliance from a photo alone.
- Batch processing is a prototype flow with a bounded session model, not a durable long-running job system.
- The cloud path is stronger and better benchmarked than the restricted-network/local posture.
- Restricted-network/local operation exists because government firewall and no-egress constraints are real, but it should be presented as a constrained operating mode rather than the default demonstrated path.

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
- Provider-backed extraction seams: [src/server/review-extractor-factory.ts](../../src/server/review-extractor-factory.ts)
- Warning validator: [src/server/government-warning-validator.ts](../../src/server/government-warning-validator.ts)
- Recommendation/report builder: [src/server/review-report.ts](../../src/server/review-report.ts)
- Batch session engine: [src/server/batch-session.ts](../../src/server/batch-session.ts)
- Guided help runtime: [src/client/help-runtime.ts](../../src/client/help-runtime.ts)
- Current eval guidance: [evals/README.md](../../evals/README.md)
- Architecture and tradeoffs: [docs/ARCHITECTURE_AND_DECISIONS.md](../ARCHITECTURE_AND_DECISIONS.md)
- Benchmark evidence: [docs/EVAL_RESULTS.md](../EVAL_RESULTS.md)
- Current release-gate packet: [docs/specs/TTB-401/story-packet.md](../specs/TTB-401/story-packet.md)

## What Still Needs To Close Before Final Submission

- Final privacy re-verification against the finished system
- Final latency measurement against the active target
- Final endpoint-aware eval / trace evidence after the provider-routing stories land
- README and submission notes refreshed one more time against the actual final shipped build
