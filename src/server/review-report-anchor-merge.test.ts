/**
 * Focused tests for the per-field anchor→check upgrade path in
 * review-report-field-checks.ts. Exercises the three meaningful
 * cases: anchor absent (legacy behavior), anchor found (upgrade),
 * anchor confirms via equivalent (upgrade + note).
 */
import { describe, expect, it } from 'vitest';

import {
  reviewExtractionSchema,
  type ReviewExtraction
} from '../shared/contracts/review';
import { buildGovernmentWarningCheck } from './government-warning-validator';
import { buildVerificationReport } from './review-report';
import type { NormalizedReviewIntake } from './review-intake';
import type { AnchorTrackResult } from './anchor-field-track';

function intake(): NormalizedReviewIntake {
  const label = {
    originalName: 'label.png',
    mimeType: 'image/png',
    bytes: 8,
    buffer: Buffer.from([1, 2, 3, 4])
  };

  return {
    label,
    labels: [label],
    fields: {
      beverageTypeHint: 'auto',
      origin: 'domestic',
      varietals: [],
      brandName: 'Stones Throw',
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL'
    },
    hasApplicationData: true,
    standalone: false
  };
}

function extraction(): ReviewExtraction {
  return reviewExtractionSchema.parse({
    id: 'ext-1',
    model: 'gpt-5.4',
    beverageType: 'distilled-spirits',
    beverageTypeSource: 'class-type',
    modelBeverageTypeHint: 'distilled-spirits',
    standalone: false,
    hasApplicationData: true,
    noPersistence: true,
    imageQuality: { score: 0.9, state: 'ok', issues: [] },
    warningSignals: {
      prefixAllCaps: { status: 'yes', confidence: 0.98 },
      prefixBold: { status: 'yes', confidence: 0.9 },
      continuousParagraph: { status: 'yes', confidence: 0.9 },
      separateFromOtherContent: { status: 'yes', confidence: 0.9 }
    },
    fields: {
      brandName: { present: true, value: 'Stones Throw', confidence: 0.9 },
      fancifulName: { present: false, confidence: 0.1 },
      // class-type VLM read is plausibly mismatched — the review layer
      // would land this at 'review' without an anchor. Anchor confirms
      // the app value "Vodka" is present on the label.
      classType: { present: true, value: 'Unknown', confidence: 0.55 },
      alcoholContent: { present: true, value: '45% Alc./Vol.', confidence: 0.95 },
      netContents: { present: true, value: '750 mL', confidence: 0.95 },
      applicantAddress: { present: false, confidence: 0.1 },
      countryOfOrigin: { present: false, confidence: 0.1 },
      ageStatement: { present: false, confidence: 0.1 },
      sulfiteDeclaration: { present: false, confidence: 0.1 },
      appellation: { present: false, confidence: 0.1 },
      vintage: { present: false, confidence: 0.1 },
      governmentWarning: {
        present: true,
        value:
          'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
        confidence: 0.97
      },
      varietals: []
    },
    summary: 'ok'
  });
}

function anchorConfirming(
  fieldId: string,
  matchKind: 'literal' | 'equivalent' = 'literal',
  expected = 'Vodka',
  tokens = ['vodka']
): AnchorTrackResult {
  return {
    fields: [
      {
        field: fieldId,
        expected,
        tokens,
        tokensFound: tokens.length,
        coverage: 1,
        status: 'found',
        matchKind
      }
    ],
    ocrWordCount: 30,
    durationMs: 500,
    canFastApprove: false
  };
}

