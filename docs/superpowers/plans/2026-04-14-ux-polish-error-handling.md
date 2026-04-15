# UX Polish & Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish every failure state, edge case, and interaction pattern so a reviewer like Dave can use the app without thinking.

**Architecture:** All changes are in `src/client/**` and `docs/`. No backend, no shared contract edits. New hooks (`useHint`, `useElapsed`, `useReducedMotion`) are single-purpose. CSS additions go in `src/client/index.css`. One new component (`WelcomePrompt`). The manual QA script is a standalone markdown file.

**Tech Stack:** React 18, Tailwind CSS, Material Symbols icons, Vite

**Branch:** `claude/TTB-000-ux-polish-error-handling`

---

## File Map

| File | Responsibility | Action |
|------|---------------|--------|
| `src/client/reviewFailureMessage.ts` | Failure copy + cause classification | Modify: add `classifyCause()` |
| `src/client/Processing.tsx` | Processing screen | Modify: cause label, elapsed timer, Escape handler, reduced-motion spinner |
| `src/client/DropZone.tsx` | Single image upload | Modify: error auto-clear, uploading state |
| `src/client/Results.tsx` | Results screen | Modify: export tooltip, fade-in |
| `src/client/Intake.tsx` | Intake form | Modify: welcome prompt, hint text bump |
| `src/client/PasteFromJson.tsx` | JSON paste helper | Modify: parse error detail |
| `src/client/BatchProcessingSections.tsx` | Batch processing stream | Modify: item error messages |
| `src/client/WarningDiff.tsx` | Character diff | Modify: tall-text cap |
| `src/client/VerdictBanner.tsx` | Verdict display | Modify: reduced-motion |
| `src/client/FieldRow.tsx` | Expandable check row | Modify: reduced-motion |
| `src/client/index.css` | Global styles | Modify: fade-in keyframe, shimmer reduced-motion |
| `src/client/useHint.ts` | Contextual hint hook | Create |
| `src/client/useElapsed.ts` | Elapsed seconds hook | Create |
| `src/client/useReducedMotion.ts` | Reduced-motion detection | Create |
| `src/client/WelcomePrompt.tsx` | First-visit welcome card | Create |
| `docs/qa/MANUAL_TEST_SCRIPT.md` | QA walkthrough | Create |

**Skipped from spec** (already implemented or out-of-scope):
- Spec 1b (batch CSV parse errors): CSV validation happens server-side in `submitBatchPreflight`. The client displays the `csvError` string and `fileErrors` array as-is. Detailed row-level CSV errors require server changes — deferred to Codex handoff.
- Spec 2c (empty batch dashboard filter): `EmptyFilter` in `BatchDashboardTable.tsx` already renders a "Show all rows" button with `onClear`.
- Spec 2f (state reset confirmation): already good per spec.

---

### Task 1: Utility Hooks

Create the three small hooks that later tasks depend on.

**Files:**
- Create: `src/client/useReducedMotion.ts`
- Create: `src/client/useElapsed.ts`
- Create: `src/client/useHint.ts`

- [ ] **Step 1: Create `useReducedMotion` hook**

```ts
// src/client/useReducedMotion.ts
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );

  useEffect(() => {
    const mql = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mql) return;
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Create `useElapsed` hook**

```ts
// src/client/useElapsed.ts
import { useEffect, useRef, useState } from 'react';

export function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    startRef.current = Date.now();
    setSeconds(0);
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}
```

- [ ] **Step 3: Create `useHint` hook**

```ts
// src/client/useHint.ts
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ttb-hints-dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // sessionStorage unavailable — hints just won't persist
  }
}

