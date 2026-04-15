# UX Polish & Error Handling Pass

**Date**: 2026-04-14
**Scope**: Surgical polish across failure states, edge cases, prototype rough edges, accessibility, responsiveness, copy tone, contextual hints, empty-state redesign, and a manual QA walkthrough.
**Lane**: Claude (UI only — `src/client/**`)
**Skipped**: Auth screen copy changes (item 1 of Approach A)

---

## 1. Actionable Failure States

Every failure state must answer: *What happened? What can I do? Was anything lost?*

### 1a. Processing failure panel (`Processing.tsx`)

**Current**: Heading "We couldn't finish this review" + step-specific message from `reviewFailureMessage.ts`.

**Change**: Add a one-line cause category between the heading and the step-specific message. Derive from the error message content:

| Pattern in `failureMessage` | Cause label |
|-----------------------------|-------------|
| Contains "connection" | "This looks like a connection issue." |
| Contains "timeout" or "took too long" | "The request timed out." |
| Default | "Something went wrong on our end." |

The existing step-specific copy and persistence reassurance remain unchanged below it. Implementation: a `classifyCause(message: string): string` helper in `reviewFailureMessage.ts`.

### 1b. Batch CSV parse errors (`BatchUploadPanels.tsx`, `appBatchPreflight.ts`)

**Current**: Generic "Invalid CSV" message.

**Change**: Surface up to 3 specific issues with row numbers. Truncate with "and N more issues" if more than 3. Example:

```
Row 4: missing "brandName" column
Row 12: empty class type
and 3 more issues
```

Implementation: extend `BatchFileError` in `batchTypes.ts` to carry an optional `details: string[]` array. `appBatchPreflight.ts` populates it during CSV validation. `FileErrorList` renders the first 3 entries.

### 1c. Batch stream item error message (`BatchProcessingSections.tsx`)

**Current**: Shows "Error" badge but no explanatory text on stream items that failed.

**Change**: If `item.errorMessage` is present, render it as a single line below the filename in the stream row. If absent, show "Could not process this label — retry or skip."

### 1d. Export disabled tooltip (`Results.tsx`)

**Current**: "Export is not yet available."

**Change**: "Complete a review first to export results."

### 1e. DropZone error auto-clear (`DropZone.tsx`)

**Current**: Error message persists until a successful file upload.

**Change**: Auto-clear the error when:
- User clicks the drop zone again (opens file picker)
- User starts a new drag-over event
- Keep the error visible until one of these interactions — no dismiss button needed, just clear on re-engagement.

Implementation: call `setError(null)` at the top of `openPicker` and inside the `onDragOver` handler.

---

## 2. Edge Case Polish

### 2a. Slow upload indicator (`DropZone.tsx`)

For files >2 MB, show a brief "Uploading..." state with a subtle indeterminate progress bar between the drop and the accepted-image display. For files <2 MB, keep the current instant transition.

Implementation: add an `'uploading'` intermediate state to DropZone. The upload is local (no network) so the state is brief — but it provides visual feedback that the file was accepted before the preview renders. Use `requestAnimationFrame` to ensure the preview URL is ready before transitioning.

### 2b. Elapsed time on processing (`Processing.tsx`)

Add an elapsed seconds counter below the step list: "12s elapsed" in muted label text. Starts when processing begins, stops when phase leaves `'running'`. Uses a 1-second interval. Does not show during `'failed'` or `'done'` phases.

Implementation: a `useElapsed(active: boolean)` hook returning seconds. Render below the `<ol>` step list.

### 2c. Empty batch dashboard after filter (`BatchDashboardControls.tsx`)

**Current**: "No items match your current filter."

**Change**: Add a "Clear filters" text button below the message. Clicking it resets all active filters.

### 2d. Warning diff tall-text cap (`WarningDiff.tsx`)

Cap the diff display at 8 visible lines (~200px). If content exceeds this, show a "Show full text" toggle. Already-expanded panels stay expanded. Collapsing re-applies the cap.

Implementation: measure content height on mount/resize with a `useRef` + `ResizeObserver`. If it exceeds the cap, clip with `overflow-hidden max-h-[200px]` and show the toggle.

### 2e. Processing to Results transition

Add a 150ms `opacity` fade-in on the Results mount. Use `animate-fade-in` utility class. Respect `prefers-reduced-motion` (skip the animation, show immediately).

### 2f. State reset confirmation

No change — the current inline "Clear everything?" confirmation is already good.

---

## 3. Prototype Rough Edges

### 3a. PasteFromJson error detail (`PasteFromJson.tsx`)

**Current**: "Could not parse that JSON."

**Change**: Include the parse error detail: "Could not parse JSON: Unexpected token at position 42." Use the message from the caught `SyntaxError`. Truncate the error message at 80 characters if it's excessively long.

### 3b. Fixture controls production gating

Audit that `fixturesEnabled()` returns `false` in production builds (when `import.meta.env.DEV` is false and `VITE_ENABLE_DEV_FIXTURES` is unset). Verify `ScenarioPicker`, force-failure toggle, and variant override are not in the DOM in production. No code change expected — just verification.

