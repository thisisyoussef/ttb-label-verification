# Technical Plan

## Scope

Create the project-wide evaluation baseline and the mechanics for recording future eval runs.

## Modules and files

- `evals/README.md` — top-level rules for when evals are required.
- `evals/labels/README.md` — corpus guidance and naming rules.
- `evals/labels/manifest.template.json` — machine-readable baseline case list.
- `evals/results/README.md` — run-log naming and minimum contents.
- `evals/results/TEMPLATE.md` — standard run-log shape.
- `docs/specs/PROJECT_STORY_INDEX.md` — queue order so implementation stories consume the corpus in the right sequence.

## Contracts

- Corpus manifest fields:
  - `id`
  - `assetPath`
  - `beverageType`
  - `scenario`
  - `expectedRecommendation`
- Eval result fields:
  - story metadata
  - cases run
  - expected vs actual outcome table
  - measured latency
  - regressions
  - follow-up

## Risks and fallback

- Risk: the real assets are not available immediately.
  - Fallback: keep placeholder paths and provenance notes in the manifest, but do not change scenario IDs later.
- Risk: later stories need per-field expectations rather than only a top-level recommendation.
  - Fallback: extend the manifest or story-specific eval brief without replacing the six baseline cases.
- Risk: manual eval logging becomes inconsistent across stories.
  - Fallback: require all stories to use the same checked-in result template.

## Testing strategy

- unit: validate any future manifest parser against the required fields.
- integration: future AI and validator stories run selected cases from this corpus.
- contract: keep the manifest machine-readable and JSON-valid.
- UI behavior: Claude seeds core single-label and batch states from the same corpus scenarios.
