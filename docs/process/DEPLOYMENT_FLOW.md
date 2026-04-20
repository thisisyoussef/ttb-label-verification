# Deployment Flow

This file defines how GitHub and Railway fit into the story-completion workflow for this project.

## Goals

- every completed implementation story can reach staging automatically after merge
- production now follows verified staging automatically by default
- the deploy flow stays compatible with direct story-branch work by either agent
- the workflow works from checked-in state instead of one-off chat instructions

## Deployment model

For this project, use GitHub Actions plus Railway CLI rather than Railway dashboard branch-trigger settings.

- GitHub `main` push -> `ci` workflow -> Railway CLI deploy to `staging`
- successful staging deploy for that `main` SHA -> Railway CLI deploy to `production` -> sync `production` branch
- manual production promotion remains available through `promote-production.yml` for rollback or validated-ref backfill

Why this model:

- it uses the same Railway CLI locally and in GitHub Actions
- it removes manual Railway service-setting drift from the harness
- full CI on `main` remains the hard gate before the automatic staging-to-production release path continues
- the repo still stays simple: one app, one service, two long-lived environments

## Git gates around deploys

- Normal story work happens on story branches, not directly on `main` or `production`.
- Merge reviewed story branches into `main` through their GitHub PRs to trigger staging deploys.
- Do not push directly to `production` for routine work; automatic promotion now follows successful staging deploys, and the checked-in promotion workflow is reserved for rollback or validated-ref backfill.
- Direct ref updates to `main` or `production` that are not associated with merged PRs now fail the GitHub-side CI guard and do not remain on the green deploy path.
- Follow `docs/process/GIT_HYGIENE.md` before any push that is meant to be merged or deployed. The local gate commands for that are `npm run gate:push`, followed by `npm run gate:publish` before any handoff that claims the branch is available on GitHub.

## Live external state

As of 2026-04-13, the checked-in scaffold is backed by live external resources:

- GitHub repo: `thisisyoussef/ttb-label-verification`
- Railway project: `ttb-label-verification` (`a80335ea-ec6b-408f-8e38-81fb157cf993`)
- Railway service: `ttb-label-verification`
- Railway environments:
  - `staging` (`5f215f39-d4b2-4fbd-afcf-bd2d6644e2f9`)
  - `production` (`c0e22572-77d6-424a-84fc-d51d10d3fb8e`)
- Staging URL: `https://ttb-label-verification-staging.up.railway.app`
- Production URL: `https://ttb-label-verification-production-f17b.up.railway.app`
- GitHub Actions secret configured: `RAILWAY_API_TOKEN`

## Local CLI rules

Codex should prefer the locally installed `railway` CLI for bootstrap, status checks, log inspection, manual spot deploys, and environment edits.

Primary commands:

- `railway status --json`
- `railway service status --all`
- `railway logs --service ttb-label-verification --environment staging --lines 100`
- `railway logs --service ttb-label-verification --environment production --lines 100`
- `railway up --ci --verbose --project a80335ea-ec6b-408f-8e38-81fb157cf993 --environment staging --service ttb-label-verification`
- `railway up --ci --verbose --project a80335ea-ec6b-408f-8e38-81fb157cf993 --environment production --service ttb-label-verification`

Local Railway link state is stored in `~/.railway/config.json`. Do not commit that state.

## One-time bootstrap

### 1. Create the GitHub repository

- local script: `scripts/bootstrap/bootstrap-github-repo.sh <owner/repo> [private|public]`
- the script:
  - initializes git if needed
  - creates the GitHub repo with `gh repo create`
  - pushes `main`
  - creates and pushes `production`
  - restores `main` to track `origin/main`

### 2. Create the Railway project

Using the local CLI:

1. `railway init -n ttb-label-verification`
2. `railway add --service ttb-label-verification`
3. `railway environment new staging -d production`
4. `railway link -p <project-id> -e staging`
5. `railway service link ttb-label-verification`
6. `railway domain` while linked to `staging`
7. `railway link -p <project-id> -e production`
8. `railway service link ttb-label-verification`
9. `railway domain` while linked to `production`
10. use `railway.toml` in repo as the config-as-code source

