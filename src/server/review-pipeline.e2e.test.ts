/**
 * Full review pipeline end-to-end on real label images.
 *
 * This is the "does everything work together for real?" test. It
 * loads an actual .webp from `evals/labels/assets/cola-cloud/` and
 * drives the entire `runTracedReviewSurface` pipeline — OCR prepass,
 * warning OCV, anchor track, extraction merge, report shaping, per-
 * field anchor upgrade — with ONLY the VLM call stubbed.
 *
 * Why stub the VLM: calling a real VLM requires an API key, burns
 * money, and is non-deterministic. Everything else runs against
 * actual binaries (Tesseract, sharp) and real TTB label pixels so
 * the test catches regressions in:
 *
 *   - image decoding + preprocessing (sharp)
 *   - Tesseract subprocess + TSV parsing
 *   - anchor-track field matching on real OCR output
 *   - taxonomy-equivalent fallback on actual label text
 *   - field checks + anchor→check merge wiring
 *   - report shaping end to end
 *
 * Scenario strategy: each stub returns the field as ABSENT so the
 * review-report layer naturally lands that check at 'review' (the
 * "Could not read X" path). Real anchor then runs on the real
 * image; with ANCHOR_MERGE=enabled, it should upgrade to 'pass'.
 * With ANCHOR_MERGE=disabled it should stay 'review'. That gives us
 * a true A/B on the merge behavior driven entirely by real OCR.
 *
 * Suite skips automatically when `tesseract` isn't on PATH.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildExtractionPayload } from './index.test-helpers';
import { runTracedReviewSurface } from './llm-trace';
import {
  finalizeReviewExtraction,
  type ReviewExtractor
} from './review-extraction';
import { createNormalizedReviewIntake } from './review-intake';
import { applyReviewExtractorGuardrails } from './review-extractor-guardrails';
import {
  normalizeReviewExtractionModelOutput,
  reviewExtractionModelOutputSchema,
  type ReviewExtractionModelOutputSchema
} from './review-extraction-model-output';

const LABELS_ROOT = path.join(process.cwd(), 'evals/labels/assets');
const COLA_CLOUD_ROOT = path.join(LABELS_ROOT, 'cola-cloud');

function tesseractAvailable(): boolean {
  try {
    execSync('which tesseract', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function uploadFromAssetPath(assetPath: string) {
  const buffer = readFileSync(path.join(LABELS_ROOT, assetPath));
  return {
    fieldname: 'label',
    originalname: path.basename(assetPath),
    encoding: '7bit',
    mimetype: 'image/webp' as const,
    size: buffer.length,
    buffer,
    // The rest are Multer fields we don't use but the type needs.
    destination: '',
    filename: '',
    path: '',
    stream: undefined as unknown as NodeJS.ReadableStream
  };
}

function uploadFromDisk(filename: string) {
  return uploadFromAssetPath(path.join('cola-cloud', filename));
}

function intakeFromRealLabel(filename: string, fields: Record<string, string | string[] | undefined>) {
  return createNormalizedReviewIntake({
    file: uploadFromDisk(filename) as any,
    fields: {
      hasApplicationData: true,
      fields: {
        beverageTypeHint: 'auto',
        origin: 'domestic',
        varietals: [],
        ...fields
      } as any
    }
  });
}

function intakeFromAssetPath(
  assetPath: string,
  fields: Record<string, string | string[] | undefined>
) {
  return createNormalizedReviewIntake({
    file: uploadFromAssetPath(assetPath) as any,
    fields: {
      hasApplicationData: true,
      fields: {
        beverageTypeHint: 'auto',
        origin: 'domestic',
        varietals: [],
        ...fields
      } as any
    }
  });
}

/**
 * Build a ReviewExtractor stub that returns a canned extraction
 * without calling the VLM. The extraction is typed correctly so the
 * rest of the pipeline runs normally.
 */
function stubExtractor(payload: Parameters<typeof buildExtractionPayload>[0]): ReviewExtractor {
  return async () => buildExtractionPayload(payload);
}

const RUN_E2E = tesseractAvailable() && existsSync(COLA_CLOUD_ROOT);
const describeE2E = RUN_E2E ? describe : describe.skip;

// Stable extraction stub used across the merge/no-merge scenarios.
// Every field the app provides is returned ABSENT so the field-check
// layer lands at 'review'. The anchor track — running on the real
// image — is what does or doesn't upgrade those reviews.
const ABSENT_PAYLOAD = {
  beverageType: 'malt-beverage' as const,
  beverageTypeSource: 'application' as const,
  modelBeverageTypeHint: 'malt-beverage' as const,
  fields: {
    brandName: { present: false, confidence: 0.05 } as any,
    fancifulName: { present: false, confidence: 0.05 } as any,
    classType: { present: false, confidence: 0.05 } as any,
    alcoholContent: { present: false, confidence: 0.05 } as any,
    netContents: { present: false, confidence: 0.05 } as any,
    applicantAddress: { present: false, confidence: 0.05 } as any,
    countryOfOrigin: { present: false, confidence: 0.05 } as any
  }
};