describe('buildVerificationReport anchor-merge', () => {
  it('without anchor, class-type review stays review (legacy behavior)', async () => {
    const ext = extraction();
    const report = await buildVerificationReport({
      intake: intake(),
      extraction: ext,
      warningCheck: buildGovernmentWarningCheck(ext)
      // anchorTrack omitted
    });
    const classCheck = report.checks.find((c) => c.id === 'class-type');
    expect(classCheck?.status).toBe('review');
  });

  it('with anchor found on class-type, review is upgraded to pass', async () => {
    const ext = extraction();
    const report = await buildVerificationReport({
      intake: intake(),
      extraction: ext,
      warningCheck: buildGovernmentWarningCheck(ext),
      anchorTrack: anchorConfirming('class', 'literal')
    });
    const classCheck = report.checks.find((c) => c.id === 'class-type');
    expect(classCheck?.status).toBe('pass');
    // Plain user-facing copy. No engine jargon ("anchor", "OCR",
    // "token", "vision model") should ever reach the reviewer.
    expect(classCheck?.summary).toBe('Label matches the approved record.');
    expect(classCheck?.summary?.toLowerCase()).not.toContain('anchor');
    expect(classCheck?.details?.toLowerCase()).not.toContain('anchor');
    expect(classCheck?.details?.toLowerCase()).not.toContain('ocr');
  });

  it('equivalent-match upgrade surfaces a human hint without engine jargon', async () => {
    const ext = extraction();
    const report = await buildVerificationReport({
      intake: intake(),
      extraction: ext,
      warningCheck: buildGovernmentWarningCheck(ext),
      anchorTrack: anchorConfirming('class', 'equivalent')
    });
    const classCheck = report.checks.find((c) => c.id === 'class-type');
    expect(classCheck?.status).toBe('pass');
    // Human-readable hint: tells the reviewer why it matched
    // (recognized equivalent) without naming any internal system.
    expect(classCheck?.details?.toLowerCase()).toContain('recognized equivalent');
    expect(classCheck?.details?.toLowerCase()).not.toContain('anchor');
    expect(classCheck?.details?.toLowerCase()).not.toContain('token');
  });

  it('anchor never downgrades a pass', async () => {
    const ext = extraction();
    const report = await buildVerificationReport({
      intake: intake(),
      extraction: ext,
      warningCheck: buildGovernmentWarningCheck(ext),
      // Anchor reports class as missing — should NOT affect the other
      // fields that legitimately passed.
      anchorTrack: {
        fields: [
          { field: 'class', expected: 'Vodka', tokens: ['vodka'], tokensFound: 0, coverage: 0, status: 'missing', matchKind: 'none' }
        ],
        ocrWordCount: 30,
        durationMs: 500,
        canFastApprove: false
      }
    });
    const abvCheck = report.checks.find((c) => c.id === 'alcohol-content');
    // ABV was a clean VLM match — should remain pass regardless of
    // anchor's missing signal on class.
    expect(abvCheck?.status).toBe('pass');
  });

  it('literal ABV anchor overrides a contradictory VLM read', async () => {
    const ext = reviewExtractionSchema.parse({
      ...extraction(),
      fields: {
        ...extraction().fields,
        alcoholContent: {
          present: true,
          value: '40% Alc./Vol.',
          confidence: 0.94
        }
      }
    });
    const report = await buildVerificationReport({
      intake: intake(),
      extraction: ext,
      warningCheck: buildGovernmentWarningCheck(ext),
      anchorTrack: anchorConfirming(
        'abv',
        'literal',
        '45% Alc./Vol.',
        ['45', 'alc', 'vol']
      )
    });
    const abvCheck = report.checks.find((c) => c.id === 'alcohol-content');

    expect(abvCheck?.status).toBe('pass');
    expect(abvCheck?.summary).toBe('Label matches the approved record.');
    expect(abvCheck?.extractedValue).toBe('45% Alc./Vol.');
    expect(abvCheck?.comparison?.status).toBe('match');
    expect(report.verdict).toBe('approve');
  });

  it('literal anchor fixes only the anchored row and leaves other blockers intact', async () => {
    const ext = reviewExtractionSchema.parse({
      ...extraction(),
      fields: {
        ...extraction().fields,
        brandName: { present: false, confidence: 0.05 },
        classType: { present: false, confidence: 0.05 },
        alcoholContent: {
          present: true,
          value: '40% Alc./Vol.',
          confidence: 0.94
        }
      }
    });
    const report = await buildVerificationReport({
      intake: intake(),
      extraction: ext,
      warningCheck: buildGovernmentWarningCheck(ext),
      anchorTrack: {
        fields: [
          {
            field: 'brand',
            expected: 'Stones Throw',
            tokens: ['stones', 'throw'],
            tokensFound: 2,
            coverage: 1,
            status: 'found',
            matchKind: 'literal'
          },
          {
            field: 'class',
            expected: 'Vodka',
            tokens: ['vodka'],
            tokensFound: 1,
            coverage: 1,
            status: 'found',
            matchKind: 'literal'
          }
        ],
        ocrWordCount: 30,
        durationMs: 500,
        canFastApprove: false
      }
    });
    const brandCheck = report.checks.find((c) => c.id === 'brand-name');
    const classCheck = report.checks.find((c) => c.id === 'class-type');
    const abvCheck = report.checks.find((c) => c.id === 'alcohol-content');

    expect(brandCheck?.status).toBe('pass');
    expect(classCheck?.status).toBe('pass');
    expect(abvCheck?.status).toBe('fail');
    expect(report.verdict).toBe('reject');
  });
});
