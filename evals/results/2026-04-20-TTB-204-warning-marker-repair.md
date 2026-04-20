# 2026-04-20 TTB-204 Eval Result

## Story

- Story ID: `TTB-204`
- Title: government warning marker repair follow-up

## Dataset slices

- `endpoint-review`
- `endpoint-batch`

## Endpoint context

- Endpoint surface: `/api/review`, `/api/batch/run`
- Extraction mode: `cloud` fixture-backed route harness
- Provider: local fixture-backed eval clients
- Prompt profile: current checked-in review route prompt
- Guardrail policy: current checked-in review route policy
- Trace mode: none
- Local evidence: `npm run eval:golden`
- Latency notes: review slice stayed in the same low-3-second per-case band in the fixture harness; batch slice stayed in the same low-3-second per-item band
- Persona-specific observations: marker-only warning omissions no longer create avoidable exact-text noise in the comparison path while the displayed extracted warning text stays untouched and the core-six plus batch route fixtures remain stable
- 2026-04-20 follow-up note: the same golden slices remained green after softening reviewer-facing exact-text mismatch copy/iconography and routing Toolbench batch sample loads through the live dual-image `cola-cloud-all` pack

## Cases run

- `G-02:review`
- `G-03:review`
- `G-04:review`
- `G-05:review`
- `G-06:review`
- `G-32:review`
- `G-34:batch`
- `G-35:batch`

## Live asset status

- Required live assets: no
- Missing live assets: none

## Expected vs actual

| Case | Expected | Actual | Latency | Notes |
| --- | --- | --- | --- | --- |
| `G-02:review` | warning-error fixture stays stable | pass | `3.18s` | warning-focused review route stayed green after marker repair |
| `G-03:review` | cosmetic brand mismatch stays stable | pass | `3.24s` | no warning regression |
| `G-04:review` | wine appellation miss stays stable | pass | `3.23s` | no warning regression |
| `G-05:review` | beer ABV format fail stays stable | pass | `3.22s` | no warning regression |
| `G-06:review` | low-quality image stays stable | pass | `3.09s` | uncertainty path unchanged |
| `G-32:review` | standalone image-only path stays stable | pass | `3.08s` | extraction-only warning normalization did not break standalone review |
| `G-34:batch` | mixed batch stays stable | pass | `3.30s` | batch route unchanged |
| `G-35:batch` | batch-without-CSV error path stays stable | pass | `3.32s` | batch route unchanged |

## Persona scorecards

- Sarah: fixture-backed review and batch routes stayed stable after a narrow warning extraction fix
- Dave: marker-only OCR noise is less likely to distract from an otherwise correct warning read
- Jenny: the workstation keeps the raw extracted warning text visible while the exact-text comparison can still treat dropped clause markers as minor read noise
- Marcus: fixture-only eval; no persistence posture changed
- Janet: batch route stayed green

## Privacy and trace notes

- Fixture-only or sanitized inputs: fixture-only
- `noPersistence` proof: unchanged; this follow-up only normalizes in-memory warning text
- Prompt/provider provenance recorded: yes

## Regressions

- none in the fixture-backed golden review and batch slices

## Follow-up

- Targeted mutation testing for `src/server/government-warning-text.ts` was attempted but the local Stryker sandbox failed with `ENOSPC` before execution completed.
