# Privacy Checklist

## Story scope

`TTB-102` finishes the runtime integration behind the approved results UI. The client now consumes the `/api/review` payload directly, and the seed route emits a standalone-shaped report when application data is omitted. No new persistence, telemetry, or model calls are introduced.

## Checks

- [x] The single-label review path still uses in-memory uploads only
- [x] No new browser storage is introduced for result payloads or fixture-mode state
- [x] Dev fixture controls are runtime-only and do not persist selections outside the current page session
- [x] Export continues to use a transient in-memory blob URL that is revoked immediately
- [x] No new logging of filenames, extracted values, or report payloads is introduced in either client or server

## Verification notes

- `submitReview()` now returns the parsed `VerificationReport`, but the payload remains in React state only
- Standalone seed shaping happens inside shared-contract helpers and server route logic; it does not write any intermediate files
- Batch fixture-control gating changes only the visibility of dev selectors; it does not add persistence

## Negative cases to prove

- Omitted application fields must not cause the client to fabricate application comparisons
- Fixture mode disabled must not silently fall back to seeded scenario payloads
- Export must still revoke blob URLs immediately after download

## Local proof

- `src/client/review-runtime.test.ts` proves live-report vs. fixture-report selection
- `src/shared/contracts/review.test.ts` proves standalone seed shaping
- `src/server/index.test.ts` proves the standalone route response when fields are omitted
