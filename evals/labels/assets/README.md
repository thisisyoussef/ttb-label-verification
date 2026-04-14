# Label Asset Slots

These are the expected live-eval filenames referenced by `../manifest.json`.

They correspond to the golden `core-six` slice:

- `perfect-spirit-label.png`
- `spirit-warning-errors.png`
- `spirit-brand-case-mismatch.png`
- `wine-missing-appellation.png`
- `beer-forbidden-abv-format.png`
- `low-quality-image.png`

The binary files now exist as internally generated synthetic fixtures created on `2026-04-14`
with `npm run generate:label-assets -- --force`.

Generation notes:

- source: Gemini image generation via the Google GenAI SDK
- default model in the helper script: `gemini-3.1-flash-image-preview`
- helper script: `scripts/generate-live-label-assets.ts`

Important caveats:

- These images are suitable for internal extraction smoke tests and image-backed harness work.
- They are not legal/compliance source material and should not be treated as authoritative
  examples of valid TTB label wording or typography.
- OCR-like defects are expected in several assets by design, and some "clean" fixtures still
  contain model-generated text imperfections. Keep deterministic rule expectations tied to the
  checked-in golden fixtures and packet docs, not to the image generator.
