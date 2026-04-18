# src/client

The React 19 reviewer UI. The single-label review surface (Results, VerdictBanner, FieldRow, reviewDisplayAdapter) lives at the top level where it's most visible; four domain clusters are grouped into subfolders.

See [`../../README.md`](../../README.md) for the product context and [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) for the full directory map.

## Subfolders

| Folder | What lives here |
|---|---|
| [`auth/`](auth/) | `AuthScreen*`, session timeout, client-only auth state — no tokens are persisted anywhere. |
| [`batch/`](batch/) | Batch mode: dashboard, upload + matching, drill-in shell, live streaming, scenario fixtures. |
| [`eval/`](eval/) | `EvalDemo` surface — recorded-corpus walkthrough for onboarding demos. |
| [`tour/`](tour/) | First-run guided tour + help-tour orchestration. |
| [`toolbench/`](toolbench/) | Internal diagnostics UI. |

## Flat files (by area)

### App shell + routing

| File | Purpose |
|---|---|
| `main.tsx` | ReactDOM entrypoint |
| `App.tsx` | Top-level routing: auth → intake → processing → results, plus `/toolbench` + `/eval` routes |
| `AppShell.tsx` | Persistent chrome around the per-view content |
| `BackBreadcrumb.tsx` | Back nav affordance |
| `appReviewApi.ts` | Client fetchers for `/api/review/*` endpoints |
| `appSingleState.ts` | Reducer for the single-label review flow |
| `appTypes.ts` | `Mode`, `View`, and other app-level unions |
| `types.ts` | Re-exports of shared contract types for the client |
| `useAppToolbench.ts` | Toolbench route bridge |
| `toolbenchRouteState.ts` | Toolbench route parser |
| `providerOverride.ts` | Optional header to pin provider per request (dev tool) |

### Single-label review surface (post-submit)

This is the reviewer's primary screen. `reviewDisplayAdapter.ts` is the single seam that translates engine-level `{approve, review, reject}` into user-facing copy.

| File | Purpose |
|---|---|
| `Results.tsx` | Orchestrates the post-submit screen (banner + rows + evidence + actions) |
| `VerdictBanner.tsx` | Top-of-page verdict with skin + copy (approve / review / recommend-reject) |
| `FieldRow.tsx` | Per-check row with application / label / badge / evidence affordance |
| `FieldEvidence.tsx` | Expandable evidence panel shown when a row is opened |
| `StatusBadge.tsx` | Per-row pass / review / info pill |
| `CrossFieldChecks.tsx` | Cross-field check list (varietal totals, spirits co-location) |
| `ResultsPinnedColumn.tsx` | Left-column pinned label image + metadata |
| `StandaloneBanner.tsx` | Banner shown when a run has no application data |
| `NoTextState.tsx` | Surface shown when no label content could be read |
| `WarningDiff.tsx` | Visual diff of extracted vs canonical warning text |
| `WarningEvidence.tsx` | Per-sub-check evidence for the government warning |
| `ImagePreviewOverlay.tsx` | Fullscreen preview for the label image |
| `LabelImageGallery.tsx` | Thumbnail strip for multi-image submissions |
| `ConfidenceMeter.tsx` | Small "signal strength" visualization (toolbench only) |

### User-facing copy adapter

| File | Purpose |
|---|---|
| `reviewDisplayAdapter.ts` | Engine verdict → display verdict. Rewrites "reject / fail" into reviewer-friendly copy; adds the soft `recommend-reject` state for obviously-not-a-label images. |
| `reviewFailureMessage.ts` | Structured failure message copy |

### Client-side pipeline driver

| File | Purpose |
|---|---|
| `review-runtime.ts` | Review-run orchestrator (streams, merges, retries) |
| `useStreamingReview.ts` | SSE frame consumer hook |
| `useSingleReviewPipeline.ts` | Hook that wires review-runtime to the app state |
| `useSingleReviewFlow.ts` | Top-level flow glue (auth → intake → processing → results) |
| `useRefineReview.ts` | Row-level refine ("take another look") hook |
| `useExtractionPrefetch.ts`, `useSpeculativePrefetch.ts`, `useOcrPreview.ts` | Prefetch + preview hooks |
| `singleReviewFlowSupport.ts` | Flow helper functions |
| `mergeRefinedReport.ts` | Merge refined row results back into the active report |
| `reviewPipelineEvents.ts`, `reviewPipelineReducer.ts` | Pipeline-event state machine |
| `review-observability.ts` | Client-side telemetry hook |
| `single-review-export.ts` | Export the active report as JSON / text |

### Intake form

| File | Purpose |
|---|---|
| `Intake.tsx` | The pre-submit form |
| `IntakeFormControls.tsx` | Individual field controls used by Intake |
| `BeverageTypeField.tsx` | Auto-detect / distilled-spirits / wine / malt-beverage picker |
| `VarietalsTable.tsx` | Editable varietal table for wine submissions |
| `PasteFromJson.tsx` | "Paste an application JSON" dev affordance |
| `DropZone.tsx` | Drag-and-drop label image uploader |
| `useFileDropInput.ts` | Drop-zone behavior hook |
| `ExtractionModeSelector.tsx` | `cloud / local / auto` picker (dev / toolbench) |
| `WelcomePrompt.tsx` | First-run welcome |

### Processing / in-flight view

| File | Purpose |
|---|---|
| `Processing.tsx`, `ProcessingViews.tsx` | Stage-by-stage progress between submit and Results |
| `useElapsed.ts` | Elapsed-time hook for processing views |

### Help system

| File | Purpose |
|---|---|
| `HelpLauncher.tsx` | Help drawer entry button |
| `HelpTooltip.tsx` | Inline hover / focus tooltip |
| `InfoAnchor.tsx` | `(i)` info anchor embeddable in copy |
| `help-runtime.ts` | Help-manifest fetch + scenario resolution |
| `helpManifest.ts` | Static help-manifest loader |
| `helpReplayState.ts` | Replay-tour state persistence (sessionStorage) |
| `useHint.ts` | Dismissable-hint hook |

### Scenario / demo fixtures

| File | Purpose |
|---|---|
| `scenarios.ts` | Seed scenarios for demos |
| `scenarioImageLoader.ts` | Loader for scenario label images |
| `resultScenarios.ts` | Scenario → `VerificationReport` mapping |
| `resultScenarioPrimaryReports.ts`, `resultScenarioSecondaryReports.ts`, `resultScenarioShared.ts` | Scenario report fixtures |
| `labelThumbnail.ts` | Client-side thumbnail builder |

### Shared UI primitives

| File | Purpose |
|---|---|
| `useReducedMotion.ts` | Media-query hook |

## Suggested reading order

1. `App.tsx` + `AppShell.tsx` — the top-level routing + chrome
2. `Results.tsx` — the reviewer's primary post-submit surface
3. `reviewDisplayAdapter.ts` — the single seam for engine-verdict → user-facing copy
4. `review-runtime.ts` + `useStreamingReview.ts` — how the client drives the pipeline
5. `batch/BatchDashboard.tsx` — the batch mode entry
