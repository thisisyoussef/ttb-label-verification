# TTB Label Verification

Standalone scaffold for the TTB label verification proof of concept. This repo starts with a contract-first split:

- `src/client` for the review UI shell
- `src/server` for the verification API and OpenAI orchestration
- `src/shared/contracts` for the typed boundary both sides share
- `AGENTS.md`, `CLAUDE.md`, and `.ai/` for the Codex/Claude harness

## Quickstart

```bash
npm install
npm run dev
```

Web: `http://localhost:5176`
API: `http://localhost:8787`

## Guardrails

- No uploaded label data, application data, or results may be persisted.
- OpenAI calls must use the Responses API with `store: false`.
- AI extraction is advisory; compliance decisions come from deterministic validators.
- Low-confidence spatial/visual judgments default to `review`, not `pass`.

## Deployment

- Repo bootstrap: `scripts/bootstrap-github-repo.sh <owner/repo> [private|public]`
- CI: `.github/workflows/ci.yml`
- Railway config: `railway.toml`
- Deployment flow: `docs/process/DEPLOYMENT_FLOW.md`
- Intended branch mapping:
  - `main` -> Railway `staging`
  - `production` -> Railway `production`