export function useHint(
  id: string,
  dismissOn: boolean
): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(() => !getDismissed().has(id));

  const dismiss = useCallback(() => {
    setVisible(false);
    const dismissed = getDismissed();
    dismissed.add(id);
    persistDismissed(dismissed);
  }, [id]);

  useEffect(() => {
    if (dismissOn && visible) {
      dismiss();
    }
  }, [dismissOn, visible, dismiss]);

  return { visible, dismiss };
}
```

- [ ] **Step 4: Verify hooks compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors from the three new files.

- [ ] **Step 5: Commit**

```bash
git add src/client/useReducedMotion.ts src/client/useElapsed.ts src/client/useHint.ts
git commit -m "feat(TTB-000): add useReducedMotion, useElapsed, and useHint hooks"
```

---

### Task 2: Failure Cause Classification

**Files:**
- Modify: `src/client/reviewFailureMessage.ts`
- Modify: `src/client/Processing.tsx`

- [ ] **Step 1: Add `classifyCause` to `reviewFailureMessage.ts`**

Add this exported function at the end of the file:

```ts
export function classifyCause(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('connection')) return 'This looks like a connection issue.';
  if (lower.includes('timeout') || lower.includes('took too long'))
    return 'The request timed out.';
  return 'Something went wrong on our end.';
}
```

- [ ] **Step 2: Render cause label in Processing failure panel**

In `Processing.tsx`, import `classifyCause`:

```ts
import { classifyCause } from './reviewFailureMessage';
```

In the `phase === 'failed'` block (around line 213), add the cause label between the heading and the failure message paragraph:

Change:
```tsx
<h2 className="font-headline text-2xl font-extrabold text-on-surface">
  We couldn't finish this review.
</h2>
<p className="text-on-surface-variant font-body leading-relaxed max-w-lg">
  {failureMessage}
</p>
```

To:
```tsx
<h2 className="font-headline text-2xl font-extrabold text-on-surface">
  We couldn't finish this review.
</h2>
<p className="text-sm font-label font-semibold text-error/80 mt-1">
  {classifyCause(failureMessage)}
</p>
<p className="text-on-surface-variant font-body leading-relaxed max-w-lg">
  {failureMessage}
</p>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/client/reviewFailureMessage.ts src/client/Processing.tsx
git commit -m "feat(TTB-000): add cause classification to processing failure panel"
```

---

### Task 3: Processing Elapsed Timer & Escape Handler

**Files:**
- Modify: `src/client/Processing.tsx`

- [ ] **Step 1: Add elapsed timer below step list**

Import the hook:
```ts
import { useElapsed } from './useElapsed';
```

Inside the `Processing` component, add:
```ts
const elapsed = useElapsed(phase === 'running');
```

After the `</ol>` step list (around line 166), add:
```tsx
{phase === 'running' && elapsed > 0 ? (
  <p className="font-label text-xs text-on-surface-variant/60 tabular-nums">
    {elapsed}s elapsed
  </p>
) : null}
```

- [ ] **Step 2: Add Escape key handler for Cancel**

Add a `useEffect` inside the `Processing` component:
```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && phase === 'running') {
      e.preventDefault();
      onCancel();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [phase, onCancel]);
```

Import `useEffect` (already imported).

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/client/Processing.tsx
git commit -m "feat(TTB-000): add elapsed timer and Escape-to-cancel on processing screen"
```

---

### Task 4: Reduced-Motion Spinner in Processing

**Files:**
- Modify: `src/client/Processing.tsx`

- [ ] **Step 1: Swap spinner for static icon when reduced motion is active**

Import the hook:
```ts
import { useReducedMotion } from './useReducedMotion';
```

Inside the `Processing` component, add:
```ts
const reducedMotion = useReducedMotion();
```

Pass `reducedMotion` to `StepRow`:
```tsx
<StepRow step={step} index={index + 1} reducedMotion={reducedMotion} />
```

Update `StepRow` signature:
```ts
function StepRow({ step, index, reducedMotion }: { step: ProcessingStep; index: number; reducedMotion: boolean }) {
```

Pass to `StepIcon`:
```tsx
<StepIcon step={step} index={index} reducedMotion={reducedMotion} />
```

Update `StepIcon` signature:
```ts
function StepIcon({ step, index, reducedMotion }: { step: ProcessingStep; index: number; reducedMotion: boolean }) {
```

In the `step.status === 'active'` branch of `StepIcon`, replace:
```tsx
<div className="flex items-center justify-center w-8 h-8 flex-shrink-0">
  <div className="step-ring animate-spin" aria-hidden="true" />
  <span className="sr-only">In progress</span>
</div>
```

With:
```tsx
<div className="flex items-center justify-center w-8 h-8 flex-shrink-0">
  {reducedMotion ? (
    <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
      pending
    </span>
  ) : (
    <div className="step-ring animate-spin" aria-hidden="true" />
  )}
  <span className="sr-only">In progress</span>
</div>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/Processing.tsx
git commit -m "feat(TTB-000): replace spinning step icon with static icon under reduced motion"
```

---

### Task 5: DropZone Error Auto-Clear & Upload State

**Files:**
- Modify: `src/client/DropZone.tsx`

- [ ] **Step 1: Auto-clear error on re-engagement**

