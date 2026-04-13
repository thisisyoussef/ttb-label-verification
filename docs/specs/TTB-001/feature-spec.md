# Feature Spec

## Story

- Story ID: `TTB-001`
- Title: single-label reviewer workflow and evidence surfaces

## Problem statement

The proof of concept needs a complete single-label reviewer experience before engineering integration is useful. Reviewers need an obvious upload-and-review flow, dense but legible evidence, and a results surface that behaves like a digital checklist rather than a generic app dashboard.

## User-facing outcomes

- A reviewer can upload a label, optionally enter application data, and reach results in a simple, self-explanatory flow.
- The results view clearly communicates recommendation, pass/review/fail counts, field-level evidence, and government warning detail.
- Standalone image-only review works without application data.
- Error states and low-confidence states explain what happened and what to do next.

## Acceptance criteria

1. The UI defines the full single-label path: intake, processing, results, standalone mode, and reset/new review.
2. Intake supports the required file types, file-size guidance, application form fields, beverage-type-specific conditional fields, and an obvious primary action.
3. Results present an overall recommendation, status counts, field-by-field rows, expandable evidence panels, and a special government warning detail view.
4. Standalone mode clearly distinguishes “no comparison” from “comparison” behavior and provides a path back into full comparison.
5. Loading, low-confidence, no-text-extracted, invalid-file, oversized-file, and general processing-error states are all specified with concrete copy.
6. The UI spec is explicit enough that Codex can later implement the backend contract without redesigning the screen hierarchy, copy, or interaction model.

## Edge cases

- Very tall or wide labels must still preview cleanly.
- Beverage type changes must hide or reveal form fields without confusing the reviewer.
- Mixed pass/review/fail states must remain scannable even when many rows are expanded.
- The government warning detail view must remain readable even when there are many sub-checks and a long diff block.

## Out of scope

- Live backend integration.
- Batch workflow screens.
- Final submission packaging and README.