### 3c. Skeleton shimmer reduced-motion

Add a `prefers-reduced-motion` media query that replaces the shimmer animation with a static `bg-surface-container-highest/40` fill. Apply to `.skeleton-shimmer` CSS class.

### 3d. Standalone hint text visibility

The "Or upload just the image..." text below the form uses `text-[11px]`. Bump to `text-xs` (12px) and prepend a subtle info icon (`info` material symbol at 14px). Keeps the same muted color.

---

## 4. Keyboard Navigation Audit

Systematically verify and fix:

| Surface | Required tab order | Escape behavior | Enter behavior |
|---------|--------------------|-----------------|----------------|
| **Intake** | Image zone -> Beverage -> Brand -> Class/Type -> Fanciful -> ABV -> Net contents -> Origin -> Applicant -> (Wine fields if visible) -> Clear -> Verify | N/A | Triggers Verify from any non-textarea field (already works) |
| **Processing** | Cancel button must be reachable | Escape triggers Cancel | N/A |
| **Results** | Verdict -> Field rows (ArrowUp/Down) -> Cross-field rows -> Run Full Comparison (if standalone) -> New Review -> Export | Collapse expanded row (already works) | Toggle row expand |
| **Batch Upload** | Images drop zone -> CSV drop zone -> matching actions -> Start Batch | N/A | N/A |
| **Batch Dashboard** | Filter pills -> Sort dropdown -> Table rows -> Export | N/A | Drill-in on focused row |
| **Session Timeout Modal** | Focus trapped: Continue -> Sign Out | Dismiss (Continue) | Continue |
| **Clear Confirmation** | Cancel -> Clear (inline) | Cancel | N/A |

Fix any gaps found during the audit. Add `onKeyDown` handlers where Escape behavior is missing (Processing cancel).

---

## 5. Responsive Breakpoint Check

Test at three widths and fix issues:

| Width | Key surfaces to verify |
|-------|----------------------|
| **1440px** (desktop) | Two-column Intake, Processing sidebar+main, Results pinned column, Batch dashboard full table |
| **1024px** (narrow desktop) | Intake columns may need tighter spacing, batch table may need horizontal scroll or column hiding |
| **768px** (tablet) | Intake stacks to single-column, Processing sidebar stacks above main, Results pinned column stacks or hides, Batch dashboard cards stack |

Specific items:
- Warning diff must not overflow at 768px
- Batch triage table filenames must truncate (not wrap) at narrow widths
- Action button bars must wrap gracefully (not overflow)
- Drop zones must remain usable touch targets at 768px

---

## 6. Reduced-Motion Audit

Animations to check and gate behind `prefers-reduced-motion`:

| Animation | Location | Reduced-motion alternative |
|-----------|----------|---------------------------|
| Step spinner (`animate-spin`) | `Processing.tsx` StepIcon | Static circular icon (e.g., `pending` material symbol) |
| Skeleton shimmer | `Processing.tsx` ReportSkeleton | Static fill (section 3c) |
| FieldRow expand/collapse | `FieldRow.tsx` | Instant show/hide (no transition) |
| Verdict banner entrance | `VerdictBanner.tsx` | Instant render (no slide) |
| DropZone drag-hover | `DropZone.tsx` | Instant color change (no transition) |
| Processing to Results fade | New (section 2e) | Skip animation, show immediately |
| Button active scale | Various `active:scale-[0.98]` | Remove scale transform |

Implementation: use Tailwind's `motion-reduce:` modifier on relevant classes. Add a `useReducedMotion()` hook only if needed for JS-controlled animations (spinner icon swap).

---

## 7. Copy Tone Audit

Scan all user-facing strings in `src/client/**` for:

1. **Marketing/celebratory** — "Great!", "Awesome!", "Success!" -> Replace with neutral factual statements
2. **Alarmist** — "CRITICAL", "DANGER", "WARNING" (outside of the actual government warning text) -> Replace with calm explanations
3. **Inconsistent voice** — Standardize on "We couldn't" (first-person plural, already dominant). Never "The system could not" or "Error occurred."
4. **Leaked jargon** — "adapter failure", "extraction service", "pipeline" -> Replace with user-facing equivalents
5. **Missing reassurance** — Every destructive or clearing action must confirm nothing was lost

Estimated: 2-3 string fixes based on the exploration (the codebase is already clean).

---

## 8. Inline Contextual Hints

Subtle first-use hints that disappear after interaction. Not a tour — these are one-line helper labels.

### Hint system

- Store dismissed state in `sessionStorage` under key `ttb-hints-dismissed` (JSON set of hint IDs)
- Each hint is a `<p>` with `text-xs text-on-surface-variant/70 font-label` styling and a leading `lightbulb` icon
- Hints fade out over 300ms when dismissed (respect reduced motion: instant hide)
- A `useHint(id: string, dismissOn: boolean): { visible: boolean; dismiss: () => void }` hook manages state