function buildLowContrastAddressOvercallOutput(): ReviewExtractionModelOutputSchema {
  return reviewExtractionModelOutputSchema.parse({
    beverageTypeHint: 'wine',
    fields: {
      brandName: { present: false, value: null, confidence: 0.05, note: null },
      fancifulName: { present: false, value: null, confidence: 0.05, note: null },
      classType: { present: false, value: null, confidence: 0.05, note: null },
      alcoholContent: { present: false, value: null, confidence: 0.05, note: null },
      netContents: { present: false, value: null, confidence: 0.05, note: null },
      applicantAddress: {
        present: true,
        value: 'NORTH CAROLINA',
        confidence: 0.74,
        note: null
      },
      countryOfOrigin: {
        present: true,
        value: 'North Carolina',
        confidence: 0.88,
        note: null
      },
      ageStatement: { present: false, value: null, confidence: 0.05, note: null },
      sulfiteDeclaration: { present: false, value: null, confidence: 0.05, note: null },
      appellation: { present: false, value: null, confidence: 0.05, note: null },
      vintage: { present: false, value: null, confidence: 0.05, note: null },
      governmentWarning: { present: false, value: null, confidence: 0.05, note: null },
      varietals: []
    },
    warningSignals: {
      prefixAllCaps: { status: 'uncertain', confidence: 0.6, note: null },
      prefixBold: { status: 'uncertain', confidence: 0.52, note: null },
      continuousParagraph: { status: 'uncertain', confidence: 0.55, note: null },
      separateFromOtherContent: { status: 'uncertain', confidence: 0.58, note: null }
    },
    imageQuality: {
      score: 0.58,
      issues: ['dark label', 'low contrast text'],
      noTextDetected: false,
      note: null
    },
    summary: 'Structured extraction completed successfully.'
  });
}

