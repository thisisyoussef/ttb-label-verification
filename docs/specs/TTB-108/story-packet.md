# Story Packet

## Metadata

- Story ID: `TTB-108`
- Title: extraction mode selector and mode-aware processing states
- Parent: `TTB-004`
- Lanes in scope: Claude (UI) + Codex (client and request-state wiring)
- Packet mode: compact planning packet
- Depends on: `TTB-107` approved; Codex integration also depends on the backend mode-routing stories under `TTB-206` and `TTB-212`

## Problem

The current workstation exposes one implicit extraction path. That is fine for the prototype today, but it cannot express the dual-mode architecture Marcus cares about: a cloud-first demo path and a local restricted-network path that keeps the same deterministic validator pipeline.

If the product adds a local extraction mode but hides it behind env-only behavior, Sarah cannot demo it and Marcus cannot validate the deployment story from the running app. If the control is too prominent, Dave pays a cognitive tax on every review for a feature he will rarely change.

The UI needs a small, secondary mode selector that preserves the existing workstation hierarchy, makes cloud mode the obvious default, and gives the reviewer clear mode-aware processing feedback without turning the app into a settings-heavy surface.

## Acceptance criteria

1. The signed-in workstation exposes a compact extraction-mode selector with exactly two choices:
   - `Cloud (recommended)`
   - `Local (offline)`
2. The selector is visually secondary to the primary review workflow and does not displace:
   - the `Single | Batch` mode toggle
   - the primary review action
   - the privacy anchor copy
3. The processing surface and any in-flight progress copy reflect the selected extraction mode.
4. The results surface stays structurally the same. The mode change does not create a second results design.
5. Local mode framing is calm and explicit:
   - slower than cloud
   - may produce more `Review` outcomes on layout and formatting checks
   - does not promise the same visual-reasoning quality as cloud mode
6. Mode selection lives only in current tab state and is cleared by sign-out.
7. If local mode is selected but unavailable, the UI shows a bounded failure state with a clear path back to cloud mode.

## Out of scope

- new result cards or a second evidence model
- exposing provider names like Gemini, OpenAI, Ollama, or Qwen in the primary reviewer surface
- new settings screens, configuration drawers, or admin panels
- backend provider implementation details

## Lane plan

### Claude

- define where the selector lives in the signed-in shell
- define the resting, loading, and unavailable states
- define the exact processing copy for cloud and local runs
- preserve the industrial-precision header hierarchy
- stop at visual approval and write the Codex handoff

### Codex

- wire the approved selector into client-local state
- pass the selected mode into the eventual backend extraction-mode seam
- keep the selection ephemeral and reset it on sign-out
- add regression tests for cloud/local selection, reset, and unavailable-state recovery

## Notes for tailoring

- This story exists because the dual-mode architecture is primarily for Marcus and Sarah, not for daily reviewer throughput. The control should therefore be present and credible, but never noisy.
- `Cloud` remains the default because the repo’s primary interactive SLA and demo story are still anchored to the cloud path.