### Hints to add

| ID | Location | Text | Dismiss trigger |
|----|----------|------|-----------------|
| `json-paste` | Below DropZone format line on Intake (empty state only) | "You can also paste JSON to pre-fill the form." | User uploads image OR opens JSON paste |
| `beverage-type` | Below beverage type selector | "This adjusts which fields appear and which rules apply." | User selects a beverage type |
| `expand-row` | Below first field row on Results (first view only) | "Click any row to see evidence and confidence details." | User expands any row |
| `new-review-shortcut` | Next to New Review button on Results (first view only) | "Press N to start a new review." | User presses N or clicks New Review |

---

## 9. Empty Intake Welcome Prompt

When both image is null AND all intake fields are empty (true first-visit state), show a "Getting started" card inside the form column area, above the beverage type selector and JSON paste section.

Content:
- Heading: "Getting started" with a `lightbulb` icon
- Three numbered steps: (1) Drop or browse for a label image, (2) Fill in the declared values from the COLA application (or paste JSON), (3) Click Verify Label
- Footer note: "You can also upload just the image to check it without application data."

Styling: `bg-surface-container-low rounded-lg p-6` card, numbered steps in `font-body text-sm`, muted `text-on-surface-variant`. Collapses (unmounts) as soon as user uploads an image or types in any field.

Implementation: a `WelcomePrompt` component rendered conditionally in `Intake.tsx`. Detection: `image === null && isFieldsEmpty(fields)` where `isFieldsEmpty` checks all string fields are empty and varietals array is empty or has one empty row.

---

## 10. Manual QA Walkthrough Script

Create `docs/qa/MANUAL_TEST_SCRIPT.md` with these sections:

1. **Prerequisites** — Dev server running (`npm run dev`), fixture mode enabled
2. **First-run experience** — Auth screen -> Mode select -> Intake (verify welcome prompt, hints visible)
3. **Happy path (single)** — Upload perfect-spirit-label -> Fill form -> Verify -> Results (approve verdict) -> Expand rows -> N for new review
4. **Core-six scenarios** — Each scenario with: load steps, expected verdict, specific checks to verify
5. **Error paths** — Unsupported file (.heic), oversized file (>10 MB mock), no-text result, processing failure (force-failure toggle), slow processing
6. **Batch flow** — Upload 3+ images + CSV -> Matching review -> Start batch -> Processing stream -> Dashboard -> Filter -> Drill-in -> Export
7. **Keyboard walkthrough** — Tab through Intake, Enter to verify, ArrowDown/Up in Results, Escape to collapse, N for new review, Escape on Processing to cancel
8. **Edge cases** — Mode switch mid-review, session timeout (wait 15 min or mock), clear confirmation, JSON paste with invalid data, JSON paste with valid data
9. **Responsive check** — Resize to 1024px and 768px, verify Intake, Results, Batch dashboard
10. **Reduced motion** — Enable reduced motion in OS settings, verify animations are suppressed

Each step: numbered action -> expected result -> `[ ]` pass/fail checkbox.

---

## Out of Scope

- Auth screen copy changes (explicitly skipped per user)
- Backend/server changes
- Shared contract edits
- New features beyond the polish items listed
- Automated e2e tests (user chose markdown walkthrough only)

## Files Expected to Change

| File | Change type |
|------|-------------|
| `src/client/reviewFailureMessage.ts` | Add `classifyCause()` helper |
| `src/client/Processing.tsx` | Add cause label, elapsed timer, Escape->Cancel, reduced-motion spinner |
| `src/client/DropZone.tsx` | Auto-clear error, uploading state for large files |
| `src/client/Results.tsx` | Export tooltip copy, fade-in transition |
| `src/client/Intake.tsx` | Welcome prompt, standalone hint text bump |
| `src/client/PasteFromJson.tsx` | Include SyntaxError detail in parse error |
| `src/client/BatchProcessingSections.tsx` | Stream item error message display |
| `src/client/BatchUploadPanels.tsx` | CSV error detail rendering |
| `src/client/BatchDashboardControls.tsx` | "Clear filters" action on empty state |
| `src/client/WarningDiff.tsx` | Tall-text cap with expand toggle |
| `src/client/batchTypes.ts` | Add `details` field to `BatchFileError` |
| `src/client/appBatchPreflight.ts` | CSV validation detail population |
| `src/client/VerdictBanner.tsx` | Reduced-motion gate |
| `src/client/FieldRow.tsx` | Reduced-motion gate on expand/collapse |
| New: `src/client/useHint.ts` | Contextual hint hook |
| New: `src/client/useElapsed.ts` | Elapsed seconds hook |
| New: `src/client/useReducedMotion.ts` | Reduced-motion detection hook |
| New: `src/client/WelcomePrompt.tsx` | First-visit welcome card |
| New: `docs/qa/MANUAL_TEST_SCRIPT.md` | Manual QA walkthrough |
| CSS: global styles or Tailwind config | `skeleton-shimmer` reduced-motion, `animate-fade-in` utility |
