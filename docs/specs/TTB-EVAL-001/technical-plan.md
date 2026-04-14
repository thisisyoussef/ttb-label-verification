# Technical Plan

## Scope

Create the project-wide golden eval baseline, the live image-backed core subset, and the mechanics for recording future eval runs.

## Modules and files

- `evals/README.md` — top-level rules for when evals are required and how slices are applied.
- `evals/golden/README.md` — slice guidance for the full golden set.
- `evals/golden/manifest.json` — machine-readable full golden case list and slice catalog.
- `evals/labels/README.md` — live image-backed core-six subset guidance and naming rules.
- `evals/labels/manifest.json` — machine-readable live-subset list.
- `evals/results/README.md` — run-log naming and minimum contents.
- `evals/results/TEMPLATE.md` — standard run-log shape.
- `docs/specs/PROJECT_STORY_INDEX.md` — queue order so implementation stories consume the corpus in the right sequence.
- `scripts/validate-evals.ts` — manifest integrity checks between the golden set and live subset.

## Contracts

- Golden manifest fields:
  - `id`
  - `slug`
  - `suiteIds`
  - `mode`
  - `beverageType`
  - `requiresLiveAsset`
  - `requiresApplicationData`
  - `expectedPrimaryResult`
- Live-subset fields:
  - `id`
  - `goldenCaseId`
  - `assetPath`
  - `beverageType`
  - `scenario`
  - `expectedRecommendation`
- Eval result fields:
  - dataset slices
  - story metadata
  - cases run
  - expected vs actual outcome table
  - measured latency
  - blocked live assets
  - regressions
  - follow-up

## Risks and fallback

- Risk: the real assets are not available immediately.
  - Fallback: keep placeholder paths and provenance notes in the live subset, but do not change golden or runtime IDs later.
- Risk: later stories need more detail than a primary outcome line.
  - Fallback: keep deeper expectations in story-specific eval briefs while preserving stable golden IDs and slices.
- Risk: manual eval logging becomes inconsistent across stories.
  - Fallback: require all stories to use the same checked-in result template.
- Risk: the live subset drifts from the golden source.
  - Fallback: validate both manifests together with `npm run evals:validate`.

## Testing strategy

- unit: validate the manifest relationship between `evals/golden/manifest.json` and `evals/labels/manifest.json`.
- integration: future AI and validator stories run selected golden slices.
- contract: keep both manifests machine-readable and JSON-valid.
- UI behavior: Claude seeds core single-label and batch states from the same golden scenarios.
