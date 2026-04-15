# Live Label Subsets

Store or reference the checked-in live image-backed subsets here.

This directory is not the full golden set.

- Full golden source of truth: `../golden/manifest.json`
- Live image-backed subset for default seeded UI, demo, and first live extraction slice: `manifest.json`
- Checked-in synthetic 20-case latency slice for Gemini benchmarking: `latency-twenty.manifest.json`

## Core-six scenarios

Use `manifest.json` as the canonical list of the six live core cases:

- perfect spirit label
- warning text defect
- cosmetic brand mismatch
- wine dependency failure
- forbidden beer ABV format
- low-quality image

Each case keeps its stable runtime slug (`id`) plus the mapped golden case id (`goldenCaseId`).

`manifest.template.json` remains as a shape/reference file for future live-subset edits.

## Latency-twenty scenario set

Use `latency-twenty.manifest.json` for the checked-in synthetic 20-case live image-backed slice used by `TTB-209` benchmarking.

That slice extends the core-six with checked-in beverage, format, dependency, and warning-edge cases while preserving the same stable runtime slugs and golden-case mappings.

## Asset guidance

- Prefer stable filenames and keep them aligned with manifest IDs.
- Put real live-eval binaries under `assets/` using the filenames from `manifest.json`.
- Put checked-in live-eval binaries under `assets/` using the filenames from the relevant manifest.
- If the real assets are stored elsewhere temporarily, keep the intended paths and notes in the relevant checked-in manifest until the files are added.
- Do not silently swap a scenario without updating the manifest and relevant eval records.
- Do not expand any live subset file into the full golden catalog. New cases belong in `../golden/manifest.json` first and only move here when they become part of a checked-in live image-backed subset.
