# Diagram Assets

This folder stores the rendered SVG diagrams used by the evaluator-facing docs packet.

- editable Mermaid source lives in [`src/`](./src)
- rendered SVG output lives beside this file
- regenerate the SVGs with `npm run docs:diagrams`

The renderer intentionally uses a tiny repo-local Node script instead of requiring Mermaid CLI so the diagram workflow stays lightweight in clean worktrees.
