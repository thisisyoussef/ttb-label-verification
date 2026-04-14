---
story: TTB-101
title: single-label intake and processing UI
owner: Claude (UI lane)
status: draft — pending Stitch references
updated: 2026-04-13
---

# UI Component Spec — TTB-101 single-label intake and processing

## 1. Problem

Reviewers need a first-run surface that is instantly recognizable as a compliance workstation, not a consumer tool. They must be able to drop a label image, optionally enter the matching COLA application fields, pick the beverage type, and trigger a review in one obvious primary action. Before the results screen (TTB-102) exists, they must see that the system has accepted the input and is working through a deterministic pipeline — not just "loading." This story proves the landing and processing moments for the single-label path.

Out of scope for this story: results screen, warning evidence diff, standalone mode toggle, batch flow, export.

## 2. Users & use cases

Primary users, all at desktop workstations under fluorescent office lighting:

- **Jenny (junior reviewer, checklist worker):** needs explicit labels, large type, no ambiguous interaction. Pastes application data from another system. Wants the tool to feel like a digital version of her paper checklist.
- **Dave (senior reviewer, judgment worker):** will abandon the tool if a first-pass feels like a demo. Expects dense information, keyboard reach, and no animation theater.
- **Janet (high-volume reviewer):** runs dozens of labels per day. Intake must not add friction per label. Keyboard path matters more than mouse path.
- **Sarah / Marcus (leadership, procurement audience):** may watch a reviewer demo. First impression has to read as "serious government tool."

Core use cases this story supports:

- Upload a single label image and run a review with or without application data.
- Enter application fields fast (paste-friendly, static labels, beverage-type-aware).
- Get clear, non-technical feedback when the image is missing, unsupported, or oversized.
- See the system commit to the work: image thumbnail echoed back, beverage type echoed back, deterministic multi-step progress.

## 3. UX flows

### 3.1 Happy path — with application data

1. Reviewer lands on the intake screen. Title bar, Single/Batch toggle (Single active and default), and the two-column intake layout are visible with no scroll on a 1440×900 desktop.
2. Reviewer drops a JPEG/PNG/WEBP/PDF into the image drop zone (or uses the file picker via keyboard).
3. Drop zone switches to the uploaded state: thumbnail, filename, file size, remove control.
4. Reviewer selects beverage type (Distilled Spirits / Malt Beverage / Wine). The form reshapes in place to show the correct conditional fields.
5. Reviewer types or pastes application fields. All fields are optional.
6. Reviewer clicks **Verify Label** (or presses Enter from any form field that is not a textarea).
7. Intake is replaced by the processing screen in the same page frame: the same thumbnail, the same beverage type, and a vertical multi-step progress list.
8. When processing completes (mocked in this story), the UI would transition to the results screen (TTB-102). For TTB-101, the processing screen stops at a clearly-labeled "Ready to show results (TTB-102 will render here)" terminal state so visual review can see the full pre-results flow.

### 3.2 Happy path — image only (precursor to standalone)

1. Reviewer drops an image, does not enter application data, and selects a beverage type (or leaves it on "Auto-detect").
2. Reviewer clicks **Verify Label**. Processing screen runs the same multi-step list. Standalone-mode branding and editable extracted fields are TTB-102's responsibility.

### 3.3 Error flows on intake

- **Missing image + click Verify:** primary action is disabled until an image is present; helper text below the button explains what is needed. No error banner is required for this case — disabled state is the error surface.
- **Unsupported file type (e.g., .heic, .docx):** drop zone briefly flashes the error border, zone stays in empty state, a single-line error appears below the zone with the exact accepted formats.
- **Oversized file (>10 MB):** same treatment as unsupported file, message names the size limit and the actual size.
- **Too-large image dimensions (non-blocker):** not an error; show a quiet note inside the uploaded-state panel that the image will be downsized server-side.
- **Drag outside the zone:** drop zone does not react; drop outside the zone does not upload.
- **Network failure at Verify time:** handled during processing, not intake (see 3.5).

### 3.4 Beverage-type reshape

Beverage type is a segmented control (not a dropdown) placed at the top of the form. Values: `Distilled Spirits`, `Malt Beverage`, `Wine`, `Auto-detect`. Default is `Auto-detect`. Changing the value:

- never clears fields that are common to all types
- reveals/hides wine-only fields (Appellation, Vintage, Varietals with percentages)
- changes the ABV field's required indicator (MANDATORY for spirits and wine at 7%+ ABV, OPTIONAL for malt beverages — shown as a small tag next to the label, not as a hard required marker since all fields stay optional)
- preserves scroll position; no page jump

