# 2026-04-19 TTB-210 Eval Result

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Dataset slices

- `deterministic-comparison`

## Endpoint context

- Endpoint surface: integrated verification report assembly (`buildVerificationReport`)
- Extraction mode: fixture-backed verification-mode fields
- Provider: none; deterministic report-builder coverage only
- Prompt profile: existing verification-mode identifier output (`visibleText` + `alternativeReading`)
- Guardrail policy: shared `alternativeReading` downgrade path in `src/server/review/review-report-field-checks.ts`
- Trace mode: none
- LangSmith project: not used
- Trace ids: none
- Latency notes:
  - no model call or route timing change; this eval exercised deterministic report assembly only
  - `npm run test -- src/server/review/review-report.test.ts src/server/review/review-report-alternative-reading.test.ts src/server/anchors/anchor-upgrade-evidence.test.ts src/server/review/review-pipeline.e2e.test.ts` passed in the isolated publish worktree
  - `npm run typecheck` passed in the isolated publish worktree
  - `npm run build` passed in the isolated publish worktree
  - `npm run test` reached 495 passing tests and then hit one unrelated timeout in `src/server/extractors/pdf-label-converter.test.ts`; the PDF test passed on immediate isolated rerun
- Persona-specific observations:
  - Dave: equivalent identifier readings no longer surface as obviously dumb `Needs review` rows.
  - Jenny: genuinely conflicting alternative readings still stay reviewable with the mismatch called out.
  - Sarah: the class/type evidence panel now reads consistently for safe equivalent terms like `ale` vs `INDIA PALE ALE`.
  - Marcus: no persistence, tracing, or provider behavior changed.
  - Janet: the shared field-check path improves the same row logic used by single-review and batch drill-in reports.

## Cases run

- conflicting brand alternative reading remains `review`
- equivalent class/type alternative reading (`ale` vs `INDIA PALE ALE`, alt `ale`) now stays `pass`
- equivalent country alternative reading (`United States` vs `USA`, alt `United States`) now stays `pass`

## Live asset status

- Required live assets: no
- Missing live assets: none

## Expected vs actual

| Case | Expected | Actual | Latency | Notes |
| --- | --- | --- | --- | --- |
| conflicting brand alternative | still `review` | `review` | n/a | existing safeguard preserved |
| equivalent class/type alternative | `pass` | pass | n/a | equivalent alternative no longer forces review |
| equivalent country alternative | `pass` | pass | n/a | shared-path fix helps another identifier field too |

## Persona scorecards

- Sarah: equivalent label wording no longer creates a contradictory “it matches, but needs review” presentation.
- Dave: review pressure stays on real conflicts instead of harmless alternate phrasings.
- Jenny: evidence copy remains explicit when there is a real alternative mismatch.
- Marcus: deterministic-only change; no privacy posture change.
- Janet: downstream report consumers benefit because the fix lives in the shared field-check path.

## Privacy and trace notes

- Fixture-only or sanitized inputs: yes
- `noPersistence` proof: unchanged; no new storage, logging, or model call path added
- Prompt/provider provenance recorded: yes; unchanged verification-mode prompt contract, deterministic report-only adjustment

## Regressions

- none in the targeted report-builder coverage
- existing unrelated full-suite timeout noise remains in `src/server/extractors/pdf-label-converter.test.ts` under concurrent load; isolated rerun passed

## Follow-up

- none