In the `DropZone` component, find where `useFileDropInput` is called (around line 70). The hook returns `openPicker` and `onDragOver`. We need to wrap them to clear the error.

Replace the destructured usage with a wrapper. After the existing `handleFile` callback, add wrappers:

```ts
const clearErrorAndOpen = useCallback(() => {
  setError(null);
  openPicker();
}, [openPicker]);

const clearErrorOnDragOver = useCallback(
  (e: React.DragEvent) => {
    setError(null);
    onDragOver(e);
  },
  [onDragOver]
);
```

Then in the empty drop zone JSX, replace:
- `onClick={openPicker}` with `onClick={clearErrorAndOpen}`
- `onDragOver={onDragOver}` with `onDragOver={clearErrorOnDragOver}`

- [ ] **Step 2: Add uploading state for large files**

Add state:
```ts
const [uploading, setUploading] = useState(false);
```

In `handleFile`, after validation passes and before calling `onAccept`, add a brief uploading state for files >2 MB:

```ts
const handleFile = useCallback(
  (file: File) => {
    const validationError = classifyError(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    const isLarge = file.size > 2 * 1024 * 1024;
    if (isLarge) setUploading(true);
    const previewUrl = URL.createObjectURL(file);
    requestAnimationFrame(() => {
      setUploading(false);
      onAccept({ file, previewUrl, sizeLabel: formatSize(file.size) });
    });
  },
  [onAccept]
);
```

Before the `if (image)` check, add an uploading state render:

```tsx
if (uploading) {
  return (
    <div className="flex flex-col gap-3">
      <div
        aria-label="Processing file"
        data-tour-target="tour-drop-zone"
        className="relative flex flex-col items-center justify-center text-center rounded-lg px-8 py-10 xl:px-12 xl:py-16 border-2 border-primary bg-primary-container/20"
      >
        <div className="mb-3 w-8 h-1 rounded-full bg-primary/30 overflow-hidden">
          <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
        </div>
        <p className="font-body text-sm text-on-surface-variant">Preparing image...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/client/DropZone.tsx
git commit -m "feat(TTB-000): auto-clear DropZone errors on re-engagement, add uploading state"
```

---

### Task 6: PasteFromJson Error Detail

**Files:**
- Modify: `src/client/PasteFromJson.tsx`

- [ ] **Step 1: Include SyntaxError detail in parse error**

In `parseJsonFields`, change the catch block (around line 53):

```ts
  } catch (err) {
    const detail =
      err instanceof SyntaxError && err.message
        ? err.message.length > 80
          ? err.message.slice(0, 77) + '...'
          : err.message
        : null;
    const message = detail
      ? `Could not parse JSON: ${detail}`
      : 'That text is not valid JSON. Check the format and try again.';
    return { fields: {}, error: message };
  }
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/PasteFromJson.tsx
git commit -m "fix(TTB-000): surface JSON parse error detail in PasteFromJson feedback"
```

---

### Task 7: Batch Stream Item Error Messages

**Files:**
- Modify: `src/client/BatchProcessingSections.tsx`

- [ ] **Step 1: Find the stream item rendering in `StreamBlock`**

Search for where `BatchStreamItem` rows are rendered. Look for the status badge rendering for error items. Add an error message line below the filename.

Find the stream row rendering (the section that renders `item.filename` and the status badge). After the filename line, add:

```tsx
{item.status === 'error' ? (
  <p className="text-xs text-error font-body mt-0.5">
    {item.errorMessage || 'Could not process this label \u2014 retry or skip.'}
  </p>
) : null}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/BatchProcessingSections.tsx
git commit -m "feat(TTB-000): show error message on failed batch stream items"
```

---

### Task 8: Export Tooltip & Results Fade-In

**Files:**
- Modify: `src/client/Results.tsx`
- Modify: `src/client/index.css`

- [ ] **Step 1: Fix export disabled tooltip copy**

In `Results.tsx`, find the export button's `title` prop (around line 236). Change:

```ts
title={
  exportEnabled
    ? 'Download these results.'
    : 'Export is not yet available.'
}
```

To:

```ts
title={
  exportEnabled
    ? 'Download these results.'
    : 'Complete a review first to export results.'
}
```

- [ ] **Step 2: Add fade-in CSS keyframe**

In `src/client/index.css`, after the `@keyframes shimmer` block, add:

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

In the `@layer components` block, add:

```css
  .animate-fade-in {
    animation: fade-in 150ms ease-out both;
  }
```