### 3.5 Processing

- Step list (vertical, always visible):
  1. Reading label image
  2. Extracting structured fields
  3. Detecting beverage type
  4. Running deterministic checks
  5. Preparing evidence

Each step cycles through three visual states: pending (hollow dot), active (spinning ring), done (green check with a brief settle motion). Only one step is active at a time. Step copy is static — deterministic order, no per-step percentages.

- Image echo: the uploaded thumbnail + filename + beverage type are pinned to the left column of the processing screen. This both reassures the reviewer and makes layout stable when transitioning to results (TTB-102 will reuse this column).

- **Cancel** action is available above the step list. Cancelling returns to intake with the image and form state preserved.

- **Processing error** (network, timeout, adapter failure): the active step flips to an error state with a red X, the remaining steps stay pending, and an error panel explains what happened in plain language plus a **Try again** button and a **Back to intake** button. No raw error codes or stack traces.

- Processing terminal state for this story: once all five steps complete, the page shows a neutral placeholder block reading "Results will render here in TTB-102." The intent is to keep the intake→processing→results frame stable when TTB-102 slots in.

## 4. IA / layout

Single-page shell: `[Title bar] → [Single | Batch toggle] → [Main content area]`.

### 4.1 Intake layout (desktop ≥1024px)

Two-column content area inside a 1200px max-width centered container.

- Left column (≈48% width): **Image drop zone**.
- Right column (≈52% width): **Application data** panel.
  - Beverage-type segmented control at the top.
  - Field groups, each labeled as a section heading:
    - Identity: Brand Name, Fanciful Name, Class/Type.
    - Alcohol and measure: Alcohol Content (with format hint "e.g., 45% Alc./Vol."), Net Contents.
    - Origin and applicant: Applicant Name & Address, Origin (segmented control: Domestic / Imported), Country (only when Imported), Formula ID (optional).
    - Wine-only: Appellation, Vintage, Varietals (repeatable rows with Varietal + % field).

Primary action bar is full-width across both columns, pinned below the fold of the two-column content:

- Left side: reviewer-facing microcopy reiterating the privacy posture ("Nothing is stored. Inputs and results are discarded when you leave.").
- Right side: **Verify Label** (primary) and **Clear** (secondary, ghost style). Disabled state for Verify is explicit and keyboard-announced.

### 4.2 Intake layout (tablet 768–1023px)

Single-column stack: image drop zone → application form → primary action bar. No horizontal scroll. Wine varietal rows stay horizontal.

### 4.3 Intake layout (mobile <768px)

Same stack. Primary action bar sticks to the bottom of the viewport. Mobile is a non-primary use case but must not break.

### 4.4 Processing layout (all breakpoints)

Two columns on desktop, stack on tablet/mobile:

- Left: pinned thumbnail, filename, file size, beverage type, **Cancel** link.
- Right: five-step vertical progress list with step state icons and copy.
- Below the columns, a reserved full-width slot for the eventual results frame.

Never changes total page height between intake and processing: layout is stable enough that the reviewer's eyes do not have to re-anchor.

## 5. States

### 5.1 Image drop zone

- **Empty:** dashed border, upload icon, primary instruction ("Drop a label image or click to browse"), secondary instruction with accepted formats ("JPEG, PNG, WEBP, or PDF. Up to 10 MB.").
- **Drag hover:** border becomes solid blue accent, background tints, instruction swaps to "Drop to upload."
- **Uploaded:** solid border, thumbnail (fit within zone preserving aspect ratio), filename in primary text, file size in tertiary text, ✕ Remove control.
- **Error — unsupported type:** border and icon flash red, single-line error below zone: "We couldn't use that file. Please upload a JPEG, PNG, WEBP, or PDF."
- **Error — oversized:** same visual, message: "That file is X.X MB. The limit is 10 MB."
- **Disabled during processing:** zone is not interactive; the image remains visible as an echo.

### 5.2 Beverage-type segmented control

- Default value: `Auto-detect`. Selected state uses the primary text color on white, unselected uses secondary text on the light page background. Underline or a thin bottom bar marks selection — not a pill.

### 5.3 Application form fields

- **Default:** static label above, empty input with placeholder example, no required marker.
- **Focused:** border color shifts to accent blue, a thin focus ring is visible.
- **Mandatory tag (beverage-dependent):** a small uppercase "MANDATORY" tag next to the field label for ABV under Spirits and Wine ≥7%, "OPTIONAL" for Malt Beverage.
- **Format hint:** small secondary-color helper under the input ("e.g., 45% Alc./Vol.").
- **Pasted input:** treat multi-line paste gracefully — collapse whitespace in single-line fields, show full paste in address (which is a textarea).
- **Error on submit (future):** none in TTB-101 because all fields stay optional. Formatting feedback is for TTB-102.

