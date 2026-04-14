# Observability Plan — TTB-106

## Goal

Make guided-tour failures localizable without relying on screenshots alone, while preserving the no-persistence product invariant.

## Scope

- Guided-tour step resolution in `src/client/help-tour-runtime.ts`
- Tour state stitching in `src/client/App.tsx`
- Spotlight render state in `src/client/GuidedTourSpotlight.tsx`

## Sanitized fields to track for each branch decision

- `tourStepAnchorKey`
- `tourStepIndex`
- `mode`
- `view`
- `scenarioId`
- `hasImage`
- `hasReport`
- `processingPhase`
- `nextDisabled`
- `interactionKind`
- `pendingVerifyAdvance`

None of these fields contain raw uploaded image bytes, application form text, or reviewer identity.

## Current checked-in localization surfaces

- Pure branch logic in `src/client/help-tour-runtime.ts` with focused tests in `src/client/help-tour-runtime.test.ts`
- Render-state assertion for disabled `Next` in `src/client/GuidedTourSpotlight.test.tsx`
- Manual QA against the local dev server for the async Verify branch

## Gap

There is not yet a dedicated structured client event logger for tour-step transitions. Today, regressions are localized through the branch helper tests plus manual reproduction against visible state.

## Preferred future instrumentation

- Dev-only structured client debug events for:
  - step resolution
  - Next-disabled state changes
  - verify-click pending state
  - verify-result advance vs failure recovery
- Event payload should use only the sanitized fields above.
- These events must remain local-only and must never be sent to a server endpoint.

## Verification for this hardening pass

- Non-happy-path branch verified: real Verify click -> extraction failure -> deterministic sample-results recovery while Step 4 stays blocked on the real interaction until the failure branch resolves.
- Supporting automation:
  - `src/client/help-tour-runtime.test.ts`
  - `src/client/GuidedTourSpotlight.test.tsx`

## Guardrails

- No raw label images, raw application data, or verification payloads in logs.
- No persistence, analytics, or per-user tour telemetry.
- Any future client debug surface must stay disabled outside explicit local development.
