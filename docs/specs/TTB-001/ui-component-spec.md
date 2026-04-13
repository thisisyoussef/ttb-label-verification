# UI Component Spec

## Story

- Story ID: `TTB-001`
- Title: single-label reviewer workflow and evidence surfaces

## Problem

Reviewers need a complete single-label flow that feels like a digital compliance checklist, not a generic SaaS form. The UI has to reduce effort on the most repetitive and error-prone review work, especially the government warning, while staying obvious enough for low-tech-comfort users and stable enough that Codex can later integrate without redesigning it.

## Users & use cases

- Primary users:
  - senior compliance reviewers who want fast judgment and zero interface ambiguity
  - junior reviewers who need explicit evidence, citations, and guidance
  - leadership or demo viewers who need to understand the value in one pass through the flow
- Use cases:
  - As a reviewer, I want to upload a label and optional application data so that I can check a submission quickly.
  - As a reviewer, I want to see a recommendation and field-by-field checklist so that I can triage issues immediately.
  - As a reviewer, I want a deep warning-detail view so that I do not manually read the warning word-by-word.
  - As a reviewer, I want image-only mode so that I can run a standalone compliance check when I do not have the application handy.
  - As a reviewer, I want clear low-confidence and failure messaging so that I know when to trust the tool and when to intervene.

## UX flows

### Flow 1: single-label comparison

1. Reviewer lands on a single screen with upload on one side and application data on the other.
2. Reviewer uploads a file and optionally fills or pastes application data.
3. Reviewer clicks `Verify Label`.
4. Processing state replaces the intake surface and shows progress with the uploaded label preview.
5. Results screen appears with recommendation banner, status counts, field checklist, and expandable detail panels.
6. Reviewer expands rows as needed, inspects the government warning detail if flagged, and decides whether to approve, review, or reject.
7. Reviewer clicks `New Review` to reset the flow.

### Flow 2: standalone mode

1. Reviewer uploads a label without entering application data.
2. Reviewer clicks `Verify Label`.
3. Results screen appears in standalone mode with extracted fields and format/compliance checks only.
4. Reviewer can choose `Run Full Comparison` to return to the form with extracted values ready for deeper comparison.

### Flow 3: recoverable failure

1. Reviewer uploads an invalid, oversized, unreadable, or low-confidence label.
2. The UI keeps the action context visible and shows a clear explanation.
3. The reviewer is given an obvious next step: replace the file, try again, or review low-confidence output carefully.

### Edge cases and failure states

- Missing image with form data present: point back to the upload zone with a clear instruction.
- Beverage type toggled after wine-only fields are filled: hide the fields and make it clear they are no longer active.
- Extra-long warning diff or many expanded rows: preserve readable spacing and stable row layout.
- Low-confidence image quality: show a warning state without turning the entire result into a hard failure automatically.

## IA / layout

### Intake screen

- Purpose: collect the file and optional application data with minimal friction.
- Main elements:
  - upload zone with accepted formats and max size
  - image preview with replace/remove action after upload
  - application form with beverage type selector
  - conditional fields for imported and wine cases
  - `Verify Label` primary action
  - secondary path into batch mode
- Responsive behavior:
  - desktop: upload and form side by side
  - narrow viewports: upload first, form second, single-column flow

### Processing screen

- Purpose: reassure the reviewer that the analysis is progressing.
- Main elements:
  - uploaded image thumbnail
  - multi-step progress list
  - subtle delayed-processing note if the flow exceeds the expected pace
- Responsive behavior:
  - progress labels stay fully readable and do not collapse into unlabeled indicators

### Results screen

- Purpose: communicate recommendation, evidence, and next action immediately.
- Main elements:
  - recommendation banner
  - pass/review/fail count summary
  - checklist rows with status and severity
  - expandable evidence panels
  - cross-field checks section
  - original image reference
  - `New Review` and `Export Results`
