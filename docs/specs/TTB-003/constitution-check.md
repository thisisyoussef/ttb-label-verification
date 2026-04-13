# Constitution Check

## Story

- Story ID: `TTB-003`
- Title: batch triage workflow and processing pipeline

## Non-negotiable rules checked

- No persistence: satisfied; batch uploads, CSV content, matching state, and reviewed/confirmed flags remain session-scoped and ephemeral.
- Responses API with `store: false`: satisfied; any model work for batch items still uses the same single-label extraction policy.
- Deterministic validators own compliance outcomes: satisfied; batch aggregates single-label engine results rather than replacing validator ownership.
- Shared contract impact reviewed: satisfied; batch summary and drill-in must reuse the single-label evidence language where possible.
- Latency or UX constraints reviewed: satisfied; the batch path must show bounded progress and preserve the under-5-second-per-label target even though total batch runtime is longer.

## Exceptions

- None.