### 3. Set GitHub Actions access to Railway

Set a repository secret using the local Railway account token:

- `gh secret set RAILWAY_API_TOKEN --repo <owner/repo>`

### 4. Set Railway variables in both environments

Required in `staging` and `production`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_VISION_MODEL`
- `OPENAI_STORE=false`

Do not store app data, uploads, or results in Railway volumes or attached databases for this proof of concept.

## GitHub workflows

- `.github/workflows/ci.yml`
  - runs a lightweight `typecheck` plus `test` pass on PRs
  - runs the full release verification set on pushes to `main` and `production`: `typecheck`, `test`, `build`, and golden evals
  - rejects `main` and `production` updates that are not associated with a merged pull request
- `.github/workflows/auto-open-story-prs.yml`
  - opens a ready PR to `main` when a normal story branch is first published and no PR already exists
- `.github/workflows/railway-post-deploy.yml`
  - listens for successful `ci` runs on integration refs, including the explicit `workflow_dispatch` handoff used by the checked-in release automation
  - uses Railway CLI with `RAILWAY_API_TOKEN`
  - deploys `main` to staging
  - after staging health passes, deploys that same SHA to production and then syncs the `production` branch
  - still supports `production` branch deploys for exceptional manual branch-driven releases
  - verifies `/api/health` against the known Railway public domain for that environment
- `.github/workflows/promote-production.yml`
  - manual rollback or validated-ref backfill workflow
  - deploys the selected source ref directly to Railway production
  - verifies `/api/health`
  - syncs the `production` branch only after production verification succeeds

## Story-completion wiring

### After a deployable implementation story is complete

1. Finish the story packet and handoff normally.
2. Push the story branch, run `npm run gate:publish`, and open or update the GitHub PR.
3. If local gates are green and GitHub allows the merge, merge the PR instead of waiting around for PR CI chatter.
4. If GitHub blocks the merge, report the exact blocker.
5. After merge, `ci` runs on `main` and the `railway-deploy` workflow runs `railway up` against `staging`.
6. The deploy workflow verifies `/api/health`.
7. Include staging deployment status in the final acceptance or deployment note.

### After a docs-only or harness-only story is complete

- the lightweight PR CI still runs before merge and the full `main` CI still runs after merge.
- the branch-driven deploy workflow may still run even if runtime code did not change.
- if no runtime artifact changed, say that explicitly in handoff notes instead of implying a meaningful app delta shipped.

### Production promotion

Production now promotes automatically after a successful staging deploy by default.

Use the manual production-promotion workflow only when:

- you need to roll back to an older validated ref, or
- you need to backfill production from a specific validated ref outside the normal `main` release path

Automatic path:

1. merge reviewed story work to `main`
2. `ci` verifies that `main` SHA
3. `railway-deploy` runs `railway up` against `staging`
4. staging `/api/health` must pass
5. the same SHA is deployed to Railway `production`
6. production `/api/health` must pass
7. the workflow syncs the `production` branch to the verified live SHA

Manual path:

1. choose a validated `source_ref`
2. run `promote-production` with that `source_ref`
3. the workflow deploys that exact SHA to Railway `production`
4. production `/api/health` must pass
5. the workflow syncs the `production` branch to the verified live SHA

## Agent responsibility

- Either agent may update deployment scaffolding, CI wiring, or flow docs when the story requires it.
- The agent finishing the story records staging or production rollout notes when relevant.

## Blocking rules

- If `RAILWAY_API_TOKEN` is missing or invalid in GitHub Actions, both automatic and manual production promotion are blocked at the Railway deploy layer.
- If the checked-in project, service, environment, or domain values drift from the live Railway project, update the harness docs and workflows before claiming deploy success.
- Do not run a local production `railway up` unless the user explicitly asks for that direct action.
- Do not claim a story is staging-deployed or production-promoted unless the relevant external step actually happened.
