/**
 * Unit tests for the multi-label stage merges.
 *
 * We test the pure merge helpers directly because the fan-out wrappers
 * just call Promise.all + delegate. Each merge is exercised for:
 *   1. identity on a 1-element array (single-image agnostic)
 *   2. the canonical multi-image case
 *   3. adversarial edges (all-fail, one-side-empty, disagreement)
 */

import { describe, expect, it } from 'vitest';

import type { AnchorTrackResult, FieldAnchor } from '../anchors/anchor-field-track';
import {
  mergeAnchorTrackResults,
  mergeOcrPrepassResults,
  mergeSpiritsColocationResults,
  mergeVlmRegionDetectionResults,
  mergeWarningOcrCrossCheckResults,
  mergeWarningOcvResults
} from './multi-label-stages';
import type { OcrPrepassResult } from './ocr-prepass';
import type { SpiritsColocationResult } from '../validators/spirits-colocation-check';
import type { RegionOcrResult, VlmRegionDetectionResult } from './vlm-region-detector';
import type { OcrCrossCheckResult } from '../validators/warning-ocr-cross-check';
import type { WarningOcvResult } from '../validators/warning-region-ocv';

function okOcr(text: string, preprocessing: string[] = ['normalize']): OcrPrepassResult {
  return { status: 'ok', text, durationMs: 100, preprocessingApplied: preprocessing };
}

function degradedOcr(text: string): OcrPrepassResult {
  return {
    status: 'degraded',
    text,
    durationMs: 100,
    reason: 'minimal-text-extracted',
    preprocessingApplied: ['normalize']
  };
}

function failedOcr(reason: string): OcrPrepassResult {
  return { status: 'failed', reason, durationMs: 50 };
}

describe('mergeOcrPrepassResults', () => {
  it('is identity on a single result', () => {
    const solo = okOcr('GOVERNMENT WARNING...');
    expect(mergeOcrPrepassResults([solo])).toBe(solo);
  });

  it('concatenates successful texts with per-image section markers', () => {
    const merged = mergeOcrPrepassResults([
      okOcr('BRAND FRONT TEXT', ['normalize']),
      okOcr('GOVERNMENT WARNING...', ['denoise'])
    ]);
    expect(merged.status).toBe('ok');
    if (merged.status === 'ok') {
      expect(merged.text).toContain('--- LABEL IMAGE 1 ---\nBRAND FRONT TEXT');
      expect(merged.text).toContain('--- LABEL IMAGE 2 ---\nGOVERNMENT WARNING...');
      expect(merged.preprocessingApplied.sort()).toEqual(['denoise', 'normalize']);
    }
  });

  it('downgrades to degraded when any child was degraded', () => {
    const merged = mergeOcrPrepassResults([okOcr('clean'), degradedOcr('ok but short')]);
    expect(merged.status).toBe('degraded');
  });

  it('skips failed children but keeps their position index for successes', () => {
    const merged = mergeOcrPrepassResults([failedOcr('no-text'), okOcr('BACK LABEL')]);
    expect(merged.status).toBe('ok');
    if (merged.status === 'ok') {
      expect(merged.text).toContain('--- LABEL IMAGE 2 ---\nBACK LABEL');
      expect(merged.text).not.toContain('--- LABEL IMAGE 1 ---');
    }
  });

  it('returns the first failure verbatim when every child failed', () => {
    const first = failedOcr('no-text');
    const merged = mergeOcrPrepassResults([first, failedOcr('tesseract-unavailable')]);
    expect(merged.status).toBe('failed');
  });
});

function okOcv(status: WarningOcvResult['status'], similarity: number): WarningOcvResult {
  return {
    status,
    similarity,
    extractedText: 'GOVERNMENT WARNING...',
    editDistance: similarity === 1 ? 0 : 5,
    headingAllCaps: true,
    confidence: 0.9,
    durationMs: 300
  };
}

