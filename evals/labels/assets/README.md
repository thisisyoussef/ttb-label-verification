# Label Asset Slots

These are the expected live-eval filenames referenced by the checked-in manifests in `../`.

The default `manifest.json` core-six subset uses:

- `perfect-spirit-label.png`
- `spirit-warning-errors.png`
- `spirit-brand-case-mismatch.png`
- `wine-missing-appellation.png`
- `beer-forbidden-abv-format.png`
- `low-quality-image.png`

The checked-in `latency-twenty.manifest.json` slice additionally uses:

- `perfect-beer-label.png`
- `beer-unqualified-geographic-style.png`
- `wine-multiple-varietals-valid.png`
- `wine-multiple-varietals-invalid-total.png`
- `wine-table-wine-exemption.png`
- `spirits-abv-abbreviation.png`
- `spirits-net-contents-us-measures.png`
- `beer-net-contents-metric-primary.png`
- `spirits-proof-not-parenthesized.png`
- `imported-without-country-of-origin.png`
- `whisky-age-ambiguity.png`
- `wine-varietal-without-appellation.png`
- `wine-vintage-with-appellation.png`
- `warning-completely-missing.png`

The binary files now exist as internally generated synthetic fixtures created on `2026-04-14`
with `npm run generate:label-assets -- --force` for the core-six subset and
`npm run generate:label-assets -- --manifest latency-twenty.manifest.json --force`
for the broader latency slice.

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
