# TTB-108 UI Component Spec — Extraction Mode Selector

## 1. Problem

The workstation currently runs one implicit extraction path. When the dual-mode architecture (cloud + local) lands, the UI needs a way to let the reviewer pick the extraction mode without cluttering the primary review flow. The selector exists for Marcus (deployment story validation) and Sarah (demo credibility), not for Dave's daily throughput.

The previous vendor pilot failed because TTB's network firewall blocked outbound ML calls. Local mode is the deployment-realistic default — it demonstrates that the tool works without leaving the network. Cloud mode is the optional demo upgrade for unrestricted environments.

## 2. Users & use cases

- **Marcus Williams** signs in, sees Local is the default, opens the tooltip, reads that it matches his restricted-network requirement. Trust earned without a single extra click.
- **Sarah Chen** demos to leadership: starts in Local to show deployment credibility, then switches to Cloud to show best-case extraction quality.
- **Dave Morrison** never changes the default. Local is fine. He reviews labels.
- **Jenny Park** notices the mode selection during sign-in, reads the tooltip for Local, and understands why some layout checks show "Review" more often.

## 3. UX flows

### Mode selection (part of auth flow)

1. User signs in via PIV or SSO → success screen auto-advances to **mode selection step**.
2. Mode selection shows two radio options in the auth card: `Local (on-premise)` (default, pre-selected) and `Cloud (demo)`.
3. Each option has a `?` button that toggles a contextual explanation grounded in the actual project constraints.
4. User clicks "Continue to workstation" → enters the signed-in app.

### In-session mode change

5. The header shows a compact read-only mode indicator (icon + label) next to the identity badge.
6. A small "Switch to Cloud" / "Switch to Local" link lets the user change mode without signing out.
7. During processing, the link is hidden (no mid-pipeline mode switches).

### Processing copy variants

8. Cloud mode: standard pipeline copy.
9. Local mode: header suffix "— local extraction" and body copy explaining local extraction limitations.

### Local-mode unavailable state

10. If the user verifies with Local selected but the backend cannot run local extraction, a caution-colored alert appears with "Switch to Cloud" as the primary recovery action.

### Sign-out reset

11. Sign-out resets extraction mode to Local (the deployment-realistic default).

## 4. IA / layout

### Auth flow placement

The mode selector appears as a step in the auth card, between the success confirmation and the signed-in workstation. It uses the same card frame, heading style, and button style as the rest of the auth flow.

### Header indicator

A small read-only badge in the header right section (between Help and Identity):

```
[... Fixtures | Help | [icon] Local · Switch to Cloud | Identity ...]
```

## 5. States

### Auth mode selection

- **Local (default):** Pre-selected radio with hard-drive icon. Highlighted border.
- **Cloud:** Unselected radio with cloud icon. Quiet border.
- **Tooltip expanded:** Inline explanation panel below the option.

### Header indicator

- **Resting:** Icon + mode label + small "Switch to X" link.
- **During processing:** Icon + mode label only. No switch link.

### Processing screen

- **Cloud mode:** "Reviewing this label" / standard pipeline copy.
- **Local mode:** "Reviewing this label — local extraction" / local limitations copy.
- **Sidebar:** "Extraction mode: Cloud" or "Extraction mode: Local (offline)".

### Local unavailable

- Caution-colored alert with cloud_off icon, explanation copy, "Switch to Cloud" primary action, and "Back to intake" secondary action.

## 6. Copy & microcopy

| Element | Copy |
|---|---|
| Auth heading | Welcome, {name}. |
| Auth subheading | Choose how this workstation processes label images. |
| Local option label | `Local (on-premise)` |
| Local option description | All extraction runs on this workstation. No label data leaves the network. Required for restricted-network and FedRAMP-aligned deployments. |
| Local tooltip | TTB's network firewall blocks outbound traffic to external ML endpoints. The previous scanning vendor pilot failed because their cloud ML calls were blocked. Local mode avoids this entirely. |
| Cloud option label | `Cloud (demo)` |
| Cloud option description | Routes extraction through cloud vision models for higher accuracy on complex labels. Requires outbound network access. |
| Cloud tooltip | Cloud mode uses hosted vision models that perform better on bold-text detection, spatial layout, and government warning formatting. Use this when demonstrating best-case extraction quality on an unrestricted network. |
| Continue button | Continue to workstation |
| Local processing header suffix | — local extraction |
| Local processing body | Running extraction locally. This may take longer than cloud mode and may produce more Review outcomes on layout and formatting checks. |
| Local unavailable alert | Local extraction is not available on this workstation. Switch to Cloud mode to continue. |

## 7. Accessibility / privacy / performance constraints

- Radio buttons are keyboard-reachable via Tab and operable via Arrow keys.
- Fieldset has `aria-label="Extraction mode"`.
- Tooltip toggle buttons have `aria-label="Why {option label}"`.
- No extraction mode choice is persisted. Tab-scoped React state only.

## 8. Data and evidence needs from backend

- Codex wires the selected mode into the `POST /api/review` request body.
- Backend responds with a mode-unavailable error using the existing `ReviewError` contract.
- No new contract fields needed from Claude's lane.

## 9. Frozen design constraints for Codex

- Extraction mode is tab-scoped React state. No persistence.
- **Local is the default.** Always.
- Mode resets to Local on sign-out.
- Provider names (Gemini, OpenAI, Ollama, Qwen) must not appear in the reviewer-facing surface.
- The mode-select auth phase must not be skippable — user always passes through it.

## 10. Open questions

- None for the Claude lane.
