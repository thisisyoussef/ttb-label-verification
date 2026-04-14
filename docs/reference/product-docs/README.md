# Product Reference Docs

These files are local copies or derived reference docs from the uploaded source material and stakeholder discovery material for this project.

## Files

- `ttb-prd-comprehensive.md`
- `ttb-product-spec-final.md`
- `ttb-implementation-roadmap-final.md`
- `ttb-user-personas.md`

## How to use them

- Read the relevant source file before implementing business rules, workflow decisions, UX details, or demo behavior.
- Read `ttb-user-personas.md` before making UX, trust, onboarding/help, dashboard, accessibility, README, or deployment-posture decisions.
- Treat these as source material, not as runnable specs. The checked-in execution contract lives in `AGENTS.md`, the presearch, and the active spec packet.
- If a source document conflicts with the repo-root contract, `AGENTS.md` and `CLAUDE.md` win. In particular, the older roadmap language saying Codex may directly refactor frontend code is superseded by the checked-in lane split in this repo.
- When a rule or decision from these docs becomes durable engineering guidance, promote it into checked-in specs, memory, or workflow docs.
