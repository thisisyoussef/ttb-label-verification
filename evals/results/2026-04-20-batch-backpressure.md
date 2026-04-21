# 2026-04-20 Batch Backpressure Follow-up

## Scope

Reduce transient batch item extraction errors that appear when the batch runner fans out too aggressively or retries a degraded extractor immediately.

## Code changed

- `src/server/batch/batch-session.ts`
- `src/server/batch/batch-routes.test.ts`

## Engineering change

- Lower the default batch runtime fan-out from `5` to `3` concurrent in-flight assignments.
- Keep env override support through `BATCH_CONCURRENCY`.
- Add a real hidden-retry backoff before the internal retry path re-hits the extractor.
- Keep the existing visible retry flow unchanged once the hidden retry is exhausted.

## Validation

### Focused tests

```bash
npx vitest run src/server/batch/batch-routes.test.ts
```

Result: pass (`6` tests)

Covered behaviors:
- default concurrency stays capped at the smaller burst size
- hidden retry still recovers transient extractor failures
- hidden retry now waits before retrying instead of hammering immediately
- exhausted hidden retries still surface a visible error row that explicit retry can recover

### Live local batch run

Command: local `POST /api/batch/preflight` + `POST /api/batch/run` against the checked-in `cola-cloud-all` pack

Observed summary:
- `total: 28`
- `pass: 16`
- `review: 9`
- `fail: 3`
- `error: 0`

Session id:
- `b24fd307-6434-4104-9dcd-a33c71b9afb2`

## Notes

- This is a backpressure fix, not a semantic review-policy change.
- The remaining non-pass items are review/fail outcomes, not transport/runtime item errors.
- If more hardening is needed later, the next step should be adaptive concurrency based on recent retryable failure rate rather than another blind retry increase.
