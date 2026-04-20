# Feature Spec

## Story

- Story ID: `TTB-WF-004`
- Title: automatic production promotion after verified staging deploy

## Problem statement

The current production promotion flow relies on two fragile handoffs:

1. a workflow pushes the `production` branch with `GITHUB_TOKEN`
2. a separately dispatched `ci` run on `production` is expected to trigger a later `workflow_run` deploy

The first handoff is explicitly constrained by GitHub's `GITHUB_TOKEN` recursion rules, and the second handoff did not reliably materialize in this repo during the April 19-20, 2026 promotion attempt. The result is that `production` branch state and live Railway production state can drift apart.

## Outcomes

- A successful `main` CI completion still deploys staging first.
- Once staging is deployed and its healthcheck passes, the same SHA is automatically deployed to Railway production.
- The `production` branch is updated only after the production healthcheck passes, so the branch remains a truthful record of the live production commit.
- Manual production promotion remains available as a rollback or backfill path for a validated source ref, but it no longer depends on a downstream workflow chain that can stall.
- The checked-in deployment docs describe the new default behavior accurately.

## Acceptance criteria

1. A successful `ci` run for `main` still triggers Railway staging deploy first.
2. Production deployment is attempted automatically only after staging deploy and staging `/api/health` verification succeed for that same SHA.
3. The automatic production deploy uses the same Git commit SHA that was verified by `ci` and deployed to staging.
4. The automation updates the `production` branch only after production `/api/health` verification succeeds, so the branch does not get ahead of the live environment on a failed release.
5. The manual `promote-production.yml` workflow can still promote a validated source ref directly to Railway production and sync the `production` branch without depending on a later `workflow_run` handoff.
6. The checked-in deploy docs, workflow index, and tracker docs describe automatic staging-to-production promotion as the new default path.
7. No application runtime code, API contracts, validators, or UI behavior change as part of this story.

## Edge cases

- If staging deploy fails or staging healthcheck fails, production must not be touched.
- If production deploy or production healthcheck fails, the `production` branch must remain at the last known good live SHA.
- Manual rollback to an older validated ref must still be possible without pushing directly from a local shell into `production`.
- Existing direct human pushes to `production` should remain documented as exceptional and should not become the normal deploy path again.

## Out of scope

- Changing Railway services, domains, or environments
- Adding new infrastructure providers
- Changing application code, API behavior, or evaluator UX
