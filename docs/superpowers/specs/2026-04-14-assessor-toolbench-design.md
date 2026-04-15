# Assessor Toolbench — Design Spec

## Overview

A floating action button (FAB) in the bottom-right corner that expands into a tabbed card panel, consolidating all developer/assessor aids into one discoverable surface. Replaces the existing `ScenarioPicker` dropdown and scattered fixture controls in the header.

**Why:** The entire application is a take-home assessment artifact. The assessor is the primary user. A built-in toolbench removes friction, lets the evaluator exercise every edge case, and demonstrates product thinking.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visibility | Always visible | No env var gating — the whole app exists for evaluation |
| Replaces | ScenarioPicker + fixture controls | Single entry point, cleaner header |
| Panel style | Expanding card from FAB | Product-like, non-intrusive, doesn't shift layout |
| Internal layout | 3 tabs | Organized without being overwhelming |
| Asset interaction | Drag-and-drop + click-to-load | Drag shows real DropZone UX; click is faster for speed |
| Walkthrough style | Scenario launchers | Quick-launch buttons, not a guided tour (help tour already exists) |

## Component: FAB

- **Position:** Fixed, bottom-right corner (16px inset)
- **Appearance:** Small pill button with icon (beaker/wrench) + "Toolbench" label
- **Visual treatment:** Slightly different surface color or dashed outline to distinguish it from product UI — signals "this is meta"
- **Z-index:** Above app content, below modals/toasts
- **Interaction:** Click to toggle panel. Focusable, activates on Enter/Space.

## Component: Expanded Panel

- **Size:** ~400px wide, ~520px tall
- **Anchor:** Bottom-right, grows upward and leftward from the FAB position
- **Dismiss:** Click X, click FAB again, or press Escape
- **Tabs:** Scenarios | Assets | Quick Actions
- **Persistence:** Open/closed state and active tab stored in `sessionStorage` (survives refresh, not across sessions)

## Tab 1: Scenarios

Two groups with launcher buttons.

### Single Review

| Scenario | What it demonstrates |
|----------|---------------------|
| Perfect Spirit Label | Happy path baseline (distilled spirits) |
| Warning Text Defects | Government warning text errors |
| Brand Case Mismatch | Applicant vs label casing difference |
| Missing Appellation | Wine with blank appellation field |
| Forbidden ABV Format | Beer labeled "ABV" instead of "Alc./Vol." |
| Low Quality Image | OCR confidence / low-quality extraction |
| Blank | Empty form starting state |

Clicking a button loads the scenario into single review mode via the existing state management (`setSeedScenario`-equivalent functions).

### Batch

| Scenario | What it demonstrates |
|----------|---------------------|
| Clean Six | All 6 matched, no errors |
| Mixed Blockers | Ambiguous matches, unmatched items |
| File Errors | Oversized, unsupported, duplicate files |
| Empty | No files at all |
| Images Only | Images without CSV |
| CSV Only | CSV without images |
| CSV Parse Error | Malformed CSV |
| Over Cap | Exceeds 50-image limit |

Clicking loads the batch scenario into batch mode via existing `loadSeedBatch`-equivalent functions.

## Tab 2: Assets

### Label Images

Thumbnail grid (3 columns) of all 16 eval label PNGs from `evals/labels/assets/`.

Each thumbnail shows:
- Small image preview
- Short descriptive name (e.g., "Perfect Spirit", "Warning Errors")
- **Draggable** — drag onto the app's DropZone components
- **Click-to-load** — small icon button overlay that programmatically injects the file

### CSV Files

Below the image grid. Two bundled test CSVs:
- Clean 6-row manifest
- Malformed CSV (parse error)

Same drag + click-to-load interaction.

### Drag Mechanics

The HTML5 Drag API does not allow setting `dataTransfer.files` programmatically. The approach:

1. On drag start: set a custom MIME type (e.g., `application/x-toolbench-asset`) with the asset ID in `dataTransfer.setData()`
2. The DropZone component is extended to recognize this custom type in its `onDrop` handler — when detected, it fetches the asset URL → creates a `Blob` → constructs a `File` → feeds it through the existing file-handling pipeline
3. DropZone highlights as a valid target during drag (existing `onDragOver` behavior, extended to accept the custom type)
4. Click-to-load skips drag entirely: fetches the asset, constructs the `File`, and calls the DropZone's file handler directly via a shared callback/ref

This means `DropZone.tsx` gets a small addition (custom MIME type recognition in `onDrop`) — the only change to an existing component.

## Tab 3: Quick Actions

| Action | Behavior |
|--------|----------|
| Reset App | Clears state, returns to intake |
| Switch to Single / Batch | Mode toggle |
| Toggle Extraction Mode | Cloud vs local |
| View API Health | Pings `/api/health`, shows response inline |
| Open Help Tour | Launches existing guided help tour |

## Removals

### Removed
- `ScenarioPicker.tsx` — functionality moves to Scenarios tab
- Fixture control toggles in header (force failure, variant override)
- `fixtureControlsEnabled()` gate and `VITE_ENABLE_DEV_FIXTURES` env var dependency
- Header bar space occupied by dev dropdowns

### Unchanged
- Help tour system (`HelpLauncher`, `GuidedTourSpotlight`, etc.) — toolbench provides another entry point
- Scenario/fixture data files (`scenarios.ts`, `batchScenarios.ts`, etc.) — toolbench consumes these
- State hooks (`useSingleReviewFlow`, `useBatchWorkflow`) — toolbench calls into them
- `DropZone` component — already handles File drops

## Static Asset Bundling

- Copy the 16 eval label PNGs into `public/toolbench/labels/` for Vite static serving
- Add 2 sample CSV files to `public/toolbench/csv/` (clean + malformed)
- `toolbench-manifest.ts` catalogs all assets with metadata (name, description, filename, type, target)

## File Structure

```
src/client/
├── toolbench/
│   ├── AssessorToolbench.tsx        # FAB + card shell, tab switching
│   ├── ToolbenchScenarios.tsx       # Tab 1: single + batch launchers
│   ├── ToolbenchAssets.tsx          # Tab 2: draggable image grid + CSV section
│   ├── ToolbenchActions.tsx         # Tab 3: quick action buttons
│   ├── ToolbenchAssetThumbnail.tsx  # Draggable/clickable asset card
│   ├── useToolbenchDrag.ts          # Hook: fetch blob → File, drag transfer
│   ├── useToolbenchState.ts         # Hook: open/close, active tab, sessionStorage
│   └── toolbench-manifest.ts        # Asset catalog with metadata
public/
├── toolbench/
│   ├── labels/                      # 16 eval label PNGs
│   └── csv/                         # 2 sample CSVs
```

## Integration Points

- **`App.tsx`** — render `<AssessorToolbench />` at root level, pass scenario-loading and mode-switching callbacks
- **`AppShell.tsx`** — remove ScenarioPicker dropdown and fixture controls from header
- **`DropZone.tsx`** — small addition: recognize custom `application/x-toolbench-asset` MIME type in `onDrop` to support drag from toolbench panel

## Keyboard & Accessibility

- Escape closes the panel
- Tab cycles through panel controls
- FAB is focusable, activates on Enter/Space
- Tab buttons use `role="tab"` / `role="tabpanel"` pattern
- Asset thumbnails have descriptive `aria-label` values
- Drag handles announce draggable state to screen readers

## Design Constraints

- No file stays above 300 lines (soft cap)
- One responsibility per component
- No barrel files — direct imports
- Follows existing tailwind theme tokens (surface colors, typography, radii)
- FAB visual treatment distinguishes it from product UI
