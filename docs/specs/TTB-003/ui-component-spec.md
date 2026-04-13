# UI Component Spec

## Story

- Story ID: `TTB-003`
- Title: batch triage workflow and processing pipeline

## Problem

Single-label review alone does not satisfy high-volume reviewer workflows. The batch path must let reviewers process many labels in one session without losing the clarity and trust of the single-label experience.

## Users & use cases

- Primary users:
  - high-volume batch reviewers
  - supervisors triaging large importer submissions
  - demo viewers validating scale beyond a one-off example
- Use cases:
  - As a batch reviewer, I want to upload many images and one CSV so that I do not process labels one at a time.
  - As a reviewer, I want to see progress and early results so that I can trust the batch is advancing.
  - As a reviewer, I want to filter and sort the dashboard so that I can work failures and reviews first.
  - As a reviewer, I want to drill into one item using the same evidence view as single-label review so that I do not learn a second interface.

## UX flows

### Flow 1: batch upload and run

1. Reviewer lands on the batch upload surface from the single-label entry point.
2. Reviewer drops multiple label files and uploads a CSV.
3. UI confirms counts and matching state.
4. Reviewer starts the run.
5. Progress view shows completed vs remaining items and incremental results.
6. Dashboard opens automatically when enough results exist or when processing completes.

### Flow 2: triage and drill-in

1. Reviewer filters to failures or reviews.
2. Reviewer sorts by severity or issue count.
3. Reviewer opens one row into the single-label detail experience.
4. Reviewer returns to the dashboard without losing filter context.

### Edge cases and failure states

- unmatched file or row
- malformed CSV
- one failed item within an otherwise successful batch
- long-running batch with partial results

## IA / layout

### Batch upload screen

- Purpose: collect files and CSV and confirm batch readiness.
- Main elements:
  - multi-file drop zone
  - CSV upload zone
  - counts and match summary
  - start batch action
- Responsive behavior:
  - keep upload controls stacked and readable on smaller screens

### Batch progress screen

- Purpose: show bounded progress and reassure the reviewer.
- Main elements:
  - progress count
  - current status line
  - partial results preview or recent completions
- Responsive behavior:
  - progress text must remain legible and not depend on tiny charts

### Batch dashboard

- Purpose: support triage and drill-in.
- Main elements:
  - approve/review/reject totals
  - filter controls
  - sortable result table
  - export action
  - drill-in path
- Responsive behavior:
  - preserve readable row density and avoid compressing status information into unlabeled icons

## States

### Batch upload

- loading: file parsing or CSV reading feedback
- empty: no files yet
- error: malformed CSV, unsupported file, or ambiguous matching message
- success: ready-to-run state with explicit counts

### Batch progress

- loading: active processing with completed/remaining counts
- empty: not applicable
- error: item-level or batch-level failure summary
- success: all items processed, dashboard ready

### Batch dashboard

- loading: initial result hydration
- empty: no rows match the current filter
- error: export failure or drill-in load failure
- success: stable triage table

## Copy & microcopy

- headings:
  - `Batch Upload`
  - `Batch Processing`
  - `Batch Results`
- button labels:
  - `Start Batch Review`
  - `Export Results`
  - `View Details`
- helper text:
  - `Upload up to 50 label files and one CSV with matching application data.`
  - `Files are matched by filename first, then by order when needed.`
- error messages:
  - `We couldn't match some files to CSV rows. Review the unmatched items before continuing.`
  - `This CSV could not be read. Check the headers and try again.`

## Accessibility / privacy / performance constraints

- accessibility:
  - filters and sorting must be keyboard reachable
  - row status must remain understandable without color
- privacy:
  - reviewed/confirmed indicators must not imply durable workflow storage
- performance:
  - results should appear incrementally; the UI must not feel frozen while the batch runs

## Data and evidence needs from backend

- required fields:
  - per-row recommendation
  - status
  - severity
  - issue count
  - matching state
  - drill-in data or reference
- evidence objects:
  - drill-in reuses the single-label result contract
- loading/error semantics:
  - item-level failures must be distinguishable from batch-level failures
- confidence or uncertainty needs:
  - low-confidence items must still surface clearly in the dashboard triage view

## Frozen design constraints for Codex

- layout:
  - preserve the three-part batch flow: upload, progress, dashboard
- interaction:
  - preserve filter, sort, drill-in, and export as the core dashboard actions
- copy:
  - preserve direct operational labels and error messages unless the user approves changes
- responsive behavior:
  - preserve readable table density and a viable smaller-screen fallback

## Open questions

- Whether `Reviewed` and `Confirmed` are both needed in the proof of concept or whether one session-only marker is enough
- Whether partial result streaming should be true streaming or periodic polling in the first implementation
