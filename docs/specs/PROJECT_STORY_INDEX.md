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
| `TTB-EVAL-002` | Gemini Batch golden-set live eval runner and cost discipline |
| `TTB-001` | single-label reviewer experience umbrella |
| `TTB-002` | single-label intelligence and API umbrella |
| `TTB-003` | batch workflow umbrella |
| `TTB-004` | release hardening and submission umbrella |

## Workflow and maintenance stories

| Order | Story ID | Title | Notes |
| --- | --- | --- | --- |
| W1 | `TTB-WF-001` | workflow foundation upgrade | baseline harness and process story |
| W2 | `TTB-WF-002` | source cleanup and reviewer-oriented refactor pass | user-directed maintenance story for structural cleanup and file-size enforcement |
| W3 | `TTB-WF-003` | lean agent workspace and direct-branch story workflow | simplify the agent contract, keep SSOT plus memory bank, make direct branch work the default, and keep sibling linked worktrees optional |
| W4 | `TTB-WF-004` | automatic production promotion after verified staging deploy | make staging-to-production rollout automatic without depending on a second workflow handoff from a `GITHUB_TOKEN` branch update |

## Delivery order

| Order | Story ID | Parent | Title | Lane shape | Depends On | Completes When |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `TTB-EVAL-001` | eval foundation | golden eval set foundation and run discipline | Codex-only | none | the golden set, live core-six subset, and run log format are locked |
| 0.1 | `TTB-EVAL-002` | eval foundation | Gemini Batch golden-set live eval runner and cost discipline | Codex-only | `TTB-EVAL-001`, `TTB-207` | approved live Gemini extraction corpus can run through inline Batch without weakening the canonical golden gate |
| 0.15 | `TTB-WF-004` | workflow | automatic production promotion after verified staging deploy | Codex-only | `TTB-WF-001`, `TTB-WF-003` | successful `main` CI completions deploy staging first, then auto-promote the same verified SHA to Railway production and sync the `production` branch after production health passes |
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
| 10.5 | `TTB-302` | `TTB-003` | live-first batch runtime, workflow cleanup, and fixture demotion | Codex-only | `TTB-301` | batch behaves as a real live workflow by default, with fixtures explicitly gated for dev/demo only |
| 10.6 | `TTB-303` | `TTB-003` | batch input append and toolbench mode-routing regression fix | Codex-only | `TTB-302` | batch image add-more keeps existing images, and toolbench image inserts respect the active review mode |
| 11 | `TTB-105` | `TTB-004` | accessibility, trust copy, and final UI polish | Claude-first, then Codex release handoff | `TTB-104` approved | the integrated UI is polished and approved for release gating |
| 12 | `TTB-106` | `TTB-004` | guided tour, replayable help, and contextual info layer | Claude-first, then Codex integration | `TTB-301`, `TTB-105` approved | reviewers can launch and replay product guidance without persistence or hidden critical instructions |
| 13 | `TTB-107` | `TTB-004` | mock Treasury auth entry and signed-in shell identity | Claude-first, then Codex integration | `TTB-106` approved | the prototype opens in a realistic internal-tool entry flow and returns there on sign-out without adding real auth infrastructure |
| 14 | `TTB-108` | `TTB-004` | extraction mode selector and mode-aware processing states | Claude-first, then Codex integration | `TTB-107` approved | the reviewer can switch between cloud and local extraction without changing the rest of the workstation UX |
| 15 | `TTB-206` | `TTB-002` | extraction mode routing foundation and privacy-safe cloud/local provider policy | Codex-only | `TTB-205`, `TTB-301` | extraction-mode routing, provider policy, env surface, and privacy rules exist without flipping the live extraction default |
| 16 | `TTB-207` | `TTB-002` | cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation | Codex-only | `TTB-206` | single-label and batch extraction routes can run Gemini first in cloud mode, fall back to OpenAI when allowed, and record trace/eval/privacy/performance evidence |
| 17 | `TTB-208` | `TTB-002` | cloud/default latency observability and sub-4-second budget framing | Codex-only | `TTB-207` | stage timing, budget math, and privacy-safe latency instrumentation exist for the real default single-label path without yet cutting the visible budget target over |
| 18 | `TTB-209` | `TTB-002` | cloud/default Gemini hot-path tuning and latency policy hardening | Codex-only | `TTB-208` | the real default cloud path ships with the winning measured Gemini profile, the checked-in 20-case latency corpus, and an explicit decision to keep the public contract at `5000` |
| 20 | `TTB-210` | `TTB-002` | persona-centered prompt profiles and endpoint plus mode guardrails | Codex-only | `TTB-209` | every shipped model-backed route shares user-aware prompt policy, structural extraction guardrails, and safe degradation rules |
| 21 | `TTB-211` | `TTB-002` | LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates | Codex-only | `TTB-210` | every model-backed route and extraction mode is covered by endpoint-aware evals and persona-grounded release evidence |
| 22 | `TTB-401` | `TTB-004` | final privacy, performance, eval, and submission pack | Codex-led release gate | `TTB-106`, `TTB-107`, `TTB-108`, `TTB-211` | the final proof of concept is measured, documented, and submission-ready |

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
- `TTB-108` is a late-added UI hardening story under `TTB-004`. It keeps cloud vs local extraction as a small secondary control so Marcus and Sarah can demo the deployment-readiness story without turning the workstation into a settings-heavy product.
- `TTB-206` and `TTB-207` now describe the cloud side of a broader dual-mode extraction plan under `TTB-002`. `TTB-206` establishes extraction-mode routing and privacy policy, while `TTB-207` may only flip cloud label extraction to Gemini-primary after trace, eval, privacy, and performance gates pass.
- `TTB-208` and `TTB-209` are the latency-hardening follow-ons for the default cloud path under `TTB-002`. `TTB-208` adds measurement and budget framing; `TTB-209` locks the winning Gemini defaults, checks in the broader latency corpus, and explicitly keeps the public single-label budget at `5000` because the tighter `4000` target was not proved.
- `TTB-210` and `TTB-211` are the user-centered LLM hardening follow-ons under `TTB-002`. `TTB-210` introduces endpoint-aware and mode-aware prompt plus guardrail policy on top of the cloud/local foundation; `TTB-211` turns those promises into route-specific and mode-specific eval and trace gates tied to the personas.
- Archived packet note: `TTB-212` was moved to `docs/specs/archive/TTB-212/` on 2026-04-15 after the user scrapped the local-model work. It is no longer part of the active queue.
- The mock auth story is prototype theater, not security infrastructure. It should strengthen federal context without introducing real credential handling, tokens, or server sessions.
- Guided-tour/help work ships only after the integrated single-label and batch workflows exist, and it should remain optional, replayable, and calm rather than a forced tutorial.
- `TTB-401` is the release gate. No project-level “done” claim skips it.

## Completion definition

The project is specification-complete when the umbrella packets, the full product blueprint, and every leaf-story packet together describe a full path from seeded UI to final submission-quality proof of concept.
