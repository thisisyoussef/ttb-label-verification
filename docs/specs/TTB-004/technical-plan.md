# Technical Plan

## Scope

Finish the proof of concept for evaluation: polish the reviewer-facing experience, verify non-functional constraints, and produce the submission documentation pack.

## Modules and files

- `docs/specs/TTB-004/ui-component-spec.md` — polish requirements for accessibility, error handling, and trust surfaces.
- `docs/specs/TTB-004/privacy-checklist.md` — final no-persistence gate.
- `docs/specs/TTB-004/performance-budget.md` — final measured timing gate.
- `README.md` — project overview, setup, assumptions, test label guide, and known limitations.
- optional supporting docs under `docs/` for architecture or submission notes as needed.
- `evals/results/` — final smoke-test and evaluation records.

## Contracts

- Preserve the approved UI structure from `TTB-001` and `TTB-003`.
- Preserve the evidence model from `TTB-002`.
- Documentation contract must explain:
  - what the tool does
  - what it does not do
  - how privacy is handled
  - which six labels are used and why
  - where confidence/uncertainty still requires human review

## Risks and fallback

- Risk: last-mile polish uncovers real accessibility or readability problems in dense states.
  - Fallback: prioritize the reviewer path over decorative completeness.
- Risk: docs drift from the finished behavior.
  - Fallback: treat the smoke-test script and eval results as the primary truth when writing the README.
- Risk: hardening changes regress latency.
  - Fallback: re-run measured timing after each meaningful change on the critical path.

## Testing strategy

- unit: only where small utility fixes are introduced during polish.
- integration: final smoke tests for single-label and batch paths.
- contract: preserve the integrated response shapes and reviewer-facing copy expectations.
- UI behavior: accessibility pass, keyboard path checks, responsive review, and dense warning-detail review.