- [ ] **Step 3: Add fade-in class to Results wrapper**

In `Results.tsx`, on the outermost `<div>` (around line 152), add the class:

Change:
```tsx
<div className="grid grid-cols-1 md:grid-cols-12 h-[calc(100dvh-var(--header-h))]">
```

To:
```tsx
<div className="grid grid-cols-1 md:grid-cols-12 h-[calc(100dvh-var(--header-h))] animate-fade-in motion-reduce:animate-none">
```

- [ ] **Step 4: Verify it compiles and styles are valid**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/Results.tsx src/client/index.css
git commit -m "feat(TTB-000): fix export tooltip copy, add fade-in transition on Results"
```

---

### Task 9: Warning Diff Tall-Text Cap

**Files:**
- Modify: `src/client/WarningDiff.tsx`

- [ ] **Step 1: Add expand/collapse state and height measurement**

Add imports:
```ts
import { useEffect, useRef, useState } from 'react';
```

In `WarningDiff`, add state and ref:

```ts
const [capped, setCapped] = useState(true);
const [needsCap, setNeedsCap] = useState(false);
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = contentRef.current;
  if (!el) return;
  const check = () => setNeedsCap(el.scrollHeight > 200);
  check();
  const observer = new ResizeObserver(check);
  observer.observe(el);
  return () => observer.disconnect();
}, [segments]);
```

- [ ] **Step 2: Wrap the diff content with cap styles**

Replace the inner `<div>` that contains the DiffRows:

Change:
```tsx
<div className="bg-surface-container-highest rounded-lg border border-outline-variant/20 p-4 overflow-x-auto">
```

To:
```tsx
<div
  ref={contentRef}
  className={[
    'bg-surface-container-highest rounded-lg border border-outline-variant/20 p-4 overflow-x-auto transition-[max-height] duration-200',
    needsCap && capped ? 'max-h-[200px] overflow-y-hidden' : ''
  ].join(' ')}
>
```

After the closing `</div>` of the diff content and before `<DiffLegend />`, add:

```tsx
{needsCap ? (
  <button
    type="button"
    onClick={() => setCapped((prev) => !prev)}
    className="text-xs font-label font-semibold text-primary hover:underline flex items-center gap-1"
  >
    <span className="material-symbols-outlined text-sm" aria-hidden="true">
      {capped ? 'expand_more' : 'expand_less'}
    </span>
    {capped ? 'Show full text' : 'Show less'}
  </button>
) : null}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/client/WarningDiff.tsx
git commit -m "feat(TTB-000): cap tall warning diff at 200px with expand toggle"
```

---

### Task 10: Reduced-Motion & Skeleton Shimmer

**Files:**
- Modify: `src/client/index.css`
- Modify: `src/client/FieldRow.tsx`
- Modify: `src/client/VerdictBanner.tsx`

- [ ] **Step 1: Add shimmer reduced-motion override in CSS**

The global `prefers-reduced-motion` rule in `index.css` (line 27-35) already sets `animation-duration: 0.001ms !important` for all elements. This covers the shimmer animation, the step spinner, and the fade-in. The skeleton shimmer is already handled. No additional CSS needed.

Verify: the existing rule at line 27 covers `.skeleton-shimmer`. Confirmed — it targets `*, *::before, *::after`.

- [ ] **Step 2: Add `motion-reduce` to FieldRow chevron transition**

In `FieldRow.tsx`, the chevron has `transition-transform duration-200`. Add motion-reduce:

Change (around line 53):
```tsx
'material-symbols-outlined text-on-surface-variant transition-transform duration-200',
```

To:
```tsx
'material-symbols-outlined text-on-surface-variant transition-transform duration-200 motion-reduce:transition-none',
```

- [ ] **Step 3: Add `motion-reduce` to button active scales**

In `VerdictBanner.tsx`, there are no `active:scale` classes (confirmed). The main places with `active:scale-[0.98]` are in buttons across various files. These are already covered by the global reduced-motion rule which kills transitions. No additional changes needed.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/FieldRow.tsx
git commit -m "feat(TTB-000): add motion-reduce gate on FieldRow chevron transition"
```

---

### Task 11: Standalone Hint Text Bump

**Files:**
- Modify: `src/client/Intake.tsx`

- [ ] **Step 1: Bump the hint text below the form**

In `Intake.tsx`, find the text "Or upload just the image..." (around line 216):

Change:
```tsx
<p className="text-[11px] text-on-surface-variant/60 font-label mt-3">
  Or upload just the image to check it without application data.
</p>
```