describe('mergeWarningOcvResults', () => {
  it('is identity on a single result', () => {
    const solo = okOcv('verified', 0.95);
    expect(mergeWarningOcvResults([solo])).toBe(solo);
  });

  it('picks verified when any image verified', () => {
    const merged = mergeWarningOcvResults([okOcv('not-found', 0), okOcv('verified', 0.95)]);
    expect(merged.status).toBe('verified');
    expect(merged.durationMs).toBe(600);
  });

  it('falls back to partial when no image verified but some partial matched', () => {
    const merged = mergeWarningOcvResults([okOcv('not-found', 0), okOcv('partial', 0.7)]);
    expect(merged.status).toBe('partial');
  });

  it('returns not-found when every image was not-found', () => {
    const merged = mergeWarningOcvResults([okOcv('not-found', 0), okOcv('not-found', 0)]);
    expect(merged.status).toBe('not-found');
  });
});

function anchor(
  field: string,
  tokensFound: number,
  tokensTotal: number,
  status: FieldAnchor['status'] = 'found'
): FieldAnchor {
  const coverage = tokensTotal === 0 ? 1 : tokensFound / tokensTotal;
  return {
    field,
    expected: 'expected',
    tokens: new Array(tokensTotal).fill('tok'),
    tokensFound,
    coverage,
    status,
    matchKind: tokensFound > 0 ? 'literal' : 'none'
  };
}

function anchorResult(fields: FieldAnchor[], ocrWordCount: number): AnchorTrackResult {
  const nonSkipped = fields.filter((a) => a.status !== 'skipped');
  const allStrong = nonSkipped.length > 0 && nonSkipped.every((a) => a.status === 'found');
  return {
    fields,
    ocrWordCount,
    durationMs: 500,
    canFastApprove: allStrong && ocrWordCount >= 20
  };
}

describe('mergeAnchorTrackResults', () => {
  it('is identity on a single result', () => {
    const solo = anchorResult([anchor('brand', 2, 2)], 40);
    expect(mergeAnchorTrackResults([solo])).toBe(solo);
  });

  it('picks the per-field anchor with the highest tokensFound', () => {
    const front = anchorResult([anchor('brand', 2, 2), anchor('warning', 0, 5, 'missing')], 40);
    const back = anchorResult([anchor('brand', 0, 2, 'missing'), anchor('warning', 5, 5)], 35);
    const merged = mergeAnchorTrackResults([front, back]);
    const brandAnchor = merged.fields.find((a) => a.field === 'brand')!;
    const warningAnchor = merged.fields.find((a) => a.field === 'warning')!;
    expect(brandAnchor.tokensFound).toBe(2);
    expect(warningAnchor.tokensFound).toBe(5);
  });

  it('sums ocrWordCount across images so the fast-approve word floor sees the union', () => {
    const front = anchorResult([anchor('brand', 2, 2)], 10);
    const back = anchorResult([anchor('warning', 5, 5)], 15);
    const merged = mergeAnchorTrackResults([front, back]);
    expect(merged.ocrWordCount).toBe(25);
  });

  it('recomputes canFastApprove from the merged field list', () => {
    const front = anchorResult([anchor('brand', 2, 2), anchor('warning', 0, 5, 'missing')], 30);
    const back = anchorResult([anchor('brand', 2, 2), anchor('warning', 5, 5)], 30);
    const merged = mergeAnchorTrackResults([front, back]);
    expect(merged.canFastApprove).toBe(true);
  });
});

function region(field: string, found: boolean, verified = false, text: string | null = null): RegionOcrResult {
  return { field, found, verified, ocrText: text, source: 'vlm-guided-ocr' };
}

