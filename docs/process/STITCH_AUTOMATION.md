# Stitch Automation

This repo uses direct UI work by default. Automated Stitch and manual Comet remain explicit alternate modes when a story benefits from them.

## Flow flag

Use `STITCH_FLOW_MODE` to switch between the supported modes:

- `direct` - project default. If the variable is unset, the harness assumes this mode. Work directly from the checked-in packet, master design, and seeded scenarios.
- `automated` - opt-in Stitch automation. Run Stitch through the repo tooling, record the generated references, self-review the result, then stop for user review before implementation.
- `manual` - explicit Comet fallback. Write or update the brief, then stop so the user can run Stitch in Comet and return assets.
- `claude-direct` - legacy alias for `direct`. It is still accepted by the tooling for backward compatibility, but new docs and env defaults should use `direct`.

## Default behavior

- Default UI flow: work directly from `docs/specs/<story-id>/ui-component-spec.md`, `docs/design/MASTER_DESIGN.md`, and the approved repo context. No Stitch generation step is required in this mode.
- Stitch-assisted flow: when `STITCH_FLOW_MODE=automated`, write `docs/specs/<story-id>/stitch-screen-brief.md`, run `npm run stitch:story -- <story-id>`, record the generated references, review the generated output against the packet, then stop for user review before implementation.
- Manual Stitch browser work should use Comet, not Chrome.
- Any agent may use Stitch tooling when the story benefits from it or when the harness itself is being tested.

## Local config

Local-only environment variables:

- `STITCH_FLOW_MODE` as `direct`, `automated`, or `manual`; the legacy alias `claude-direct` still maps to `direct`
- `STITCH_API_KEY` for API-key auth
- `STITCH_PROJECT_ID` to target a specific existing project during smoke tests
- `STITCH_PROJECT_TITLE` for automatic project reuse or creation when `STITCH_PROJECT_ID` is unset
- `STITCH_MODEL_ID` for automated generation, default `GEMINI_3_1_PRO`
- `STITCH_DEVICE_TYPE` for automated generation, default `DESKTOP`
- `STITCH_AUTOMATION_REVIEW_REQUIRED` to keep the post-generation user review gate explicit, default `true`
- `STITCH_GENERATION_TIMEOUT_MS` for the subprocess-level generation timeout, default `180000`
- `STITCH_DOWNLOAD_TIMEOUT_MS` for local HTML artifact downloads, default `60000`

These values are tooling-only and must not be committed. Secret-bearing local config files such as `.mcp.json` and `.cursor/mcp.json` are gitignored.

Auth resolution order for the repo Stitch scripts:

1. `STITCH_API_KEY`
2. `STITCH_ACCESS_TOKEN` + `GOOGLE_CLOUD_PROJECT`
3. project-local Stitch MCP config in `.mcp.json`
4. project-local Cursor MCP config in `.cursor/mcp.json`

For this workspace, the canonical Stitch project is:

- title: `TTB Label Verification System`
- current accessible project id: `3197911668966401642`

For zero ambiguity on local runs, use `STITCH_PROJECT_ID=3197911668966401642`. The harness will still fall back to the exact title above if that env var is unset.

## Local commands

Read-only smoke test:

```bash
npm run stitch:smoke
```

Local stdio MCP proxy for project tooling:

```bash
npm run stitch:mcp-proxy
```

Automated story generation from a checked-in brief:

```bash
npm run stitch:story -- <story-id>
```

This command only runs when `STITCH_FLOW_MODE=automated`. In `direct` or `manual`, it exits immediately with a mode-specific guidance error.

## Automated self-review gate

After `npm run stitch:story -- <story-id>` completes, review the generated output before bringing it to the user.

Minimum self-review:

- compare the generated refs against `docs/specs/<story-id>/ui-component-spec.md`
- compare the result against `docs/specs/<story-id>/stitch-screen-brief.md`
- compare the visual direction against `docs/design/MASTER_DESIGN.md`
- check whether the generated screens cover the states and route or flow scope requested by the packet
- note any obvious mismatch, missing state, or wrong product feel before the user is asked to review

Decision rule:

- if the result is roughly on-target, hand it to the user with a recommendation and concrete review prompts
- if the result is obviously off-target, revise the brief and rerun automated Stitch before user handoff
- if repeated automated runs are still off-target, fall back to a manual Comet pass or ask the user for direction

Failure behavior:

- if the destructive generation call times out or errors, the runner writes `generation-inspection.json` into the run folder with the before and after screen lists
- do not blindly retry after a timeout; inspect that file first to see whether Stitch created screens anyway

## Existing project access

The Stitch tooling can connect to projects already owned by the user. The normal read path is:

1. `list_projects`
2. `list_screens`
3. `get_screen` when a specific screen needs HTML or screenshot inspection

## Destructive-tool rules

The following tools mutate Stitch state and should not be retried casually:

- `create_project`
- `generate_screen_from_text`
- `edit_screens`
- `generate_variants`
- `create_design_system`
- `update_design_system`
- `apply_design_system`

Rules:

- do not retry generation after a timeout unless the result has first been checked with a read call
- do not create duplicate projects as a connectivity check
- prefer read-only smoke tests when validating auth or local wiring

## Blocking rules

- If the current pass is `direct`, do not block on Stitch.
- If `stitch-screen-brief.md` is ready and the current pass is automated, run the repo automation, self-review the result, and only then hand it to the user.
- If the automated Stitch path is expected for the current pass but neither env-based auth nor the local Stitch MCP config is available, stop and ask the user to either restore the Stitch config or explicitly switch the pass to `STITCH_FLOW_MODE=manual` for a Comet fallback or `STITCH_FLOW_MODE=direct` for direct implementation.
- If the current pass is manual, stay blocked until the user returns the requested Stitch assets.
