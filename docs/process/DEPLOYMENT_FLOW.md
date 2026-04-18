# Deployment Flow

This file defines how GitHub and Railway fit into the story-completion workflow for this project.

## Goals

- every completed implementation story can reach staging automatically after merge
- production is promoted deliberately, not implicitly
- the deploy flow stays compatible with direct story-branch work by either agent
- the workflow works from checked-in state instead of one-off chat instructions

## Deployment model

For this project, use GitHub Actions plus Railway CLI rather than Railway dashboard branch-trigger settings.

- GitHub `main` push -> `ci` workflow -> Railway CLI deploy to `staging`
- GitHub `production` push -> `ci` workflow -> Railway CLI deploy to `production`
- production promotion is still explicit and happens by updating the `production` branch through `promote-production.yml`

Why this model:

- it uses the same Railway CLI locally and in GitHub Actions
- it removes manual Railway service-setting drift from the harness
- CI remains the hard gate before staging or production deploys
- the repo still stays simple: one app, one service, two long-lived environments

## Git gates around deploys

- Normal story work happens on story branches, not directly on `main` or `production`.
- Merge reviewed story branches into `main` through their GitHub PRs to trigger staging deploys.
- Do not push directly to `production` for routine work; production promotion stays explicit through the checked-in promotion workflow.
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

- local script: `scripts/bootstrap-github-repo.sh <owner/repo> [private|public]`
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
  - runs tests, typecheck, and build on PRs and on pushes to `main` and `production`
  - rejects `main` and `production` updates that are not associated with a merged pull request
- `.github/workflows/auto-open-story-prs.yml`
  - opens a draft PR to `main` when a normal story branch is first published and no PR already exists
- `.github/workflows/railway-post-deploy.yml`
  - listens for successful `ci` runs triggered by branch pushes
  - uses Railway CLI with `RAILWAY_API_TOKEN`
  - deploys `main` to staging and `production` to production
  - verifies `/api/health` against the known Railway public domain for that environment
- `.github/workflows/promote-production.yml`
  - manual promotion workflow
  - updates the `production` branch to the selected source ref
  - explicitly dispatches `ci` on `production` after updating the branch so the subsequent `railway-deploy` workflow runs even though the branch update came from GitHub Actions

## Story-completion wiring

### After a deployable implementation story is complete

1. Finish the story packet and handoff normally.
2. Merge the story into `main` through its GitHub PR, not by direct ref update.
3. Let CI pass.
4. The `railway-deploy` workflow runs `railway up` against `staging`.
5. The deploy workflow verifies `/api/health`.
6. Include staging deployment status in the final acceptance or deployment note.

### After a docs-only or harness-only story is complete

- CI still runs after merge.
- the branch-driven deploy workflow may still run even if runtime code did not change.
- if no runtime artifact changed, say that explicitly in handoff notes instead of implying a meaningful app delta shipped.

### Production promotion

Production is not automatic per story.

Use production promotion only when:

- a grouped milestone is staging-validated, or
- the release gate story is complete, or
- the user explicitly asks to promote

Promotion path:

1. confirm staging is healthy
2. run `promote-production` GitHub workflow with `source_ref=main` or another validated ref
3. CI runs on the updated `production` branch
4. `railway-deploy` runs `railway up` against `production`
5. verify `/api/health` and the agreed smoke path

## Agent responsibility

- Either agent may update deployment scaffolding, CI wiring, or flow docs when the story requires it.
- The agent finishing the story records staging or production rollout notes when relevant.

## Blocking rules

- If `RAILWAY_API_TOKEN` is missing or invalid in GitHub Actions, deploys are blocked at the CI-to-Railway layer.
- If the checked-in project, service, environment, or domain values drift from the live Railway project, update the harness docs and workflows before claiming deploy success.
- Do not run a local production `railway up` unless the user explicitly asks for that direct action.
- Do not claim a story is staging-deployed or production-promoted unless the relevant external step actually happened.
