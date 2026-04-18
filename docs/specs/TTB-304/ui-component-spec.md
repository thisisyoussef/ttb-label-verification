# UI Component Spec

## Story

- Story ID: `TTB-304`
- Title: dual-image intake, CSV pairing, and toolbench loading
- Lane: Codex under explicit user authorization for story-scoped UI plus engineering work

## Direction

This story extends the existing visual system. It does not introduce a new screen family or a new evidence model. The rule is simple everywhere: the workstation may show one required primary label image and one optional secondary image, always in that order.

## Single review

- Rename the upload group conceptually to `Label images`.
- Keep the existing primary slot behavior for the first image.
- Add a second slot labeled `Optional second image`.
- Supporting copy should explain that the second slot is for a back label or supporting panel.
- Submission stays blocked until the primary slot is filled.
- Removing the second image must not disturb the primary image state.

## Batch upload and matching

- CSV helper copy mentions an optional second-image filename column per row.
- Matching review shows each row as a pair: `Primary image` and `Optional second image`.
- If the CSV expects a second image and it is missing, the row stays visibly incomplete.
- If the second image exists, present it as part of the row, not as a separate application.

## Batch dashboard and drill-in

- Batch summary and table rows preserve current density.
- Where a thumbnail or preview surface exists, show a stable paired preview when a second image is present.
- Drill-in keeps the existing results experience and adds the second image as part of the same review set, with a larger active preview, quick front/back switching, and an easy full-size expand path while the checklist stays visible.

## Results and processing rails

- The pinned review rail should treat front and back as one gallery, not one large image plus one tiny afterthought.
- Results should default to a large active preview, keep both images visible as switch targets, and provide an explicit expand action without pushing the checklist off screen.
- Processing can use the same model with a lighter footprint so the reviewer understands that two images are attached before the report lands.

## Toolbench

- Sample actions may load up to two images.
- Copy should stay direct and mention that some COLA entries include front and back labels.
- Mode-aware routing from `TTB-303` remains intact for both images.
