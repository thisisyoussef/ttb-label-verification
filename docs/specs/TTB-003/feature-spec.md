# Feature Spec

## Story

- Story ID: `TTB-003`
- Title: batch triage workflow and processing pipeline

## Problem statement

The project must support reviewers who process many labels in a session, especially large-importer workflows. The proof of concept needs a usable batch path that takes multiple images and a CSV, shows progress, surfaces triage priorities, and lets the reviewer drill into the same evidence-rich detail they trust in the single-label flow.

## User-facing outcomes

- A reviewer can upload a batch of label images and a matching CSV.
- The system matches inputs, reports progress, and surfaces summary totals.
- The reviewer can filter, sort, and drill into individual results.
- Results can be exported for handoff or review notes.

## Acceptance criteria

1. The UI defines a batch upload surface for multiple images plus a CSV file and explains the matching strategy.
2. The system supports automatic image-to-row matching by filename or sequence and provides a manual resolution path when matching is ambiguous.
3. Batch processing shows progress with completed vs remaining counts and incremental result availability.
4. The dashboard shows summary counts, sortable/filterable results, severity-aware triage, and drill-in to the single-label detail view.
5. Export is available for batch results without requiring durable server-side storage.
6. Reviewed/confirmed markers, if included, are explicitly session-scoped or export-scoped rather than persisted between sessions.
7. The batch implementation reuses the single-label result contract rather than inventing a disconnected evidence model.

## Edge cases

- A file does not match any CSV row automatically.
- Multiple files appear to match the same CSV row.
- One file in the batch fails while others succeed.
- The CSV is malformed or uses unexpected headers.
- The batch is large enough that progress feedback needs to remain believable and stable.

## Out of scope

- Long-running background jobs.
- Cross-session resumability.
- Durable review workflow state or assignment tracking.
