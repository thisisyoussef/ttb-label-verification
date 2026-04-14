# TTB Label Verification Prototype

Standalone proof of concept for TTB label verification. The prototype helps reviewers compare a beverage label image against application data, extract structured facts with AI, apply deterministic compliance checks, and keep the final decision with the human reviewer.

## Deliverables

- Source repository: [github.com/thisisyoussef/ttb-label-verification](https://github.com/thisisyoussef/ttb-label-verification)
- Working deployed prototype: [ttb-label-verification-staging.up.railway.app](https://ttb-label-verification-staging.up.railway.app)
  - Verified on April 14, 2026 via `/api/health` and browser load
- Setup, run, approach, tools, assumptions, and evaluation mapping: [docs/reference/submission-baseline.md](docs/reference/submission-baseline.md)

## Current Prototype Scope

The committed prototype currently includes:

- a prototype-safe mock Treasury-style entry and signed-in shell
- single-label upload, extraction, deterministic checks, and evidence-rich results
- batch preflight, run, drill-in, retry, and session export flows
- replayable contextual help driven by a checked-in help manifest
- in-memory processing only for uploads, application data, and results

## Local Setup

Prerequisites:

- Node.js 20+
- npm 10+
- an `OPENAI_API_KEY` available in this repo's `.env` or in the local gauntlet env inventory used by `npm run env:bootstrap`

Install and run:

```bash
npm install
npm run env:bootstrap
npm run dev
```

Local URLs:

- Web: [http://localhost:5176](http://localhost:5176)
- API: [http://localhost:8787](http://localhost:8787)

Useful commands:

```bash
npm run test
npm run typecheck
npm run build
```

## Approach

- **Client:** React 19 + Vite 7 for the reviewer workstation, mock auth shell, batch dashboard, and guided help surfaces.
- **Server:** Express 4 + TypeScript for upload handling, extraction orchestration, deterministic validation, and batch session APIs.
- **Shared contract:** Zod-backed contracts in `src/shared/contracts` define the boundary between UI and API.
- **AI usage:** OpenAI Responses API performs structured extraction only. Requests are sent with `store: false`.
- **Deterministic validation:** Compliance outcomes come from typed validators and report builders, not from the model deciding approval holistically.
- **Privacy posture:** uploads and results stay in memory only; the prototype does not persist label images, application data, or verification output.
- **Deployment:** GitHub Actions plus Railway deploy the app from checked-in state.

## Tools Used

- TypeScript
- React
- Vite
- Express
- Zod
- OpenAI Node SDK
- Vitest
- Stryker
- Railway
- GitHub Actions
- LangSmith (development-only tracing support)

## Assumptions and Limits

Key assumptions made so far:

- the standard government warning text and beverage-specific rules were researched from TTB/CFR source material because the assignment did not provide a complete machine-readable ruleset
- the prototype is intentionally standalone and does not integrate with COLAs Online or other TTB internal systems
- the prototype uses a cloud AI API today; a production version would need a FedRAMP-authorized deployment path
- the tool produces recommendations and evidence, not binding compliance decisions

Current technical limits:

- same-field-of-vision and bold-text judgments are heuristic rather than container-geometry or pixel-measurement proofs
- physical font-size requirements cannot be verified from a single photo without known container dimensions
- the formal Gemini-primary routing and sub-4-second hardening stories are planned but not complete on `main`

The full assumptions register, known gaps, and evaluation mapping live in [docs/reference/submission-baseline.md](docs/reference/submission-baseline.md).

## Evaluation Fit

The project is being documented against these criteria:

- correctness and completeness of core requirements
- code quality and organization
- appropriate technical choices for the scope
- user experience and error handling
- attention to requirements
- creative problem-solving

See [docs/reference/submission-baseline.md](docs/reference/submission-baseline.md) for the current evidence map and open gaps.

## Additional Docs

- [docs/reference/submission-baseline.md](docs/reference/submission-baseline.md)
- [docs/process/DEPLOYMENT_FLOW.md](docs/process/DEPLOYMENT_FLOW.md)
- [docs/process/GIT_HYGIENE.md](docs/process/GIT_HYGIENE.md)
- [docs/specs/FULL_PRODUCT_SPEC.md](docs/specs/FULL_PRODUCT_SPEC.md)
- [evals/README.md](evals/README.md)
