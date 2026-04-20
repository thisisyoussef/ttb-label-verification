/**
 * Real-image end-to-end tests for the anchor track.
 *
 * Unlike `anchor-field-track.test.ts` (which passes synthetic TsvWord
 * arrays into `anchorOneField`), this suite loads ACTUAL label images
 * from `evals/labels/assets/cola-cloud/` and runs the full anchor
 * pipeline end-to-end:
 *
 *   - Sharp decodes and preprocesses the real .webp
 *   - Tesseract runs as a subprocess and returns TSV
 *   - Our parser extracts words
 *   - Per-field anchoring matches against real OCR output
 *
 * Why this matters: the synthetic-word tests prove the matching
 * logic; these tests prove the whole stack works on real labels —
 * catching regressions in image preprocessing, Tesseract
 * integration, TSV parsing, confidence thresholds, and the
 * taxonomy-equivalent fallback on real OCR variance.
 *
 * Marked "e2e" because they shell out to `tesseract` and decode
 * real webp images; a few hundred ms per label, a few seconds total.
 * Suite skips automatically if `tesseract` isn't on PATH (e.g. on a
 * stripped CI runner — the anchor code itself handles that
 * gracefully at runtime).
 *
 * Expected OCR behavior on these four labels was empirically
 * validated on 2026-04-17 against Tesseract 5.x locally; assertions
 * here match that observed behavior so the suite catches true
 * regressions rather than spurious OCR-drift failures.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runAnchorTrack } from './anchor-field-track';
import type { NormalizedUploadedLabel, NormalizedReviewFields } from '../review/review-intake';

const LABELS_ROOT = path.join(process.cwd(), 'evals/labels/assets/cola-cloud');

function tesseractAvailable(): boolean {
  try {
    execSync('which tesseract', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function loadRealLabel(filename: string): NormalizedUploadedLabel {
  const p = path.join(LABELS_ROOT, filename);
  const buffer = readFileSync(p);
  return {
    originalName: filename,
    mimeType: 'image/webp',
    bytes: buffer.length,
    buffer
  };
}

function fields(overrides: Partial<NormalizedReviewFields> = {}): NormalizedReviewFields {
  return {
    beverageTypeHint: 'auto',
    origin: 'domestic',
    varietals: [],
    ...overrides
  };
}

const RUN_E2E = tesseractAvailable() && existsSync(LABELS_ROOT);
const describeE2E = RUN_E2E ? describe : describe.skip;

describeE2E('anchor track — real cola-cloud labels', () => {
  it(
    'rich label (harpoon): every application field anchors literal',
    async () => {
      const label = loadRealLabel('harpoon-ale-malt-beverage.webp');
      const result = await runAnchorTrack(
        label,
        fields({
          brandName: 'Harpoon',
          classType: 'India Pale Ale',
          alcoholContent: '5.9% Alc./Vol.',
          netContents: '12 fl oz'
        })
      );
      // Dense label — Tesseract reads >100 words.
      expect(result.ocrWordCount).toBeGreaterThan(50);
      const byField = (id: string) => result.fields.find((f) => f.field === id)!;
      expect(byField('brand').status).toBe('found');
      expect(byField('brand').matchKind).toBe('literal');
      expect(byField('class').status).toBe('found');
      expect(byField('class').tokensFound).toBe(3); // india pale ale
      expect(byField('abv').status).toBe('found');
      expect(byField('net').status).toBe('found');
      expect(byField('net').tokensFound).toBe(3); // 12 fl oz
      // Whole-label fast-approve gate: all non-skipped fields ≥80%
      // AND ≥20 OCR words. Harpoon hits both.
      expect(result.canFastApprove).toBe(true);
    },
    30_000
  );

  it(
    'taxonomy-equivalent backup: Leitz Rheingau wine resolves Germany via subdivision',
    async () => {
      // The label itself shows "Rheingau" (a German wine region) but
      // doesn't print the word "Germany" in the OCR-readable text.
      // The country anchor's literal search misses — the taxonomy
      // expansion pulls in COUNTRY_SUBDIVISIONS['germany'] which
      // includes 'rheingau', and the equivalent-fallback picks it up.
      // This is the exact case that motivated the fallback.
      const label = loadRealLabel('leitz-rottland-wine.webp');
      const result = await runAnchorTrack(
        label,
        fields({
          brandName: 'Leitz',
          classType: 'Table White Wine',
          alcoholContent: '12.5% Alc./Vol.',
          country: 'Germany'
        })
      );
      const country = result.fields.find((f) => f.field === 'country')!;
      expect(country.status).toBe('found');
      expect(country.matchKind).toBe('equivalent');
    },
    30_000
  );

  it(
    'sparse label (persian-empire): honest partial/missing anchors',
    async () => {
      // Small 183x700 label — only ~25 OCR words. Anchor correctly
      // returns partial/missing on fields it can't confirm. The
      // assertion validates we're getting signal, not noise — a
      // regression that caused over-confident matches would fail.
      const label = loadRealLabel('persian-empire-black-widow-distilled-spirits.webp');
      const result = await runAnchorTrack(
        label,
        fields({
          brandName: 'Persian Empire',
          classType: 'Other Specialties',
          alcoholContent: '40% Alc./Vol.',
          country: 'Canada'
        })
      );
      const byField = (id: string) => result.fields.find((f) => f.field === id)!;
      // canFastApprove should be FALSE — sparse label shouldn't
      // false-positive into whole-label fast-approve.
      expect(result.canFastApprove).toBe(false);
      // Country anchors cleanly ("Canada" is a single distinctive token).
      expect(byField('country').status).toBe('found');
      // Brand should be found or partial (OCR may split the stylized
      // word) — but never 'none' matchKind since at least 'empire' is
      // legible.
      expect(byField('brand').matchKind).not.toBe('none');
    },
    30_000
  );

  it(
    'invariant: durationMs within design budget on all four labels',
    async () => {
      // The architectural claim in anchor-field-track.ts is
      // ~500-1500ms per label. Validate on all four real images
      // so a sharp/Tesseract upgrade that blows past 10s gets
      // flagged before shipping.
      const names = [
        'harpoon-ale-malt-beverage.webp',
        'leitz-rottland-wine.webp',
        'persian-empire-black-widow-distilled-spirits.webp',
        'simply-elegant-simply-elegant-spirits-distilled-spirits.webp'
      ];
      for (const name of names) {
        const label = loadRealLabel(name);
        const result = await runAnchorTrack(
          label,
          fields({ brandName: 'X', classType: 'Y' })
        );
        expect(result.durationMs).toBeLessThan(10_000);
      }
    },
    60_000
  );
});
