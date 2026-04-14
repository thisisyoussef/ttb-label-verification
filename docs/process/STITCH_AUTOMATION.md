# Stitch Automation

This repo uses a Claude-direct UI flow by default, with automated Stitch and manual Comet both available as explicit alternate modes when a story benefits from them.

## Flow flag

Use `STITCH_FLOW_MODE` to switch between the three supported modes:

- `claude-direct` — project default. If the variable is unset, the harness assumes this mode. Claude works directly from the checked-in packet, master design, and seeded scenarios, then stops for user visual review before implementation handoff.
- `automated` — opt-in Stitch automation. Claude runs Stitch directly through the repo tooling, records the generated references, self-reviews the result, then stops for user review before implementation.
- `manual` — explicit Comet fallback. Claude writes or updates the brief, then stops so the user can run Stitch in Comet.

## Default lane behavior

- Default UI flow: Claude works directly from `docs/specs/<story-id>/ui-component-spec.md`, `docs/design/MASTER_DESIGN.md`, and the approved repo context. No Stitch generation step is required in this mode.
- Stitch-assisted flow: when `STITCH_FLOW_MODE=automated`, Claude writes `docs/specs/<story-id>/stitch-screen-brief.md`, runs `npm run stitch:story -- <story-id>`, records the generated references, reviews the generated output against the packet, then stops for user review before implementation.
- Manual Stitch browser work should use Comet, not Chrome.
- Codex may wire and verify the Stitch harness, but Codex does not design screens or generate new UI direction.

## Optional local automation

Use the local Stitch helpers when the current UI pass actually needs Stitch output, and additionally when one of these is true:

- the user explicitly wants direct Stitch generation or edits from the repo workflow
- the harness itself is being tested or debugged
- Claude needs read-only access to inspect existing Stitch projects or screens

Automation does not replace the lane split:

- Claude may use Stitch tooling only inside the UI lane.
- Codex may use read-only Stitch tooling for harness verification or to inspect already-approved references, but must not generate or redesign UI.

## Local config

Local-only environment variables:

- `STITCH_FLOW_MODE` as `claude-direct`, `automated`, or `manual`; if unset, the repo defaults to `claude-direct`
- `STITCH_API_KEY` for API-key auth
- `STITCH_PROJECT_ID` to target a specific existing project during smoke tests
- `STITCH_PROJECT_TITLE` for automatic project reuse/creation when `STITCH_PROJECT_ID` is unset
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

That means Claude can run `npm run stitch:smoke` and `npm run stitch:story -- <story-id>` from the repo without a shell-exported key when the local Stitch MCP entry is already configured.

For this workspace, the canonical Stitch project is:

- title: `TTB Label Verification System`
- current accessible project id: `3197911668966401642`

For zero ambiguity on local runs, use `STITCH_PROJECT_ID=3197911668966401642`. The harness will still fall back to the exact title above if that env var is unset.

The repo Stitch helpers are now also hardwired to prefer that canonical project id locally, so `npm run stitch:smoke` and `npm run stitch:story -- <story-id>` do not drift to a different accessible project unless you explicitly override them.

## Local commands

Read-only smoke test:

```bash
npm run stitch:smoke
```

What it does:

- connects to the Stitch MCP endpoint
- lists available tools
- lists accessible projects
- lists screens from `STITCH_PROJECT_ID` or, if unset, the first accessible project

Local stdio MCP proxy for project tooling:

```bash
npm run stitch:mcp-proxy
```

This wraps the remote Stitch MCP endpoint behind a local stdio server using `STITCH_API_KEY`.

Automated story generation from a checked-in brief:

```bash
npm run stitch:story -- <story-id>
```

This command only runs when `STITCH_FLOW_MODE=automated`. In `claude-direct` or `manual`, it exits immediately with a mode-specific guidance error.

What it does in automated flow (`STITCH_FLOW_MODE=automated`):