describe('mergeVlmRegionDetectionResults', () => {
  it('is identity on a single result', () => {
    const solo: VlmRegionDetectionResult = {
      regions: [region('government_warning', true, true, 'GOVERNMENT WARNING...')],
      durationMs: 500
    };
    expect(mergeVlmRegionDetectionResults([solo])).toBe(solo);
  });

  it('prefers the verified region across images, de-duped by field', () => {
    const front: VlmRegionDetectionResult = {
      regions: [region('government_warning', false)],
      durationMs: 500
    };
    const back: VlmRegionDetectionResult = {
      regions: [region('government_warning', true, true, 'verified text')],
      durationMs: 500
    };
    const merged = mergeVlmRegionDetectionResults([front, back]);
    expect(merged.regions).toHaveLength(1);
    expect(merged.regions[0]!.verified).toBe(true);
    expect(merged.regions[0]!.ocrText).toBe('verified text');
  });

  it('unions fields that appear only in one image', () => {
    const front: VlmRegionDetectionResult = {
      regions: [region('brand_name', true, true, 'BRAND')],
      durationMs: 500
    };
    const back: VlmRegionDetectionResult = {
      regions: [region('government_warning', true, true, 'GW')],
      durationMs: 500
    };
    const merged = mergeVlmRegionDetectionResults([front, back]);
    const fields = merged.regions.map((r) => r.field).sort();
    expect(fields).toEqual(['brand_name', 'government_warning']);
  });
});

describe('mergeWarningOcrCrossCheckResults', () => {
  it('is identity on a single result', () => {
    const solo: OcrCrossCheckResult = { status: 'agree', ocrText: 'GW', editDistance: 1 };
    expect(mergeWarningOcrCrossCheckResults([solo])).toBe(solo);
  });

  it('agree anywhere wins over abstain or disagree', () => {
    const merged = mergeWarningOcrCrossCheckResults([
      { status: 'abstain', reason: 'warning-not-found-in-ocr' },
      { status: 'agree', ocrText: 'GW', editDistance: 2 }
    ]);
    expect(merged.status).toBe('agree');
  });

  it('disagree is preserved when no image agreed', () => {
    const merged = mergeWarningOcrCrossCheckResults([
      { status: 'abstain', reason: 'warning-not-found-in-ocr' },
      { status: 'disagree', ocrText: 'GW garbled', editDistance: 14 }
    ]);
    expect(merged.status).toBe('disagree');
  });

  it('all abstain stays abstain', () => {
    const merged = mergeWarningOcrCrossCheckResults([
      { status: 'abstain', reason: 'a' },
      { status: 'abstain', reason: 'b' }
    ]);
    expect(merged.status).toBe('abstain');
  });
});

function coloc(colocated: boolean, confidence = 0.9): SpiritsColocationResult {
  return {
    colocated,
    primaryPanelDescription: 'front',
    missingFromPrimary: colocated ? [] : ['alcohol-content'],
    confidence,
    reason: colocated ? 'all three visible' : 'alcohol-content missing'
  };
}

describe('mergeSpiritsColocationResults', () => {
  it('is identity on a single non-null result', () => {
    const solo = coloc(true);
    expect(mergeSpiritsColocationResults([solo])).toBe(solo);
  });

  it('passes when any panel satisfies the rule', () => {
    const merged = mergeSpiritsColocationResults([coloc(false, 0.8), coloc(true, 0.9)]);
    expect(merged?.colocated).toBe(true);
  });

  it('never cross-unions — two partial panels do not satisfy § 5.61', () => {
    // Even if image A has brand+class and image B has abv, the rule
    // still fails — the merged result is a miss.
    const aMissesAbv = coloc(false, 0.9);
    const bMissesBrand: SpiritsColocationResult = {
      colocated: false,
      primaryPanelDescription: 'back',
      missingFromPrimary: ['brand-name'],
      confidence: 0.85,
      reason: 'brand missing from back panel'
    };
    const merged = mergeSpiritsColocationResults([aMissesAbv, bMissesBrand]);
    expect(merged?.colocated).toBe(false);
  });

  it('returns null when every child returned null (provider unavailable)', () => {
    expect(mergeSpiritsColocationResults([null, null])).toBeNull();
  });

  it('returns the one defined result when the other is null', () => {
    const real = coloc(true);
    expect(mergeSpiritsColocationResults([null, real])).toBe(real);
  });
});