### 5.4 Wine varietals

- Zero rows by default when Wine is selected. An **+ Add varietal** control adds a row with Varietal + % fields. Delete icon per row. The form tracks percentage total inline and shows a caption "Total: 85% (must equal 100% to qualify)." The total text is informational in this story; it does not block submit.

### 5.5 Primary action bar

- **Disabled Verify:** Verify is disabled until an image is present. Button shows a tooltip on focus/hover: "Add a label image to verify." Disabled button is still focusable for screen reader announcements.
- **Enabled Verify:** primary color, bold label. Hover darkens; active state compresses subtly.
- **Clear:** ghost button. Clear prompts an inline confirmation if either image or any field has content ("Clear everything? You'll lose the current intake."). Escape cancels.

### 5.6 Processing step list

- **Pending:** hollow outline dot in secondary text color, step label in secondary text.
- **Active:** blue spinning ring, step label in primary text, subtle live-region announcement ("Extracting structured fields").
- **Done:** green filled check with brief settle motion (200–300ms), step label in primary text.
- **Error:** red X, step label in primary text, error panel appears below the list.
- **Paused/Cancelled:** list freezes on the current step with a neutral gray marker, cancel message shows.

### 5.7 Processing-time error panel

- Heading: "We couldn't finish this review." Short plain-English reason (e.g., "The connection dropped while reading the label.").
- Two actions: **Try again** (primary) and **Back to intake** (secondary).
- Never shows codes or stack traces.

### 5.8 Terminal placeholder (TTB-101 only)

Subtle bordered block below the columns reading "Results will render here in TTB-102." Background is the page color with a dashed outline so it clearly looks like a placeholder, not a finished surface.

## 6. Copy & microcopy

- App title: **TTB Label Verification Assistant**
- Subtitle (left of title bar, small): "AI-assisted compliance checking"
- Mode toggle: `Single` | `Batch`
- Privacy microcopy (always visible on intake): "Nothing is stored. Inputs and results are discarded when you leave."
- Drop zone empty primary: "Drop a label image or click to browse"
- Drop zone empty secondary: "JPEG, PNG, WEBP, or PDF. Up to 10 MB."
- Drop zone drag-over: "Drop to upload"
- Drop zone remove: "Remove"
- Beverage type label: "Beverage type"
- ABV hint copy: "e.g., 45% Alc./Vol."
- Net contents hint copy: "e.g., 750 mL"
- Address hint copy: "Name, city, and state exactly as on the permit."
- Mandatory tag: "MANDATORY"
- Optional tag: "OPTIONAL"
- Varietal total caption: "Total: {n}% (must equal 100% to qualify)"
- Primary action: **Verify Label**
- Disabled verify tooltip: "Add a label image to verify."
- Secondary action: **Clear**
- Clear confirmation: "Clear everything? You'll lose the current intake." / Cancel / Clear
- Processing heading: "Reviewing this label"
- Processing cancel link: "Cancel review"
- Processing steps (use as-is):
  1. "Reading label image"
  2. "Extracting structured fields"
  3. "Detecting beverage type"
  4. "Running deterministic checks"
  5. "Preparing evidence"
- Processing error heading: "We couldn't finish this review."
- Processing error body template: "{plain-reason}. Your label and inputs are still here — nothing was saved."
- Processing error actions: **Try again** / **Back to intake**
- TTB-101 placeholder: "Results will render here in TTB-102."

Copy principles:

- No technical jargon in user-visible strings.
- Prefer "review this label" over "run verification."
- Never say "AI" without qualifying: "AI-assisted" is acceptable in the subtitle but not in per-row copy.
- Singular, direct instructions. No exclamation marks.

## 7. Accessibility, privacy, performance constraints

Accessibility:

- Minimum body text 16px; supporting text 14px; never below 14px.
- All color signals are reinforced by icon + text label.
- Full keyboard path: Tab order is drop zone → beverage type → form fields top to bottom → Clear → Verify. Enter on Verify triggers submission; Enter inside single-line inputs also triggers submission.
- Drop zone is a real button/input pair, not a div-only handler. The file picker opens on Space/Enter.
- Processing step list uses a live region so step transitions are announced.
- Focus is returned to the first relevant control after intake→processing and processing→intake transitions.
- Contrast: WCAG AA minimum on all text and signal elements.
- No motion beyond the step "settle" and the drop-zone border transition. Respect `prefers-reduced-motion` by replacing the settle with an instant state change.

