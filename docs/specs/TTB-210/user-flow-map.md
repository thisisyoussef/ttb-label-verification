# User Flow Map

## Intake quick-scan branch

1. Reviewer selects one or two label images.
2. Client sends the upload to `/api/review/relevance`.
3. Server runs OCR-only relevance preflight and returns:
   - `likely-label`
   - `uncertain`
   - `unlikely-label`

## Branches

- `likely-label`
  - client starts `/api/review/extract-only` in the background
  - reviewer keeps filling the form
  - Verify uses the cached extraction when available

- `uncertain`
  - client does not auto-start extract-only
  - reviewer may continue into the canonical review path normally

- `unlikely-label`
  - intake shows a quick-break warning
  - reviewer may:
    - `Try another image`
    - `Continue anyway`

## Non-happy paths

- OCR unavailable or preflight route failure
  - fall back to the previous behavior
  - do not strand the reviewer

- reviewer clicks Verify after `unlikely-label`
  - keep the warning visible
  - do not enter Processing until the reviewer explicitly continues anyway
