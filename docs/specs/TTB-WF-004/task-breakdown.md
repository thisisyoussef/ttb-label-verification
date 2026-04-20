# Task Breakdown

1. Add the workflow story packet and declare the story active in checked-in tracking.
   - Validation: `docs/specs/TTB-WF-004/` exists, `docs/specs/PROJECT_STORY_INDEX.md` lists `TTB-WF-004`, and `docs/process/SINGLE_SOURCE_OF_TRUTH.md` points Codex at this story.

2. Make staging-to-production promotion automatic in the deploy workflow.
   - Validation: `.github/workflows/railway-post-deploy.yml` deploys staging first for successful `main` CI completions, then deploys production from the same SHA only after staging verification passes, and syncs `production` only after production verification passes.

3. Repair the manual promotion workflow so it no longer depends on a second workflow handoff.
   - Validation: `.github/workflows/promote-production.yml` fetches the requested ref, deploys it directly to Railway production, verifies `/api/health`, and syncs `production` after success.

4. Update the checked-in deploy contract.
   - Validation: `docs/process/DEPLOYMENT_FLOW.md` and `docs/specs/FULL_PRODUCT_SPEC.md` describe automatic production promotion after verified staging deploy, with the manual workflow framed as rollback or validated-ref backfill.

5. Refresh durable memory and verify the branch.
   - Validation: the required `.ai/memory/**` files reflect the new deploy truth, and `npm run test`, `npm run typecheck`, and `npm run build` pass.
