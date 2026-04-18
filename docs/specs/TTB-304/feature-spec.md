# Feature Spec

## Story

- Story ID: `TTB-304`
- Title: dual-image intake, CSV pairing, and toolbench loading

## Problem

COLA Cloud entries can expose more than one label image, typically a front and back label. The current workstation reduces every application to one image. That loses information in single review, breaks parity with real COLA data, and leaves batch mode unable to represent a second image per row even when the CSV and file set contain one.

The user requirement for this story is strict:

- support up to two images per application
- keep the second image optional
- carry the behavior end to end from backend to UI
- include batch mode, CSV handling, dashboard and drill-in surfaces, and toolbench sample loading

## Acceptance criteria

1. Single-label intake accepts one required primary label image plus one optional secondary label image and rejects attempts to submit more than two.
2. Single-label review routes preserve existing one-image behavior and also accept two images without persistence.
3. Cloud extraction requests include both label images when a second image is provided.
4. Batch CSV intake supports an optional second-image filename column per row.
5. Batch matching and preflight can resolve one row to one required primary image plus one optional secondary image, and unmatched state reflects missing or extra second-image files clearly.
6. Batch processing carries both images through session execution, dashboard summaries, and drill-in detail views.
7. Batch UI surfaces show a stable primary-first, secondary-second representation without introducing a new product concept or a third image state.
8. Toolbench sample loaders bring in up to two images for a single application and route them to the active mode correctly.
9. Existing one-image samples, manual uploads, and CSVs continue to work without migration steps.

## Out of scope

- support for more than two images
- durable storage of uploads, batch sessions, or results
- a broader redesign of single or batch visual language
- new compliance rules that depend on a second image beyond the existing extraction and deterministic validation pipeline
