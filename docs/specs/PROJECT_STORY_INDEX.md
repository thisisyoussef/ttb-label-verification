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
| `TTB-EVAL-001` | golden eval set foundation and run discipline |
| `TTB-001` | single-label reviewer experience umbrella |
| `TTB-002` | single-label intelligence and API umbrella |
| `TTB-003` | batch workflow umbrella |
| `TTB-004` | release hardening and submission umbrella |

## Delivery order

| Order | Story ID | Parent | Title | Lane shape | Depends On | Completes When |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `TTB-EVAL-001` | eval foundation | golden eval set foundation and run discipline | Codex-only | none | the golden set, live core-six subset, and run log format are locked |
| 1 | `TTB-101` | `TTB-001` | single-label intake and processing UI | Claude-first, then Codex integration | `TTB-EVAL-001` | the intake and processing screens are approved and frozen |
| 2 | `TTB-102` | `TTB-001` | single-label results, warning evidence, and standalone UI | Claude-first, then Codex integration | `TTB-101` approved | the single-label results experience is approved and frozen |
| 3 | `TTB-201` | `TTB-002` | shared review contract expansion and seed fixture alignment | Codex-only | `TTB-102` ready-for-codex | the contract supports the approved single-label results UI |
| 4 | `TTB-202` | `TTB-002` | single-label upload intake, normalization, and ephemeral file handling | Codex-only, parallel-safe after `TTB-101` | `TTB-101` complete | the live review route can accept safe request inputs without persistence |
| 5 | `TTB-203` | `TTB-002` | extraction adapter, beverage inference, and image-quality assessment | Codex-only | `TTB-202` | the first live extraction pass returns typed structured facts and uncertainty signals |
| 6 | `TTB-204` | `TTB-002` | government warning validator and diff evidence | Codex-only | `TTB-203` | the showcase warning check works end to end |
| 7 | `TTB-205` | `TTB-002` | field comparison, beverage rules, cross-field checks, and recommendation aggregation | Codex-only | `TTB-201`, `TTB-204` | the single-label intelligence path powers the UI end to end |
| 8 | `TTB-103` | `TTB-003` | batch intake, matching review, and progress UI | Claude-first, then Codex integration | `TTB-102` approved | the batch entry and progress experience is approved and frozen |
| 9 | `TTB-104` | `TTB-003` | batch dashboard, drill-in shell, and export UI | Claude-first, then Codex integration | `TTB-103` approved | the batch triage experience is approved and frozen |
| 10 | `TTB-301` | `TTB-003` | batch parser, matcher, orchestration, and session export | Codex-only | `TTB-205`, `TTB-104` ready-for-codex | batch processing works end to end without persistence |
| 11 | `TTB-105` | `TTB-004` | accessibility, trust copy, and final UI polish | Claude-first, then Codex release handoff | `TTB-104` approved | the integrated UI is polished and approved for release gating |
| 12 | `TTB-106` | `TTB-004` | guided review, replayable help, and contextual info layer | Claude-first, then Codex integration | `TTB-301`, `TTB-105` approved | reviewers can launch and replay product guidance without persistence or hidden critical instructions |
| 13 | `TTB-107` | `TTB-004` | mock Treasury auth entry and signed-in shell identity | Claude-first, then Codex integration | `TTB-106` approved | the prototype opens in a realistic internal-tool entry flow and returns there on sign-out without adding real auth infrastructure |
| 14 | `TTB-206` | `TTB-002` | provider routing foundation and privacy-safe Gemini/OpenAI capability policy | Codex-only | `TTB-205`, `TTB-301` | provider capability routing, fallback policy, env surface, and privacy rules exist without flipping the live extraction default |
| 15 | `TTB-207` | `TTB-002` | Gemini-primary label extraction with OpenAI fallback and cross-provider validation | Codex-only | `TTB-206` | single-label and batch extraction routes can run Gemini first, fall back to OpenAI when allowed, and record trace/eval/privacy/performance evidence |
| 16 | `TTB-401` | `TTB-004` | final privacy, performance, eval, and submission pack | Codex-led release gate | `TTB-106`, `TTB-107`, `TTB-207` | the final proof of concept is measured, documented, and submission-ready |

## Execution notes

- The leaf queue is the real build order. Do not treat the umbrella packets as the only remaining work.
- Earlier workflow, eval, and other foundation stories gate later Codex work. They do not block Claude from continuing the UI queue once the prior UI prerequisite is approved.
- Claude advances through the UI track by approved UI prerequisites; Codex stitches the approved UI into the working product afterward.
- UI leaf stories stop three times when Stitch is in play: Stitch prep, visual review, and UI-to-Codex handoff.
- Codex must not skip past an earlier Codex-ready foundation or dependency-satisfied engineering story.
- Codex may take a tracker-marked parallel-safe Codex-only story while Claude or the user is blocked on a different UI gate.
- Approved `TTB-1xx` and `TTB-3xx` UI handoffs can remain executable Codex work after approval without becoming the blocking next story. Keep the handoff doc `ready-for-codex`, and let `docs/process/SINGLE_SOURCE_OF_TRUTH.md` express that non-blocking executability with `ready-parallel`.
- Once workflow/eval foundations are clear, ready approved `TTB-1xx` handoffs should be picked before later blocking `TTB-2xx+` Codex work. The SSOT pointer is the source of truth for when that preference applies.
- Batch stories reuse the single-label evidence language instead of inventing a second result model.
- `TTB-206` and `TTB-207` are late-added provider-migration stories under `TTB-002`. `TTB-206` establishes shared routing and privacy policy, while `TTB-207` may only flip label extraction to Gemini-primary after trace, eval, privacy, and performance gates pass.
- The mock auth story is prototype theater, not security infrastructure. It should strengthen federal context without introducing real credential handling, tokens, or server sessions.
- Guided-review/help work ships only after the integrated single-label and batch workflows exist, and it should remain optional, replayable, and calm rather than a forced tutorial.
- `TTB-401` is the release gate. No project-level “done” claim skips it.

## Completion definition

The project is specification-complete when the umbrella packets, the full product blueprint, and every leaf-story packet together describe a full path from seeded UI to final submission-quality proof of concept.
