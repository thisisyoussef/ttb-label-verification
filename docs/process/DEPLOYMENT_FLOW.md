# Deployment Flow

This file defines how GitHub and Railway fit into the story-completion workflow for this project.

## Goals

- every deployable story lands in a real staging environment
- production is promoted deliberately, not implicitly
- the deploy flow stays compatible with the Claude/Codex lane split
- the workflow works from checked-in state instead of one-off chat instructions

## Deployment model

For this project, use Railway branch-linked environments rather than ad hoc manual deploys.

- GitHub `main` branch -> Railway `staging` environment
- GitHub `production` branch -> Railway `production` environment

Why this model:

- every completed implementation story can reach staging automatically after merge
- production promotion becomes a clean branch promotion, not a one-off dashboard ritual
- Railway can wait for CI before deploying
- the repo stays simple: one app, one service, two long-lived environments

## One-time bootstrap

### 1. Create the GitHub repository

- local script: `scripts/bootstrap-github-repo.sh <owner/repo> [private|public]`
- the script:
  - initializes git if needed
  - creates the GitHub repo with `gh repo create`
  - pushes `main`
  - creates and pushes `production`

### 2. Create the Railway project

In Railway:

1. Create a project for `ttb-label-verification`.
2. Create or keep two persistent environments:
   - `staging`
   - `production`
3. Link the GitHub repo to the Railway service.
4. Set branch mapping:
   - `staging` tracks `main`
   - `production` tracks `production`
5. Enable `Wait for CI` in Railway so deploys happen only after GitHub Actions pass.
6. Use `railway.toml` in repo as the config-as-code source.

### 3. Set Railway variables in both environments

Required in `staging` and `production`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_VISION_MODEL`
- `OPENAI_STORE=false`

Do not store app data, uploads, or results in Railway volumes or attached databases for this proof of concept.

## GitHub workflows

- `.github/workflows/ci.yml`
  - runs tests, typecheck, and build on PRs and on pushes to `main` and `production`
- `.github/workflows/railway-post-deploy.yml`
  - runs after Railway reports a successful GitHub deployment
  - hits `/api/health` on the deployed target URL
- `.github/workflows/promote-production.yml`
  - manual promotion workflow
  - updates the `production` branch to the selected source ref
  - Railway production auto-deploys from that branch

## Story-completion wiring

### After a deployable implementation story is complete

1. Finish the story packet and handoff normally.
2. Merge the story into `main`.
3. Let CI pass.
4. Railway `staging` auto-deploys from `main`.
5. The post-deploy workflow verifies `/api/health`.
6. Include staging deployment status in the final acceptance or deployment note.

### After a docs-only or harness-only story is complete

- CI still runs after merge.
- staging deploy may be skipped if no deployable runtime artifact changed.
- if skipped, say so explicitly in handoff notes instead of implying a deploy happened.

### Production promotion

Production is not automatic per story.

Use production promotion only when:

- a grouped milestone is staging-validated, or
- the release gate story is complete, or
- the user explicitly asks to promote

Promotion path:

1. confirm staging is healthy
2. run `promote-production` GitHub workflow with `source_ref=main` or another validated ref
3. Railway production auto-deploys from `production`
4. verify `/api/health` and the agreed smoke path

## Lane ownership

### Claude

- may mention deployment needs in a Codex handoff
- does not own Railway, GitHub Actions, or production pipeline changes

### Codex

- owns deployment scaffolding, server deployability, CI, and Railway flow docs
- records staging/prod rollout notes in the final handoff when relevant

## Blocking rules

- If the GitHub repo does not exist yet, deployment verification is blocked at the external-bootstrap layer.
- If Railway branch-linked environments are not configured yet, staging/prod deployment steps are blocked at the external-bootstrap layer.
- Do not claim a story is staging-deployed or production-promoted unless the relevant external step actually happened.
