# Technical Plan

## Architecture target

Promote the existing live batch path to the primary runtime and shrink fixtures into an explicitly gated support layer.

## Current batch runtime shape

- `useBatchWorkflow` owns intake, stream, dashboard, preview, fixture selectors, and live orchestration.
- `useBatchDashboardFlow` owns both live dashboard fetch/report fetch and fixture dashboard behavior.
- `batchWorkflowLive` implements real preflight/run/retry integration but is embedded under a state model that still initializes from seed data.

## Planned changes

### 1. Packet and tracker updates

- Add `TTB-302` as a new `TTB-003` leaf story in the story index and tracker.
- Mark it as the active Codex story by explicit user choice.

### 2. Client runtime cleanup

- Refactor `src/client/useBatchWorkflow.ts` so live batch state is the default path.
- Keep fixture selectors and demo seeds only when fixture mode is explicitly enabled.
- Separate state ownership more clearly between:
  - intake/preflight state
  - run/stream state
  - dashboard/drill-in state
  - preview/export support state

### 3. Live dashboard and drill-in hardening

- Reduce fixture branching in `src/client/useBatchDashboardFlow.ts`.
- Keep report fetch, summary fetch, retry, and export behavior centered on session-backed responses in live mode.

### 4. Contract and route hardening

- Verify the batch route contracts still fully support the approved UI and the simplified state model.
- Add or tighten route-level tests where live behavior was previously only implied by seeds.

### 5. Batch failure-path polish

- Tighten error propagation for preflight, stream start, dashboard load, retry, and export.
- Ensure error copy remains reviewer-oriented and explicit.

## Blast radius

### Direct files

- `src/client/useBatchWorkflow.ts`
- `src/client/batchWorkflowLive.ts`
- `src/client/useBatchDashboardFlow.ts`
- `src/client/appBatchPreflight.ts`
- `src/client/AppShell.tsx`
- `src/client/batch-runtime.ts`
- `src/server/routes/register-batch-routes.ts`
- `src/server/batch/batch-session.ts`
- `src/server/batch/batch-routes.test.ts`
- `src/shared/contracts/review-batch.ts`

### Dependent surfaces

- `src/shared/contracts/help.ts`
- `src/shared/help-fixture.ts`
- `src/server/routes/help-routes.test.ts`
- batch-related `data-tour-target` anchors in `src/client/AppShell.tsx`
- batch packet and handoff docs:
  - `docs/specs/TTB-103/**`
  - `docs/specs/TTB-104/**`
  - `docs/specs/TTB-301/**`
  - `docs/backlog/codex-handoffs/TTB-103.md`
  - `docs/backlog/codex-handoffs/TTB-104.md`

## Test strategy

- RED first at the smallest viable layers:
  - client runtime tests for live-first branching behavior
  - route/contract tests for summary/report/retry/export behavior
  - focused batch server tests for failure and partial states
- Use contract tests where shared batch payloads are reshaped or relied on more heavily.
- If pure batch helper logic changes materially, consider targeted mutation coverage or record a waiver if the existing Stryker noise outweighs signal.

## Manual verification target

- One full live batch run from intake to export.
- One non-happy-path branch:
  - cancelled batch
  - retry after error
  - dashboard or export load failure

## Risks

1. Refactoring the client state model without unintentionally changing the approved UI behavior.
2. Leaving fixture data coupled tightly enough that the runtime still feels fake after the refactor.
3. Changing batch views without updating help dependencies or story docs.
