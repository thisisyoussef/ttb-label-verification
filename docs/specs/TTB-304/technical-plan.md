# Technical Plan

## Lookup brief

### Local findings

- single review intake still assumes one uploaded file at the route boundary and in normalized intake contracts
- batch CSV, matching, session types, dashboard rows, and drill-in helpers still model one image per row
- toolbench sample loading is already mode-aware after `TTB-303`, but sample payloads still collapse to one image
- official COLA Cloud docs and the repo's own eval loaders both confirm that an entry may have multiple images, commonly front and back

### Blast radius

- server intake and request normalization
- shared review and batch contracts
- cloud extractor request builders
- batch CSV parsing, matching, preflight, session execution, and dashboard data
- single-label intake UI, batch upload and matching UI, batch dashboard and drill-in UI, toolbench sample loaders
- help and guided-tour surfaces that target intake or batch upload controls

### Dependent flows to verify

- single-label upload, retry, and streamed review
- batch CSV upload, matching review, preflight reruns, processing, dashboard, drill-in, and export
- toolbench direct sample loading in both single and batch modes

## Planned changes

1. Add failing tests that prove the current one-image assumptions break for:
   - single review route intake
   - batch CSV parsing and matching
   - toolbench sample loading and client mode routing
2. Evolve intake contracts from one `label` to one required primary image plus one optional secondary image while preserving a compatibility path for existing single-image callers.
3. Update cloud extractor request builders so model inputs can contain both images in order.
4. Extend batch row, match, session, and dashboard contracts to carry `primary` and optional `secondary` image references for each application row.
5. Extend CSV handling with an optional second-image filename column and preflight messaging for missing or extra secondary files.
6. Update single and batch UI surfaces to expose exactly two slots, no more:
   - single intake: primary plus optional second image
   - batch matching: per-row primary and optional second file
   - batch dashboard and drill-in: paired preview surfaces
   - toolbench: load up to two images when available
7. Keep privacy and performance instrumentation aligned with the new two-image path.

## Risks

- helper paths that still alias one image may silently drop the second image if contracts are only partially updated
- batch matching can misclassify secondary files as unmatched if row-level pairing is not wired all the way through preflight and session creation
- two-image cloud requests may increase latency on the single-label path enough to threaten the current five-second budget
- help targets that refer to upload controls can drift if the two-slot UI changes control structure or `data-tour-target` anchors

## 2026-04-19 counterpart reload follow-up

- The original stored COLA corpus predated the shipped multi-image path, so many checked-in records still retained only the primary asset even when COLA Cloud exposed a counterpart image.
- `scripts/data/fetch-cola-cloud-labels.ts` now supports refreshing the existing stored COLA ids in place, retaining up to two preferred assets per record and recording counterpart metadata (`secondaryAssetPath`, `secondaryImageUrl`) without rotating the corpus.
- `scripts/data/generate-cola-cloud-batch-fixtures.ts` now emits `secondary_filename` in batch CSVs and flattens actual image cases with `sampleId` and `isSecondary`, so batch packs can upload every stored file while single-sample surfaces remain grouped by the original sample id.
- `/api/eval/sample` and the built-in Toolbench fallback now hydrate ordered `images` arrays from the refreshed stored files instead of collapsing back to one image.
