# Active Context

- Current focus: `TTB-108` is complete with the signed-in extraction-mode selection step, mode-aware processing/failure states, timeout-warning shell behavior, and the guided-tour recovery/gating fixes that keep the teaching flow aligned with the live shell. `TTB-208` is now the next ready Codex story, `TTB-209` still follows the latency-observability work, and the restricted-network local mode remains planned as `TTB-212`.
- Current story branch: `claude/TTB-108-extraction-mode-selector` in `/Users/youss/Development/gauntlet/ttb-label-verification`.
- `TTB-108` landed across the client shell: `src/client/AuthScreen.tsx`, `src/client/ExtractionModeSelector.tsx`, `src/client/Processing.tsx`, `src/client/App.tsx`, and `src/client/AppShell.tsx` now carry the cloud/local mode choice from sign-in into the live review flow.
- The signed-in shell now warns on inactivity through `src/client/SessionTimeoutModal.tsx` and the pure helpers in `src/client/authState.ts`, while manual sign-out remains an inline header confirmation in `src/client/SignedInIdentity.tsx`.
- Processing failures are now mode-aware: `src/client/useSingleReviewPipeline.ts`, `src/client/reviewFailureMessage.ts`, and `src/client/appReviewApi.ts` normalize failure copy by pipeline step, and local-mode unavailability now routes reviewers toward cloud mode without dropping their shell context.
- Guided-tour handling was tightened alongside the shell work: `src/client/help-tour-runtime.ts`, `src/client/GuidedTourSpotlight.tsx`, `src/client/Results.tsx`, `src/client/HelpLauncher.tsx`, and `src/client/useHelpTourState.ts` now keep action steps blocked until the real state exists, pivot the warning-evidence step to the deterministic failing label, restore the first-run tour nudge, and delay the spotlight border until the target settles on screen.
- `TTB-207` remains the current cloud extraction baseline: Gemini-primary routing, the shared cross-provider extraction schema/prompt layer, sanitized LangSmith comparison traces, and the documented not-yet-production-ready latency note are already in place for the next Codex latency story.
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI.
- Current contract anchor: `src/shared/contracts/review.ts`.
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
