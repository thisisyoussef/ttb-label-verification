# Observability Plan

## Goal

Make batch flow failures localizable without exposing sensitive batch inputs.

## Required runtime markers

- preflight requested
- preflight succeeded
- preflight failed
- batch run started
- progress frame received
- item frame received
- summary frame received
- batch cancelled
- dashboard requested
- dashboard failed
- drill-in report requested
- drill-in report failed
- export requested
- export failed
- retry requested
- retry failed

## Privacy rules

- No raw label bytes in logs.
- No raw CSV row dumps in logs.
- No persisted session debug files.
- Error copy may mention the workflow branch but not sensitive payload contents.

## Run-correlation fields

- `batchSessionId`
- `imageId`
- `reportId`
- `view`
- current batch phase

## Manual verification note

For this story, route-level and UI-state assertions are more valuable than broad browser automation. The main observability check is whether the active batch branch is obvious from the client/server response behavior and any surfaced error copy.

2026-04-15 verification outcome:

- live intake opened empty by default
- live preflight showed real uploaded filenames and CSV identities
- live processing streamed item progress
- live terminal state and dashboard preserved submitted `Manual Batch Alpha` and `Manual Batch Beta` labels
- only browser console error observed was the existing missing `favicon.ico` request