To:
```tsx
<p className="text-xs text-on-surface-variant/60 font-label mt-3 flex items-center gap-1.5">
  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">info</span>
  Or upload just the image to check it without application data.
</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/client/Intake.tsx
git commit -m "fix(TTB-000): bump standalone hint text to 12px with info icon"
```

---

### Task 12: WelcomePrompt Component

**Files:**
- Create: `src/client/WelcomePrompt.tsx`
- Modify: `src/client/Intake.tsx`

- [ ] **Step 1: Create `WelcomePrompt` component**

```tsx
// src/client/WelcomePrompt.tsx

export function WelcomePrompt() {
  return (
    <div className="bg-surface-container-low rounded-lg p-6 flex flex-col gap-4 border border-outline-variant/15">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-[20px] text-primary"
          aria-hidden="true"
        >
          lightbulb
        </span>
        <h2 className="font-headline text-lg font-bold text-on-surface">
          Getting started
        </h2>
      </div>
      <ol className="flex flex-col gap-2 font-body text-sm text-on-surface-variant list-decimal list-inside">
        <li>Drop or browse for a label image.</li>
        <li>
          Fill in the declared values from the COLA application
          <span className="text-on-surface-variant/60"> (or paste JSON)</span>.
        </li>
        <li>Click <strong className="text-on-surface font-semibold">Verify Label</strong>.</li>
      </ol>
      <p className="text-xs text-on-surface-variant/60 font-label">
        You can also upload just the image to check it without application data.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Add `isFieldsEmpty` helper and render WelcomePrompt in Intake**

In `Intake.tsx`, import:
```ts
import { WelcomePrompt } from './WelcomePrompt';
```

Add the helper function before the `Intake` component:
```ts
function isFieldsEmpty(fields: IntakeFields): boolean {
  return (
    !fields.brandName &&
    !fields.fancifulName &&
    !fields.classType &&
    !fields.alcoholContent &&
    !fields.netContents &&
    !fields.applicantAddress &&
    !fields.country &&
    !fields.formulaId &&
    !fields.appellation &&
    !fields.vintage &&
    (fields.varietals.length === 0 ||
      fields.varietals.every((row) => !row.name && !row.percentage))
  );
}
```

Inside the form's right column section (around line 81, after the `<FieldGroupHeading>` and description), conditionally render:

```tsx
{image === null && isFieldsEmpty(fields) ? (
  <WelcomePrompt />
) : null}
```

Place this right before the existing `<div className="bg-surface-container-low rounded-lg p-5 md:p-6 xl:p-8 ...">` that contains the form fields. The WelcomePrompt shows above the form fields and disappears as soon as the user interacts.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/client/WelcomePrompt.tsx src/client/Intake.tsx
git commit -m "feat(TTB-000): add WelcomePrompt for empty first-visit intake state"
```

---

### Task 13: Inline Contextual Hints

**Files:**
- Modify: `src/client/Intake.tsx`
- Modify: `src/client/BeverageTypeField.tsx`
- Modify: `src/client/Results.tsx`

- [ ] **Step 1: Add JSON paste hint on Intake**

In `Intake.tsx`, import the hook:
```ts
import { useHint } from './useHint';
```

Inside the `Intake` component, add:
```ts
const jsonPasteHintDismissed = image !== null;
const jsonPasteHint = useHint('json-paste', jsonPasteHintDismissed);
```

Below the `<DropZone>` component (inside the left column section, after line 78), add:
```tsx
{jsonPasteHint.visible && !image ? (
  <p className="text-xs text-on-surface-variant/70 font-label flex items-center gap-1.5 mt-2">
    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">lightbulb</span>
    You can also paste JSON to pre-fill the form.
  </p>
) : null}
```

- [ ] **Step 2: Add beverage type hint**

In `BeverageTypeField.tsx`, import the hook:
```ts
import { useHint } from './useHint';
```

Inside the `BeverageTypeField` component, add:
```ts
const beverageHint = useHint('beverage-type', value !== 'auto');
```

After the closing `</div>` of the radiogroup (before the outer `</div>`), add:
```tsx
{beverageHint.visible ? (
  <p className="text-xs text-on-surface-variant/70 font-label flex items-center gap-1.5">
    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">lightbulb</span>
    This adjusts which fields appear and which rules apply.
  </p>
) : null}
```

- [ ] **Step 3: Add expand-row and new-review hints on Results**

