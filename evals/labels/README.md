# Live Label Subset

Store or reference the live image-backed core-six subset here.

This directory is not the full golden set.

- Full golden source of truth: `../golden/manifest.json`
- Live image-backed subset for default seeded UI, demo, and first live extraction slice: `manifest.json`

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

## Asset guidance

- Prefer stable filenames and keep them aligned with manifest IDs.
- Put real live-eval binaries under `assets/` using the filenames from `manifest.json`.
- If the real assets are stored elsewhere temporarily, keep the intended paths and notes in `manifest.json` until the files are added.
- Do not silently swap a scenario without updating the manifest and relevant eval records.
- Do not expand this file into the full golden catalog. New cases belong in `../golden/manifest.json` first and only move here when they become part of the live image-backed default subset.
