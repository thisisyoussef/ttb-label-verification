# Constitution Check

## Story

- Story ID: `TTB-107`
- Title: mock Treasury auth entry and signed-in shell identity
- Lane: Claude (approved UI) + Codex (client-side engineering hardening)

## Non-negotiables

- The approved UI handoff in `docs/backlog/codex-handoffs/TTB-107.md` remains the visual source of truth.
- This story remains prototype theater. No real authentication, authorization, token exchange, cookie handling, or server session may be introduced.
- The signed-in identity stays fixed as `Sarah Chen · ALFD`.
- Sign-out must return the reviewer to Screen 0 and clear app-local working state in the current tab.
- No auth-specific value may persist to `localStorage`, `sessionStorage`, cookies, server logs, or backend routes.

## Lane-specific scope

- In scope: client-side auth transition hardening, state-reset orchestration, regression tests, packet completion, and no-persistence verification.
- Out of scope: backend auth routes, Treasury identity integration, PIV middleware, role systems, and any redesign of the approved UI.