- reads `docs/specs/<story-id>/stitch-screen-brief.md`
- extracts the section 3 prompt
- reuses `STITCH_PROJECT_ID` or `STITCH_PROJECT_TITLE`, creating the project if needed
- runs the destructive generation call in a child process so timeout enforcement is reliable even when the Stitch client hangs
- records the pre-generation project screen list before mutation
- generates Stitch screens with the configured model and device type
- uses returned HTML and screenshot URLs directly when Stitch already marked a screen complete, and only falls back to polling `get_screen` when artifacts were not returned yet
- downloads local HTML copies when available
- writes artifacts under `docs/specs/<story-id>/stitch-refs/automated/<timestamp>/`
- appends the generated references back into `stitch-screen-brief.md`
- requires Claude to self-review the generated refs before user handoff
- stops for user review before Claude implements against the generated refs

## Automated self-review gate

After `npm run stitch:story -- <story-id>` completes, Claude should review the generated output before bringing it to the user.

Minimum self-review:

- compare the generated refs against `docs/specs/<story-id>/ui-component-spec.md`
- compare the result against `docs/specs/<story-id>/stitch-screen-brief.md`
- compare the visual direction against `docs/design/MASTER_DESIGN.md`
- check whether the generated screens cover the states and route/flow scope requested by the packet
- note any obvious mismatch, missing state, or wrong product feel before the user is asked to review

Decision rule:

- if the result is roughly on-target, Claude may hand it to the user with a recommendation and concrete review prompts
- if the result is obviously off-target, Claude should revise the brief and rerun automated Stitch before user handoff
- if repeated automated runs are still off-target, Claude should fall back to a manual Comet pass or ask the user for direction

Failure behavior:

- if the destructive generation call times out or errors, the runner writes `generation-inspection.json` into the run folder with the before/after screen lists
- do not blindly retry after a timeout; inspect that file first to see whether Stitch created screens anyway

## Claude Code MCP wiring

Project-level MCP wiring:

```bash
claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <STITCH_API_KEY>" -s project
```

Use project scope for this repo so the Stitch connection stays local to the workspace instead of becoming a global default.

## Existing project access

The Stitch tooling can connect to projects already owned by the user. The normal read path is:

1. `list_projects`
2. `list_screens`
3. `get_screen` when a specific screen needs HTML or screenshot inspection

This means the harness can inspect existing Stitch work without creating a new project first.

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

## Story workflow

### Claude lane

1. Default path (`STITCH_FLOW_MODE=claude-direct`): work directly from the checked-in packet and approved design context, self-review the result, then stop for user visual review.
2. Automated path (`STITCH_FLOW_MODE=automated`): write or update `stitch-screen-brief.md`, run `npm run stitch:story -- <story-id>`, review the generated output against the story packet and master design, then stop for user review of the generated Stitch output before implementation.
3. Manual path (`STITCH_FLOW_MODE=manual`): write or update `stitch-screen-brief.md`, then stop for the user to run Stitch manually in Comet and return image plus HTML/code references.
4. Implement `src/client/**` directly in Claude-direct mode, or from the approved Stitch references in automated/manual modes.

### Codex lane

1. Start from the approved Stitch-derived UI or Claude-direct UI and refine it when story-scoped engineering work benefits from doing so.
2. Use Stitch tooling only for harness work, read-only verification, or reference inspection when needed.
3. Redirect back to Claude only if engineering needs a new UI direction, broader redesign, or new Stitch pass.

## Blocking rules

- If the current pass is `claude-direct`, Claude should not block on Stitch.
- If `stitch-screen-brief.md` is ready and the current pass is automated, Claude should run the repo automation, self-review the result, and only then hand it to the user.
- If the automated Stitch path is expected for the current pass but neither env-based auth nor the local Stitch MCP config is available, Claude stops and asks the user to either restore the Stitch config or explicitly switch the pass to `STITCH_FLOW_MODE=manual` for a Comet fallback or `STITCH_FLOW_MODE=claude-direct` for direct implementation.
- If the current pass is manual, Claude stays blocked until the user returns the requested Stitch assets.
- If Codex needs a new UI direction, broader redesign, or a fresh Stitch pass, Codex stops and redirects to Claude.
