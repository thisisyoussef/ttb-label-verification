# Technical Plan

## Scope

Clean up the highest-complexity source files by extracting focused helpers and section components that follow patterns already present in the repo, then add a source-size guard that blocks new line-count debt while freezing inherited oversized files at checked-in allowances.

## Implemented modules and files

- `src/client/Intake.tsx` now delegates field-group and input rendering to `src/client/IntakeFormControls.tsx`
- `src/client/AuthScreen.tsx` now delegates the government banner and phase-specific card rendering to `src/client/AuthScreenGovernmentBanner.tsx`, `src/client/AuthScreenCardBody.tsx`, and `src/client/AuthScreenPrimitives.tsx`
- `src/client/DropZone.tsx` and `src/client/BatchUploadDropZones.tsx` now share picker/drag state through `src/client/useFileDropInput.ts`
- `src/client/help-tour-runtime.ts` now delegates types, actions, and deterministic demo recovery to `src/client/help-tour-types.ts`, `src/client/help-tour-actions.ts`, and `src/client/help-tour-demo.ts`
- `src/client/GuidedTourSpotlight.tsx` now delegates spotlight targeting and callout rendering to `src/client/useGuidedTourSpotlightTarget.ts` and `src/client/GuidedTourCallout.tsx`
- `src/client/useSingleReviewFlow.ts` now delegates async request lifecycle and export shaping to `src/client/useSingleReviewPipeline.ts` and `src/client/single-review-export.ts`
- `src/client/useBatchWorkflow.ts` now delegates live run/preflight/retry behavior to `src/client/batchWorkflowLive.ts`
- `src/server/batch-session.ts` now delegates preflight/session construction and assignment resolution to `src/server/batch-session-preflight.ts` and `src/server/batch-session-assignments.ts`
- `src/server/index.ts` now delegates route wiring to `src/server/register-app-routes.ts`, `src/server/register-review-routes.ts`, and `src/server/register-batch-routes.ts`
- `scripts/check-source-size.ts` classifies warnings, new violations, baseline regressions, and baseline candidates for runtime/tooling files
- `scripts/check-source-size-lib.ts` centralizes source-size classification logic
- `scripts/check-source-size-lib.test.ts` covers inherited-baseline, regression, and new-violation behavior
- `scripts/source-size-baseline.json` freezes inherited oversized files at checked-in allowances until follow-up cleanup lands
- `scripts/git-story-gate.ts` and `package.json` wire the guard into `npm run gate:commit` and `npm run gate:push`

## Measured outcomes

- `src/client/Intake.tsx`: `438 -> 282`
- `src/client/AuthScreen.tsx`: `479 -> 103`
- `src/client/GuidedTourSpotlight.tsx`: `458 -> 141`
- `src/client/help-tour-runtime.ts`: `395 -> 250`
- `src/client/useSingleReviewFlow.ts`: `478 -> 283`
- `src/client/useBatchWorkflow.ts`: `482 -> 344`
- `src/server/batch-session.ts`: `496 -> 353`
- `src/server/index.ts`: `443 -> 133`
- `npm run guard:source-size` now passes with no new violations or baseline regressions over 500 lines
- 2026-04-19 baseline refresh removed entries that are back under the cap and raised `src/server/llm-trace.ts` to its current checked-in allowance (`595`)

## Dependency boundaries

- Keep UI components free of domain validation and transport normalization.
- Keep orchestration roots focused on sequencing and delegate pure transforms or repeated interactions to helpers.
- Prefer direct imports over new barrels.
- Keep new helpers colocated in the existing flat `src/client` / `src/server` structure.

## Risks and fallback

- Risk: large-scale file moves can obscure the behavioral diff.
- Mitigation: prefer extracting pure helpers or subcomponents first, then trimming the parent module.
- Risk: the current user worktree is dirty and on another story.
- Mitigation: complete this work only in the isolated `TTB-WF-002` branch/worktree.

## Testing strategy

- Run the existing repo validation set: `npm run test`, `npm run typecheck`, `npm run build`
- Add or update focused tests only where the extraction creates a new pure helper or would otherwise leave an unprotected seam
- Run the new line-count guard directly as part of verification
- Treat this as a refactor story: preserve behavior and let the current tests prove the external contract did not drift
