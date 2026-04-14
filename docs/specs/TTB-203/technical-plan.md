# Technical Plan

## Scope

Implement the first live model-backed extraction layer for a single label and optional application data.

## Planned modules

- `src/shared/contracts/review.ts`
  - add the typed extraction contract shared across server modules and future validators
- `src/server/review-extraction.ts`
  - pure extraction-domain helpers, including beverage-type resolution and image-quality normalization
- `src/server/openai-review-extractor.ts`
  - OpenAI Responses adapter, prompt, request builder, and runtime config checks
- `src/server/index.ts`
  - expose an extraction-only route while preserving the seeded full-review route until `TTB-205`

## Contract shape

- request:
  - one label file in memory
  - optional application fields from `src/server/review-intake.ts`
- extraction response:
  - typed extracted fields with `present`, `value`, `confidence`, and optional notes
  - warning-specific visual signals for all-caps, boldness, continuity, and separation
  - image-quality score plus explicit uncertainty state
  - resolved beverage type and source (`application`, `class-type`, `model-hint`, or strict fallback)
  - standalone metadata derived from intake

## Integration notes

- Use `responses.parse(...)` with a Zod-backed structured output schema.
- Send images as `input_image` data URLs and PDFs as `input_file` Base64 data URLs to avoid durable file uploads.
- Keep the prompt extraction-only. Do not ask the model for a final pass/review/reject recommendation.
- Surface config failures as structured adapter errors so the missing-env case is explicit.

## Risks and fallback

- Risk: the model returns partial or refused structured output.
  - Fallback: convert that condition into a structured adapter error rather than synthesizing fake extraction data.
- Risk: beverage-type hints conflict across application input, extracted class/type, and model hint.
  - Fallback: prefer application input, then deterministic class/type inference, then model hint, then strict fallback.
- Risk: local live verification still needs the real label binaries referenced by `evals/labels/manifest.json`.
  - Fallback: land the tested adapter, run `npm run env:bootstrap` for local runtime config, and document the exact missing asset paths in the story artifacts if the live slice cannot run yet.
