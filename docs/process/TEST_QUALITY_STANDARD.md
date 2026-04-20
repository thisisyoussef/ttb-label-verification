# Test Quality Standard

Use this document to keep TDD from collapsing into shallow, brittle, or easy-to-fool tests.

It is the repo standard for turning acceptance criteria into a suite that is hard to game and safe to refactor against.

## Source-backed principles

This standard is grounded in:

- Martin Fowler / Thoughtworks on the test pyramid and testing observable behavior: <https://martinfowler.com/articles/practical-test-pyramid.html>
- Microsoft Learn on good unit-test characteristics, AAA, seams, and avoiding multiple Act steps: <https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices>
- Pact docs on contract testing as a faster, more focused boundary check than heavy end-to-end dependence: <https://docs.pact.io/faq/convinceme.html>
- StrykerJS docs for targeted mutation testing: <https://stryker-mutator.io/docs/stryker-js/getting-started/>
- fast-check docs for property-based testing: <https://fast-check.dev/docs/introduction/what-is-property-based-testing/>

## 1. Keep the suite pyramid-shaped

Default posture:

- many small unit and module tests
- some integration or contract tests
- very few full-stack or UI-end-to-end tests

Choose the lowest layer that can prove the behavior.

Do not build a test ice-cream cone where confidence depends mostly on slow high-level tests.

## 2. Good tests must be FAST, ISOLATED, REPEATABLE, SELF-CHECKING, and TIMELY

For this repo, that means:

- no real network in unit tests
- no real filesystem in unit tests unless the behavior itself is file IO
- no wall-clock dependence without an injected seam
- no randomness without a pinned seed or deterministic generator
- no hidden dependence on test order, local machine state, or leftover temp data
- no human inspection required for pass/fail

If a test is flaky, the test is broken.

Do not add retries or sleeps to hide the problem. Fix the shared state, seam, clock, fixture, or async boundary.

## 3. Test behavior, not implementation trivia

- Write tests against public behavior and observable outputs.
- Avoid tests that only mirror internal call order or private helper structure.
- Keep one Act step per test unless a parameterized form is cleaner.
- Use explicit Arrange / Act / Assert structure.
- Keep test names scenario-specific and outcome-specific.
- Use the smallest data that proves the behavior.

## 4. Map every acceptance criterion to tests

For non-trivial behavior changes, create an explicit test map:

- happy path
- failure path
- boundary values
- domain edge cases
- uncertainty fallbacks such as `review`
- no-persistence or privacy negatives when relevant

If an acceptance criterion has no test, the story is not done.

## 5. Test every boundary with non-default values

Whenever behavior crosses a boundary, add a test that proves real values survive the crossing:

- route -> parser -> contract
- adapter -> validator
- extraction result -> aggregation result
- UI-submitted input -> returned payload
- provider response -> normalized internal contract

Shape-only assertions are not enough.

Use non-default submitted values so a hardcoded default cannot accidentally pass.

## 6. Add property tests for broad input spaces

Use property-based tests when a rule must hold across many inputs, especially for:

- string normalization
- fuzzy comparison
- tolerance checks
- parsers
- formatters
- severity mapping
- idempotent transforms

Typical properties:

- normalization is idempotent
- comparison is symmetric when intended
- tolerance logic never upgrades out-of-range values to `pass`
- parser output stays inside the declared contract

Use `fast-check` when the input space is too broad for a few examples to be convincing.

## 7. Add targeted mutation tests for critical pure logic

High-risk pure logic should survive a mutation pass, not just example assertions.

Run targeted mutation testing when a story changes:

- compliance validators
- comparison helpers
- tolerance logic
- severity mapping
- normalization or parsing helpers
- evidence-grade decision helpers

Use the local Stryker harness:

```bash
npm run test:mutation -- --mutate "src/server/validators/government-warning-validator.ts"
```

Do not run repo-wide mutation testing by reflex. Target the changed high-signal modules.

If you skip mutation testing for a high-risk pure module, state why in the handoff or packet.

## 8. Prefer contract tests over sprawling end-to-end dependence

When a change depends on a boundary contract, add focused contract tests instead of hoping a distant end-to-end test will catch drift.

Good targets:

- route payload shape
- provider response normalization
- shared contract guarantees
- integration seams between extracted evidence and deterministic validators

Contract tests should fail loudly when a boundary changes incompatibly.

## 9. Snapshot tests are support, not proof

Do not use snapshots as the only assertion for business logic or contracts.

Snapshots are acceptable only when:

- the output is stable and intentionally reviewed
- the snapshot is small enough to be understood
- targeted assertions still cover the critical behavior

## 10. Self-diagnosing failure output

A failing test should tell us what broke without opening five files.

Prefer:

- explicit expected vs actual values
- narrow assertions
- scenario-specific test names
- fixtures that show intent instead of noise

Avoid giant opaque objects when a smaller assertion would locate the bug faster.

## 11. Repo-level exit standard

For behavior changes, the suite is strong enough only when:

- acceptance criteria map to tests
- the lowest viable test layers were chosen
- unit tests are hermetic
- boundary changes have contract coverage
- high-signal pure logic has property tests or a clear reason not to
- high-risk pure logic gets a targeted mutation check or an explicit waiver
- flaky patterns were removed instead of hidden
- evals and trace review still run when the story type requires them
