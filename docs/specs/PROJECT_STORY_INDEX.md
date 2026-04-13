# Project Story Index

This file is the checked-in leaf-story queue for completing the TTB Label Verification proof of concept.

## How to read this queue

- `TTB-001` through `TTB-004` remain umbrella packets for the major product areas.
- `TTB-1xx`, `TTB-2xx`, `TTB-3xx`, and `TTB-4xx` are the executable leaf stories.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` is the live tracker for what is ready right now.
- `docs/specs/FULL_PRODUCT_SPEC.md` is the complete product blueprint backing this queue.

## Umbrella packets

| Packet | Role |
| --- | --- |
| `TTB-EVAL-001` | evaluation baseline and run discipline |
| `TTB-001` | single-label reviewer experience umbrella |
| `TTB-002` | single-label intelligence and API umbrella |
| `TTB-003` | batch workflow umbrella |
| `TTB-004` | release hardening and submission umbrella |

## Delivery order

| Order | Story ID | Parent | Title | Lane shape | Depends On | Completes When |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `TTB-EVAL-001` | eval foundation | six-label eval corpus and run discipline | Codex-only | none | the shared baseline corpus and run log format are locked |
| 1 | `TTB-101` | `TTB-001` | single-label intake and processing UI | Claude-only then handoff-ready | `TTB-EVAL-001` | the intake and processing screens are approved and frozen |
| 2 | `TTB-102` | `TTB-001` | single-label results, warning evidence, and standalone UI | Claude-only then handoff-ready | `TTB-101` approved | the single-label results experience is approved and frozen |
| 3 | `TTB-201` | `TTB-002` | shared review contract expansion and seed fixture alignment | Codex-only | `TTB-102` ready-for-codex | the contract supports the approved single-label UI |
| 4 | `TTB-202` | `TTB-002` | single-label upload intake, normalization, and ephemeral file handling | Codex-only | `TTB-201` | the live review route can accept safe request inputs without persistence |
| 5 | `TTB-203` | `TTB-002` | extraction adapter, beverage inference, and image-quality assessment | Codex-only | `TTB-202` | the first live extraction pass returns typed structured facts and uncertainty signals |
| 6 | `TTB-204` | `TTB-002` | government warning validator and diff evidence | Codex-only | `TTB-203` | the showcase warning check works end to end |
| 7 | `TTB-205` | `TTB-002` | field comparison, beverage rules, cross-field checks, and recommendation aggregation | Codex-only | `TTB-204` | the single-label intelligence path powers the UI end to end |
| 8 | `TTB-103` | `TTB-003` | batch intake, matching review, and progress UI | Claude-only then handoff-ready | `TTB-102` approved | the batch entry and progress experience is approved and frozen |
| 9 | `TTB-104` | `TTB-003` | batch dashboard, drill-in shell, and export UI | Claude-only then handoff-ready | `TTB-103` approved | the batch triage experience is approved and frozen |
| 10 | `TTB-301` | `TTB-003` | batch parser, matcher, orchestration, and session export | Codex-only | `TTB-205`, `TTB-104` ready-for-codex | batch processing works end to end without persistence |
| 11 | `TTB-105` | `TTB-004` | accessibility, trust copy, and final UI polish | Claude-only then approval | `TTB-301` | the integrated UI is polished and approved for release gating |
| 12 | `TTB-401` | `TTB-004` | final privacy, performance, eval, and submission pack | Codex-led release gate | `TTB-105` | the final proof of concept is measured, documented, and submission-ready |

## Execution notes

- The leaf queue is the real build order. Do not treat the umbrella packets as the only remaining work.
- UI leaf stories stop three times when Stitch is in play: Stitch prep, visual review, and UI-to-Codex handoff.
- Codex must not skip ahead to a later engineering story if the next ready item in the tracker belongs to Claude or to the user.
- Batch stories reuse the single-label evidence language instead of inventing a second result model.
- `TTB-401` is the release gate. No project-level “done” claim skips it.

## Completion definition

The project is specification-complete when the umbrella packets, the full product blueprint, and every leaf-story packet together describe a full path from seeded UI to final submission-quality proof of concept.
