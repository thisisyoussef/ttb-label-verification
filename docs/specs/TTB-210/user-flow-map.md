# User Flow Map

## Intake and verify flow

1. Reviewer selects one or two label images.
2. Intake does not show a quick-break relevance warning.
3. Reviewer clicks Verify and enters the canonical review path immediately.
4. Background OCR-only relevance may still run as internal prefetch advice, but it is not surfaced pre-submit.
5. The end-result surface uses the authoritative review report to decide whether the image was readable enough to treat as a label.

## End-result branches

- readable label
  - show the normal results surface

- unreadable or likely-not-a-label result
  - show the end-result readability state after Verify, not at intake

## Non-happy paths

- OCR unavailable or relevance route failure
  - do not block Verify
  - keep the result driven by the canonical review path