- Responsive behavior:
  - primary content must not require horizontal scroll
  - row details may stack labels and values vertically on smaller screens

### Government warning detail surface

- Purpose: make the showcase validator genuinely useful rather than ornamental.
- Main elements:
  - top-line warning outcome
  - sub-check list
  - canonical text reference when needed
  - diff block
  - confidence and citation surface
- Responsive behavior:
  - diff block wraps readably and never compresses to illegible widths

## States

### Upload zone

- loading: transient file-reading feedback only
- empty: drag-and-drop plus browse affordance
- error: invalid type or oversize message anchored to the zone
- success: preview with replace/remove action

### Application form

- loading: none
- empty: all fields blank with clear labels and helper text
- error: inline guidance only when the user attempts review without a required UI precondition, such as no file
- success: entered values remain visible through submission handoff

### Processing view

- loading: active step-by-step progress
- empty: not applicable
- error: graceful processing failure message with retry path
- success: transitions directly into the results surface

### Results checklist

- loading: skeleton or placeholder rows only if needed between processing and results
- empty: not applicable for a successful analysis
- error: global processing error state, not partial table corruption
- success: ordered rows with expandable evidence

### Low-confidence state

- loading: not applicable
- empty: not applicable
- error: not a fatal error
- success: warning banner plus flagged rows indicating uncertainty and recommended reviewer attention

## Copy & microcopy

- headings:
  - `TTB Label Verification`
  - `Application Data`
  - `Results`
  - `Government Warning Detail`
- button labels:
  - `Verify Label`
  - `New Review`
  - `Run Full Comparison`
  - `Export Results`
- helper text:
  - `Application data is optional. Upload just an image for standalone compliance checking.`
  - `Accepted formats: JPEG, PNG, WEBP, PDF up to 10MB.`
- error messages:
  - `Please upload a JPEG, PNG, WEBP, or PDF file.`
  - `This file is too large. Please upload an image under 10MB.`
  - `We couldn't read enough text from this image. Try a clearer photo or continue with caution.`
  - `Processing is taking longer than expected. Please wait or try again.`
  - `Something went wrong while analyzing this label. Please try again.`

## Accessibility / privacy / performance constraints

- accessibility:
  - minimum 16px body text
  - icon plus text plus color for status
  - keyboard-reachable upload, form, row expansion, and reset actions
  - no horizontal scrolling for primary reviewer tasks
- privacy:
  - UI copy should not imply saved history, queued review storage, or hidden retention
  - error messaging must avoid raw stack traces or technical internals
- performance:
  - the processing surface should support a flow that feels compatible with the under-5-second target
  - no decorative transitions that slow reading or make the interface feel theatrical

## Data and evidence needs from backend

- required fields:
  - overall recommendation
  - status counts
  - ordered field rows
  - application value
  - extracted label value
  - status, severity, confidence
  - explanation text and citations
- evidence objects:
  - warning sub-checks
  - warning diff payload
  - cross-field checks
  - image-quality or low-confidence signals
- loading/error semantics:
  - clear distinction between upload rejection, processing failure, timeout, low-confidence result, and no-text-extracted result
- confidence or uncertainty needs:
  - backend must expose enough confidence detail to support `review` as a first-class state, especially for visual judgments

## Frozen design constraints for Codex

- layout:
  - preserve the intake -> processing -> results flow and the checklist-first results hierarchy
- interaction:
  - preserve expandable row details and the dedicated warning detail surface
- copy:
  - preserve reviewer-facing button labels and calm procedural messaging unless the user explicitly approves a change
- responsive behavior:
  - preserve side-by-side intake on desktop and a single-column stacked flow on smaller screens

## Open questions

- Whether `Export Results` ships in the single-label story or in the hardening/submission story
- Whether standalone mode should allow inline editing of extracted values before the full-comparison rerun or only pre-fill the form
- Whether row ordering should be fixed by risk/severity or grouped by section in the final approved UI