Privacy:

- The UI must echo the "Nothing is stored" line on intake at all times.
- The intake must not log field values anywhere in the client (console, localStorage, sessionStorage, analytics). Document this in the Codex handoff so backend behavior matches.
- The thumbnail is held in memory (object URL revoked on unmount). No disk write. This is a Claude-side guarantee for the scaffold.

Performance:

- Intake initial render must avoid heavy work. Thumbnail generation is the only significant client-side operation and must not block the main thread visibly on a 10 MB image (use `createImageBitmap` when available).
- Processing screen's step-state timer in the scaffold is purely cosmetic but must be deterministic (steps advance at fixed mocked intervals so visual review is reproducible).
- No blocking animations. Step transitions are under 300ms.

## 8. Data and evidence needs from backend

TTB-101 is UI-only with mocked advancement, but the processing screen will call `POST /api/review` in the near term. Record these needs for Codex:

- Accept `multipart/form-data` with one `label` file (JPEG/PNG/WEBP/PDF, ≤10 MB) and a `fields` JSON part shaped like the application form.
- Reject oversized files before starting extraction. Return a structured validation error the UI can map to the intake error states.
- Return a `VerificationReport` conforming to `src/shared/contracts/review.ts`. TTB-101 does not render the report, but the processing screen needs to know when the call is complete to hand off to TTB-102.
- Stream or publish step progress (e.g., Server-Sent Events with step IDs `reading-image`, `extracting-fields`, `detecting-beverage`, `running-checks`, `preparing-evidence`). If streaming is out of scope for Codex in this wave, the client will run the five-step animation on a fixed cadence and swap to the real payload arrival; either way the step IDs and copy are the contract surface.
- Error shape: a discriminated union of `{ kind: 'validation' | 'timeout' | 'network' | 'adapter' | 'unknown', message: string, retryable: boolean }` so the UI can map to the error panel without re-deriving meaning from HTTP codes.

Evidence not needed in TTB-101 but flagged for TTB-102: extracted fields, per-field confidence, warning diff payload, cross-field check results.

## 9. Frozen design constraints for Codex

When Codex wires live behavior, these aspects of the intake/processing UI are fixed and must not be redesigned:

- Single-page shell with title bar, Single/Batch toggle, and a 1200px-max content area.
- Two-column intake layout at desktop breakpoints; single-column stack below 1024px.
- Five-step deterministic processing list with the exact step copy listed in §6.
- Image echo (thumbnail + filename + beverage type) persists from intake into processing and will persist into results.
- Privacy microcopy is always visible on intake.
- Beverage type is a segmented control, not a dropdown.
- Verify is disabled until an image is present.
- Processing error shows plain-English copy, not error codes.
- `prefers-reduced-motion` is honored.

Codex may change: request wire format, streaming transport, timing, retry semantics, any server-side progress model.

## 10. Open questions

1. Does the Codex team plan to stream step progress for TTB-202/203, or should the UI rely on a fixed cadence until the full pipeline lands?
2. Should "Auto-detect" beverage type be a genuinely separate server-side behavior, or does the client always pass a type (including "auto") to the API?
3. Is PDF upload supported on day one, or do we constrain to raster formats until the extraction adapter is ready? UI already supports PDF, but we may want to hide it from the intake copy until Codex confirms.
4. The "Imported" path reveals a Country field — should this be a free-text field or a code list (ISO 3166)? Default is free text for TTB-101 to keep intake fast; Codex can upgrade later.
5. Wine varietal total: should the UI hard-block submit when the total is non-100%, or stay advisory? Current decision: advisory in TTB-101, to be revisited when the wine validator lands in TTB-205.

## 11. Eval scenario coverage

This story seeds the intake flow for all six required scenarios in `evals/labels/manifest.json`:

- `perfect-spirit-label` — happy path, spirits type, full fields populated.
- `spirit-warning-errors` — same intake shape; difference appears in results (TTB-102).
- `spirit-brand-case-mismatch` — intake shows exact applicant casing, label photo has the mismatch.
- `wine-missing-appellation` — Wine selected; Appellation left blank; Vintage present. Varietal rows included.
- `beer-forbidden-abv-format` — Malt Beverage selected; ABV present but in a forbidden format per the eval.
- `low-quality-image` — image uploaded but deliberately blurry sample; intake accepts it; processing runs normally in this story (confidence handling is TTB-102).

Seeded intake fixtures for visual review will cover all six, accessible via a dev-only scenario picker so the user can cycle through them during the visual-review gate.
