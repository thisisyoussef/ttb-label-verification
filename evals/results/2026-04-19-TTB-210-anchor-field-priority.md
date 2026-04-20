# 2026-04-19 TTB-210 Eval Result

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Dataset slices

- `deterministic-comparison`
- real-label anchor stress fast slice (`simply-elegant`, `persian-empire`, `leitz-rottland`, `stormwood`, `lake-placid`, `harpoon`, `negative-abv`)

## Endpoint context

- Endpoint surface: integrated verification report assembly (`buildVerificationReport`) plus real-label `/api/review` pipeline e2e coverage
- Extraction mode: fixture-backed for deterministic report tests, real-label OCR for the anchor stress run
- Provider: none for the targeted tests; the stress run used a hostile extractor stub to isolate anchor behavior
- Prompt profile: unchanged from the current `TTB-210` shared prompt-policy path
- Guardrail policy: literal anchors may now take priority at the field row when the approved value is clearly printed on the label
- Trace mode: local only
- LangSmith project: not used
- Trace ids: none

## Commands run

- `npx vitest run src/server/review/review-report-anchor-merge.test.ts src/server/review/review-pipeline.e2e.test.ts`
- `npx vitest run src/server/anchors/anchor-field-track.e2e.test.ts src/server/review/review-report-alternative-reading.test.ts`
- `NODE_ENV=test npx tsx -e <fast-slice anchor stress A/B>`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm run eval:golden`

## Cases run

- literal ABV anchor rescues a contradictory VLM read in deterministic report assembly
- real-label Harpoon e2e shows literal ABV anchor turning a contradictory read into `pass`
- anchored brand/class rows can flip to `pass` while an unrelated ABV blocker still keeps the overall verdict at `reject`
- fast-slice A/B compares `ANCHOR_MERGE=disabled` vs `enabled` using the same real labels and a deliberately bad extractor

## Expected vs actual

| Slice | Expected | Actual | Notes |
| --- | --- | --- | --- |
| targeted unit + e2e | green | green | new literal-anchor-priority tests passed |
| full local suite | green | green | `npm run test` passed (`74` files, `438` tests) |
| typecheck | green | green | `npm run typecheck` passed |
| build | green | green | `npm run build` passed |
| golden eval | unchanged existing baseline | unchanged existing warning-route failure | `G-02:warning` still expects `pass` and receives `review`; this pre-dates the literal-anchor change |

## Fast-slice anchor stress A/B

The stress run used the real fast-slice label images and replaced the extractor
with intentionally wrong field reads to measure whether strong literal anchors
actually improve field-row outcomes.

### `ANCHOR_MERGE=disabled`

- verdict correctness: `1/7`
- approves: `0`
- reviews: `5`
- rejects: `2`
- pass checks: `10`
- review checks: `22`
- fail checks: `2`

### `ANCHOR_MERGE=enabled`

- verdict correctness: `2/7`
- approves: `1`
- reviews: `4`
- rejects: `2`
- pass checks: `20`
- review checks: `12`
- fail checks: `2`

### Notable deltas

- `harpoon`: `review` → `approve`
- `negative-abv`: stayed `reject`
- field passes doubled from `10` to `20`
- review rows dropped from `22` to `12`
- fail rows stayed flat at `2`, which is the main safety check for this change

## Persona scorecards

- Sarah: richer top-down rescue for obviously present approved text without changing the final-report contract.
- Dave: fewer dumb field-level review rows when the label literally contains the approved text.
- Jenny: contradictory bottom-up reads are still visible through the rest of the report, and unrelated blockers still win.
- Marcus: deterministic-only precedence change; no persistence or tracing posture changed.
- Janet: shared report-builder logic improves the same row behavior used by single-review and downstream batch drill-ins.

## Privacy and trace notes

- Fixture-only or sanitized inputs: yes
- `noPersistence` proof: unchanged; no new storage, logging, or provider calls added
- Prompt/provider provenance recorded: yes; unchanged prompt-policy path, deterministic field-precedence change only

## Regressions

- none observed in targeted tests, real-label e2es, the full test suite, typecheck, or build
- `npm run eval:golden` still carries the pre-existing warning-route `G-02:warning` failure and did not move because of this change

## Follow-up

- instrument and gate `warningOcrCrossCheck` separately; the anchor-priority change improves earlier field rescue, but it does not address the hidden post-extraction warning tail