describeE2E('review pipeline — real-label end-to-end', () => {
  it(
    'ANCHOR_MERGE=enabled: anchor upgrades a VLM-absent field to pass (Harpoon brand)',
    async () => {
      const intake = intakeFromRealLabel('harpoon-ale-malt-beverage.webp', {
        brandName: 'Harpoon',
        netContents: '12 fl oz'
      });
      const prev = process.env.ANCHOR_MERGE;
      process.env.ANCHOR_MERGE = 'enabled';
      try {
        const report = await runTracedReviewSurface({
          surface: '/api/review',
          extractionMode: 'cloud',
          clientTraceId: 'e2e-harpoon-enabled',
          intake,
          extractor: stubExtractor(ABSENT_PAYLOAD)
        });
        const brandCheck = report.checks.find((c) => c.id === 'brand-name');
        // VLM stub said brand absent. Real OCR sees HARPOON.
        // Anchor merge should upgrade brand to pass with user-facing
        // copy that never mentions engine internals.
        expect(brandCheck?.status).toBe('pass');
        expect(brandCheck?.summary?.toLowerCase()).not.toContain('anchor');
        expect(brandCheck?.summary?.toLowerCase()).not.toContain('ocr');
        expect(brandCheck?.details?.toLowerCase()).not.toContain('anchor');
        expect(brandCheck?.details?.toLowerCase()).not.toContain('vision model');
      } finally {
        if (prev === undefined) delete process.env.ANCHOR_MERGE;
        else process.env.ANCHOR_MERGE = prev;
      }
    },
    60_000
  );

  it(
    'ANCHOR_MERGE=enabled: literal ABV anchor beats a contradictory VLM read on a real label',
    async () => {
      const intake = intakeFromRealLabel('harpoon-ale-malt-beverage.webp', {
        brandName: 'Harpoon',
        classType: 'India Pale Ale',
        alcoholContent: '5.9% Alc./Vol.'
      });
      const prev = process.env.ANCHOR_MERGE;
      process.env.ANCHOR_MERGE = 'enabled';
      try {
        const report = await runTracedReviewSurface({
          surface: '/api/review',
          extractionMode: 'cloud',
          clientTraceId: 'e2e-harpoon-abv-literal-anchor',
          intake,
          extractor: stubExtractor({
            ...ABSENT_PAYLOAD,
            fields: {
              ...ABSENT_PAYLOAD.fields,
              alcoholContent: {
                present: true,
                value: '6.9% Alc./Vol.',
                confidence: 0.94
              } as any
            }
          })
        });
        const abvCheck = report.checks.find((c) => c.id === 'alcohol-content');

        expect(abvCheck?.status).toBe('pass');
        expect(abvCheck?.summary?.toLowerCase()).not.toContain('anchor');
        expect(abvCheck?.details?.toLowerCase()).not.toContain('anchor');
        expect(report.verdict).toBe('approve');
      } finally {
        if (prev === undefined) delete process.env.ANCHOR_MERGE;
        else process.env.ANCHOR_MERGE = prev;
      }
    },
    60_000
  );

  it(
    'ANCHOR_MERGE=disabled: same scenario stays review (legacy behavior preserved)',
    async () => {
      const intake = intakeFromRealLabel('harpoon-ale-malt-beverage.webp', {
        brandName: 'Harpoon',
        netContents: '12 fl oz'
      });
      const prev = process.env.ANCHOR_MERGE;
      process.env.ANCHOR_MERGE = 'disabled';
      try {
        const report = await runTracedReviewSurface({
          surface: '/api/review',
          extractionMode: 'cloud',
          clientTraceId: 'e2e-harpoon-disabled',
          intake,
          extractor: stubExtractor(ABSENT_PAYLOAD)
        });
        const brandCheck = report.checks.find((c) => c.id === 'brand-name');
        // Flag off → no anchor merge → brand stays 'review'. Confirms
        // the rollback path is clean if we ever need to disable.
        expect(brandCheck?.status).toBe('review');
      } finally {
        if (prev === undefined) delete process.env.ANCHOR_MERGE;
        else process.env.ANCHOR_MERGE = prev;
      }
    },
    60_000
  );

  it(
    'taxonomy-equivalent fallback upgrades country on Leitz (Rheingau → Germany)',
    async () => {
      const intake = intakeFromRealLabel('leitz-rottland-wine.webp', {
        brandName: 'Leitz',
        classType: 'Table White Wine',
        country: 'Germany'
      });
      const prev = process.env.ANCHOR_MERGE;
      process.env.ANCHOR_MERGE = 'enabled';
      try {
        const report = await runTracedReviewSurface({
          surface: '/api/review',
          extractionMode: 'cloud',
          clientTraceId: 'e2e-leitz-country',
          intake,
          extractor: stubExtractor({
            ...ABSENT_PAYLOAD,
            beverageType: 'wine' as const,
            modelBeverageTypeHint: 'wine' as const
          })
        });
        const countryCheck = report.checks.find((c) => c.id === 'country-of-origin');
        // Label prints "Rheingau", not "Germany". Anchor's
        // taxonomy-equivalent fallback maps Rheingau → Germany via
        // COUNTRY_SUBDIVISIONS and upgrades to pass.
        expect(countryCheck?.status).toBe('pass');
        // User-facing hint explains in plain language that the label
        // uses a recognized equivalent (no engine jargon).
        expect(countryCheck?.details?.toLowerCase()).toContain('recognized equivalent');
        expect(countryCheck?.details?.toLowerCase()).not.toContain('anchor');
        expect(countryCheck?.details?.toLowerCase()).not.toContain('ocr');
      } finally {
        if (prev === undefined) delete process.env.ANCHOR_MERGE;
        else process.env.ANCHOR_MERGE = prev;
      }
    },
    60_000
  );

  it(
    'low-contrast inverse label suppresses a geography-only applicant-address overcall',
    async () => {
      const intake = intakeFromAssetPath(
        'supplemental-generated/uncorked-in-mayberry-low-contrast-review.webp',
        {
          country: 'North Carolina'
        }
      );

      const report = await runTracedReviewSurface({
        surface: '/api/review',
        extractionMode: 'cloud',
        clientTraceId: 'e2e-low-contrast-address-overcall',
        intake,
        extractor: async (intakeForExtraction) => {
          const guardrailResult = applyReviewExtractorGuardrails({
            surface: '/api/review',
            extractionMode: 'cloud',
            output: buildLowContrastAddressOvercallOutput()
          });

          if (!guardrailResult.success) {
            throw new Error(guardrailResult.error.message);
          }

          return finalizeReviewExtraction({
            intake: intakeForExtraction,
            model: 'test-guardrailed-extractor',
            extracted: normalizeReviewExtractionModelOutput(guardrailResult.value),
            id: 'e2e-low-contrast-address-overcall'
          });
        }
      });

      const applicantCheck = report.checks.find((c) => c.id === 'applicant-address');
      const countryCheck = report.checks.find((c) => c.id === 'country-of-origin');

      expect(applicantCheck).toBeUndefined();
      expect(countryCheck?.status).toBe('pass');
    },
    60_000
  );
});