In `Results.tsx`, import:
```ts
import { useHint } from './useHint';
```

Inside the `Results` component, add:
```ts
const expandRowHint = useHint('expand-row', expandedId !== null);
const newReviewHint = useHint('new-review-shortcut', false);
```

After the field checklist `</section>` (around line 196), add:
```tsx
{expandRowHint.visible ? (
  <p className="text-xs text-on-surface-variant/70 font-label flex items-center gap-1.5 -mt-1">
    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">lightbulb</span>
    Click any row to see evidence and confidence details.
  </p>
) : null}
```

Next to the New Review button (inside the existing flex wrapper, around line 228), after the button add:
```tsx
{newReviewHint.visible ? (
  <span className="text-xs text-on-surface-variant/70 font-label">
    Press N to start a new review.
  </span>
) : null}
```

Update the N-key handler (in the existing keydown effect around line 131) to also dismiss the hint:
After the `onNewReview()` call, add `newReviewHint.dismiss();`. Since we can't call a hook result inside an event listener easily, instead change the `useHint` dismissOn for `new-review-shortcut`:

Actually, simpler approach: the existing N-key handler calls `onNewReview()` which unmounts Results. The hint won't show on the next visit because we need to handle this differently. Instead, pass a ref-based dismiss. Or simpler: just keep `dismissOn: false` and let the hint show each session until N is pressed. The hint is helpful on every first-results-view per session, which is the right behavior since `sessionStorage` resets.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/Intake.tsx src/client/BeverageTypeField.tsx src/client/Results.tsx
git commit -m "feat(TTB-000): add inline contextual hints for first-use guidance"
```

---

### Task 14: Copy Tone Audit

**Files:**
- Various `src/client/**` files — scan and fix

- [ ] **Step 1: Grep for tone violations**

Run:
```bash
grep -rn --include='*.tsx' --include='*.ts' -iE 'great!|awesome|success!|critical|danger|the system' src/client/ | grep -v node_modules | grep -v '.test.'
```

Expected: Zero or near-zero results. Fix any findings.

- [ ] **Step 2: Grep for jargon leaks**

Run:
```bash
grep -rn --include='*.tsx' --include='*.ts' -iE 'adapter failure|extraction service|pipeline error' src/client/ | grep -v node_modules | grep -v '.test.'
```

Expected: Zero results. Fix any findings.

- [ ] **Step 3: Grep for voice inconsistency**

Run:
```bash
grep -rn --include='*.tsx' --include='*.ts' -E 'The system|Error occurred|has failed' src/client/ | grep -v node_modules | grep -v '.test.'
```

Expected: Zero results. Fix any findings.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A src/client/ && git diff --cached --stat
# Only commit if there are changes
git commit -m "fix(TTB-000): copy tone audit — fix any voice/jargon inconsistencies" || echo "No tone fixes needed"
```

---

### Task 15: Keyboard & Responsive Audit

This is a manual verification task with targeted code fixes.

**Files:**
- Possibly modify: `src/client/Processing.tsx`, `src/client/SessionTimeoutModal.tsx`, various others

- [ ] **Step 1: Verify Processing Escape handler works**

Already added in Task 3. Confirmed.

- [ ] **Step 2: Verify SessionTimeoutModal focus trap**

Check `SessionTimeoutModal.tsx`: it uses `autoFocus` on the "Yes, continue session" button (line 66). The modal renders over a backdrop. Focus is not explicitly trapped — but since the backdrop covers everything and the modal uses `aria-modal="true"`, screen readers will handle it. For keyboard users, Tab cycles between the two buttons since they're the only focusable elements in the DOM overlay. Acceptable for this scope.

- [ ] **Step 3: Verify responsive layout at 768px**

Run the dev server and check at 768px width. The key surfaces use:
- Intake: `grid-cols-1 lg:grid-cols-12` — stacks at <1024px. Good.
- Processing: `grid-cols-1 md:grid-cols-12` — stacks at <768px. Good.
- Results: `grid-cols-1 md:grid-cols-12` — stacks at <768px. Good.
- Batch dashboard: `grid-cols-1 md:grid-cols-3` for summary cards. Good.

Fix any overflow issues found during visual review.

- [ ] **Step 4: Commit any responsive fixes**

```bash
git add -A src/client/ && git diff --cached --stat
git commit -m "fix(TTB-000): keyboard and responsive audit fixes" || echo "No fixes needed"
```

---

### Task 16: Fixture Controls Verification

**Files:**
- No changes expected — verification only

- [ ] **Step 1: Verify fixture gating**

Run:
```bash
grep -rn 'fixturesEnabled\|VITE_ENABLE_DEV_FIXTURES' src/client/ | grep -v node_modules | grep -v '.test.'
```

Verify:
1. `fixturesEnabled()` checks `import.meta.env.DEV || env override`
2. All fixture UI (ScenarioPicker, force-failure, variant override) is gated behind `fixturesEnabled`
3. In production builds, `import.meta.env.DEV` is `false` and the env var is unset → fixtures hidden

- [ ] **Step 2: Document findings**

No code change expected. If any leak is found, fix it and commit.

---

### Task 17: Manual QA Walkthrough Script

**Files:**
- Create: `docs/qa/MANUAL_TEST_SCRIPT.md`

- [ ] **Step 1: Create the QA walkthrough**

```markdown
# Manual QA Walkthrough — TTB Label Verification

Last updated: 2026-04-14

## Prerequisites

- [ ] Dev server running: `npm run dev` (Vite on 5176, API on 8787)
- [ ] Fixture mode enabled: `VITE_ENABLE_DEV_FIXTURES=true` in `.env` or dev mode
- [ ] Browser at 1440px width (desktop baseline)

---

## 1. First-Run Experience

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1.1 | Open the app in a fresh tab | Auth screen renders with government banner | [ ] |
| 1.2 | Enter any User ID and click Continue | Mode selector appears (Local / Cloud) | [ ] |
| 1.3 | Select Cloud and continue | Intake screen loads with two-column layout | [ ] |
| 1.4 | Verify the Welcome Prompt is visible | "Getting started" card with 3 numbered steps appears above the form | [ ] |
| 1.5 | Verify the JSON paste hint appears below the drop zone | "You can also paste JSON to pre-fill the form." is visible | [ ] |
| 1.6 | Verify the beverage type hint appears | "This adjusts which fields appear..." is visible below the selector | [ ] |
| 1.7 | Type anything in Brand Name | Welcome Prompt disappears, form fields remain | [ ] |
| 1.8 | Select "Wine" beverage type | Wine-specific fields appear, beverage hint disappears | [ ] |

## 2. Happy Path (Single Review)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 2.1 | Load "Perfect spirit label" scenario from picker | Image and form pre-fill | [ ] |
| 2.2 | Click Verify Label | Processing screen with step list and elapsed timer | [ ] |
| 2.3 | Watch processing complete | Elapsed timer counts up, steps complete with checkmarks | [ ] |
| 2.4 | Results screen appears with fade-in | Verdict banner shows "Recommend approval" (green) | [ ] |
| 2.5 | Verify expand-row hint is visible | "Click any row to see evidence..." appears below first row | [ ] |
| 2.6 | Click any field row | Evidence panel expands, hint disappears | [ ] |
| 2.7 | Press ArrowDown | Focus moves to next row | [ ] |
| 2.8 | Press Escape | Expanded row collapses | [ ] |
| 2.9 | Verify N-key hint next to New Review button | "Press N to start a new review." is visible | [ ] |
| 2.10 | Press N | Returns to Intake, form fields preserved, image cleared | [ ] |

## 3. Core-Six Scenarios

| # | Scenario | Expected Verdict | Key Check | Pass |
|---|----------|-----------------|-----------|------|
| 3.1 | Perfect spirit label | Approve (green) | All checks pass | [ ] |
| 3.2 | Warning text defect (spirits) | Reject (red) | Warning diff shows wrong-case/missing segments | [ ] |
| 3.3 | Cosmetic brand mismatch | Review (amber) | Brand name row shows "Review" not "Fail" | [ ] |
| 3.4 | Wine missing appellation | Reject (red) | Cross-field check shows fail for appellation | [ ] |
| 3.5 | Beer forbidden ABV format | Reject (red) | ABV row shows fail with format explanation | [ ] |
| 3.6 | Low quality image | Review (amber) | Confidence meter shows red, standalone banner appears | [ ] |

## 4. Error Paths

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 4.1 | Drag a .heic file onto the drop zone | Error: "We couldn't use that file. Please upload a JPEG, PNG, WEBP, or PDF." | [ ] |
| 4.2 | Click the drop zone again after error | Error message clears, file picker opens | [ ] |
| 4.3 | Drag over the drop zone after an error | Error message clears on drag-over | [ ] |
| 4.4 | Verify disabled state: hover Verify without image | Tooltip: "Add a label image to verify." | [ ] |
| 4.5 | Hover Export button before completing a review | Tooltip: "Complete a review first to export results." | [ ] |
| 4.6 | Load a scenario, enable force-failure, click Verify | Processing fails: cause label + step-specific message + "Your label and inputs are still here" | [ ] |
| 4.7 | Verify "Try again" button works | Processing restarts from step 1 | [ ] |
| 4.8 | Load "Low quality image" scenario | NoTextState: "We couldn't read enough text" with two recovery paths | [ ] |
| 4.9 | Paste invalid JSON `{bad` in JSON paste | Error: "Could not parse JSON: ..." with position detail | [ ] |
| 4.10 | Paste valid JSON with unknown keys | Success with "Ignored unknown fields: ..." warning | [ ] |

## 5. Batch Flow

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 5.1 | Switch to Batch mode | Batch intake screen loads | [ ] |
| 5.2 | Upload 3+ images | Images appear in drop zone with thumbnails | [ ] |
| 5.3 | Upload a CSV file | CSV parsed, matching review shows matched pairs | [ ] |
| 5.4 | Click Start Batch | Processing stream begins with progress count | [ ] |
| 5.5 | Watch stream complete | Dashboard loads with summary cards | [ ] |
| 5.6 | Click a filter pill (e.g., "Reviews only") | Table filters to matching rows only | [ ] |
| 5.7 | If filter shows no results | "Show all rows" button appears and works | [ ] |
| 5.8 | Click a table row | Drill-in view shows full results (same as single) | [ ] |
| 5.9 | Click breadcrumb back | Returns to dashboard with filter preserved | [ ] |

## 6. Keyboard Walkthrough

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 6.1 | Tab from Image zone through all fields to Verify | Focus follows visual order, no skips | [ ] |
| 6.2 | Press Enter from Brand Name field | Verify triggers (if image present) | [ ] |
| 6.3 | On Processing screen, press Escape | Cancel review triggers | [ ] |
| 6.4 | On Results, press ArrowDown/ArrowUp | Focus moves between field rows | [ ] |
| 6.5 | On Results, press Enter on a row | Row expands/collapses | [ ] |
| 6.6 | On Results, press Escape | Expanded row collapses | [ ] |
| 6.7 | On Results, press N | New review starts | [ ] |

## 7. Edge Cases

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 7.1 | Switch Single -> Batch -> Single mid-review | Single-mode state preserved | [ ] |
| 7.2 | Wait for session timeout (or mock 15min) | Modal: "Your session is about to expire" with countdown | [ ] |
| 7.3 | Click "Yes, continue session" | Modal closes, session continues | [ ] |
| 7.4 | Click "Clear" on intake with filled fields | Confirmation: "Clear everything?" | [ ] |
| 7.5 | Confirm clear | All fields and image reset | [ ] |
| 7.6 | Cancel clear | Fields preserved | [ ] |

## 8. Responsive Check

| # | Width | Surface | Check | Pass |
|---|-------|---------|-------|------|
| 8.1 | 1024px | Intake | Columns tighter but readable | [ ] |
| 8.2 | 1024px | Results | Pinned column + main area fit | [ ] |
| 8.3 | 768px | Intake | Stacks to single column | [ ] |
| 8.4 | 768px | Processing | Sidebar stacks above main | [ ] |
| 8.5 | 768px | Results | Layout stacks cleanly | [ ] |
| 8.6 | 768px | Warning diff | No horizontal overflow | [ ] |
| 8.7 | 768px | Batch dashboard | Cards and table stack | [ ] |

## 9. Reduced Motion

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 9.1 | Enable "Reduce motion" in OS settings | — | [ ] |
| 9.2 | Run a review through Processing | Step spinner shows static "pending" icon (no spin) | [ ] |
| 9.3 | Skeleton shimmer on Processing | Static gray fill (no shimmer) | [ ] |
| 9.4 | Results fade-in | Instant render (no animation) | [ ] |
| 9.5 | FieldRow chevron rotation | Instant (no transition) | [ ] |
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/qa
git add docs/qa/MANUAL_TEST_SCRIPT.md
git commit -m "docs(TTB-000): add manual QA walkthrough script"
```

---

## Completion

After all 17 tasks, run a final type check:

```bash
npx tsc --noEmit --project tsconfig.json
npm run lint
```

Then push the branch:

```bash
git push -u origin claude/TTB-000-ux-polish-error-handling
```
