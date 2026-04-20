# Story Packet

## Metadata

- Story ID: `TTB-205`
- Title: field comparison, beverage rules, cross-field checks, and recommendation aggregation
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: expanded working packet
- Lane status: Codex `complete` on 2026-04-13
- Last reconciled: 2026-04-13 against `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/specs/TTB-002/*`, and the approved `TTB-102` / `TTB-104` handoffs

## Constitution check

- Engineering-only story.
- Must preserve cosmetic-difference handling as `review`, not `fail`.
- Recommendation logic must be deterministic and evidence-backed.
- No frontend redesign allowed.
- Any route or staging adapter that powers approved UI must prove non-default user input survives into the returned contract.

## Problem

After extraction and warning validation exist, the product still needs the full comparison and recommendation layer to become a usable reviewer tool. `/api/review` is still scaffold-biased and must be replaced with the integrated single-label path.

## Acceptance criteria

1. Fuzzy cosmetic brand differences land in `review`.
2. Beverage-specific mandatory and cross-field checks work for the proof-of-concept rule set.
3. Recommendation aggregation matches the approved UI semantics.
4. Single-label route returns the full integrated result model within the parent performance budget.
5. Submitted application values survive into the visible comparison rows.

## Working artifacts

- `docs/specs/TTB-205/story-packet.md`
- `docs/specs/TTB-205/constitution-check.md`
- `docs/specs/TTB-205/feature-spec.md`
- `docs/specs/TTB-205/technical-plan.md`
- `docs/specs/TTB-205/task-breakdown.md`
- `docs/specs/TTB-205/evidence-contract.md`
- `docs/specs/TTB-205/rule-source-map.md`
- `docs/specs/TTB-205/eval-brief.md`
- `docs/specs/TTB-205/privacy-checklist.md`
- `docs/specs/TTB-205/performance-budget.md`

## Reconciliation notes

- `TTB-104` remains frozen approved UI input for later `TTB-301` work, but its own packet and handoff still defer backend execution until `TTB-205` completes. `TTB-205` is therefore the executable Codex story now.
- Parent `TTB-002` docs already define the broader evidence, rule, privacy, and performance rails. This packet narrows them to the integrated `/api/review` cutover.

## Delivery notes

- `src/server/review/review-report.ts` now owns deterministic field comparison, beverage rules, cross-field checks, verdict aggregation, and the no-text fallback.
- `POST /api/review` now calls the live extractor plus warning validator and returns the integrated `VerificationReport`.
- Local OpenAI config is present, but the checked-in six-label media files are still absent, so the live corpus eval remains blocked by missing assets.
