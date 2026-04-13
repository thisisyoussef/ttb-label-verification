# UI Component Spec

## Story

- Story ID: `TTB-004`
- Title: accessibility, hardening, and submission pack

## Problem

The finished proof of concept will fail adoption if reviewers cannot read it comfortably, recover from errors easily, or trust what it is telling them. The final UI pass needs to make the integrated product feel stable, legible, and serious enough for a real compliance workstation demo.

## Users & use cases

- Primary users:
  - veteran reviewers with low tolerance for ambiguity
  - newer reviewers who rely on clear cues and explanations
  - evaluators reading the app and documentation together
- Use cases:
  - As a reviewer, I want clear status and error messages so that I am never guessing what happened.
  - As a reviewer, I want dense evidence to remain readable so that I do not abandon the tool when results are complex.
  - As an evaluator, I want the UI and docs to tell the same story so that I can trust the proof of concept.

## UX flows

### Flow 1: accessibility and trust pass

1. Reviewer moves through the single-label flow using keyboard and normal pointer input.
2. Reviewer encounters pass, review, fail, low-confidence, and error states.
3. Reviewer can still understand status, next action, and evidence without relying on color or hidden interaction.

### Flow 2: final demo walkthrough

1. Evaluator follows the main happy path and one failure path.
2. Evaluator sees matching UI, documentation language, and test-label framing.
3. The product explains limitations without undermining trust.

### Edge cases and failure states

- dense warning detail at high zoom
- empty filtered dashboard state
- no-text-extracted message
- timeout message
- partial batch failure message

## IA / layout

### Cross-flow polish surfaces

- Purpose: refine the existing single-label and batch layouts, not invent new screens.
- Main elements:
  - status indicators
  - helper text
  - error banners and inline messages
  - warning detail layout
  - batch empty/filter states
- Responsive behavior:
  - preserve readability and hierarchy on narrow screens and high zoom

## States

### Error messaging

- loading: not applicable
- empty: not applicable
- error: concrete message plus next step
- success: message surfaces collapse cleanly when the user recovers

### Low-confidence messaging

- loading: not applicable
- empty: not applicable
- error: not a fatal state
- success: clearly visible caution state with reviewer guidance

### Empty and filtered states

- loading: not applicable
- empty: clear explanation and reset path
- error: not applicable
- success: stable layout even when no rows match the filter

## Copy & microcopy

- headings:
  - `Results`
  - `Batch Results`
  - `Government Warning Detail`
- button labels:
  - `Try Again`
  - `Replace File`
  - `Reset Filters`
- helper text:
  - `Results may be incomplete when image quality is low. Review flagged items carefully.`
- error messages:
  - `We couldn't process this file. Check the format and try again.`
  - `Processing is taking longer than expected. Please wait or try again.`
  - `No results match the current filter. Reset filters to see all items.`

## Accessibility / privacy / performance constraints

- accessibility:
  - preserve readable text size and keyboard navigation after all integration changes
  - keep icon-plus-text status cues intact everywhere
- privacy:
  - trust messaging should align with the real no-persistence behavior
- performance:
  - polish must not add UI effects that slow the main review path or mask real slowness

## Data and evidence needs from backend

- required fields:
  - stable low-confidence and error semantics
  - explicit item-level failure semantics for batch
- evidence objects:
  - no new evidence objects; this story refines presentation of existing ones
- loading/error semantics:
  - error classes must remain distinct enough to map to calm user-facing messages
- confidence or uncertainty needs:
  - preserve enough metadata to explain why an item is in `review`

## Frozen design constraints for Codex

- layout:
  - do not redesign the core screen hierarchy during polish
- interaction:
  - preserve reset, retry, filter, and drill-in flows
- copy:
  - keep the final reviewer-facing language calm and procedural
- responsive behavior:
  - preserve no-horizontal-scroll expectations for primary tasks

## Open questions

- Whether a short trust note about ephemerality should appear directly in the live UI or only in supporting documentation
- Whether the final submission should include screenshots in the README or keep the README text-first
