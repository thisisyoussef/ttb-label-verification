import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Regression guard. The deterministic per-label stages (OCR prepass, warning OCV,
 * anchor track, region detection, warning OCR cross-check, spirits colocation) are
 * supposed to run across every uploaded label so that a back-label upload still
 * contributes its text/anchors/warning evidence to the review.
 *
 * `multi-label-stages.ts` exposes `*OverLabels` helpers that short-circuit to the
 * single-image function on `labels.length === 1`, so wiring them up costs nothing
 * for single-image intakes.
 *
 * This guard exists because the *OverLabels wiring has been accidentally reverted
 * twice during merges — silently dropping every secondary label from the OCR
 * preview's quick-fields surfacing and from the full pipeline's deterministic
 * stages. Re-introducing `runOcrPrepass(prepared.intake.label)` here will fail
 * this test and surface the regression at PR time, not in production.
 */
describe('per-label stage wiring (OverLabels)', () => {
  const STREAM_ROUTE = readSource('../routes/review-stream-route.ts');
  const LLM_TRACE = readSource('../llm/llm-trace.ts');

  it('review-stream-route.ts surfaces OCR preview text from every label', () => {
    expect(STREAM_ROUTE).toContain('runOcrPrepassOverLabels(prepared.intake.labels)');
    expect(STREAM_ROUTE).not.toMatch(/runOcrPrepass\(prepared\.intake\.label\)/);
  });

  it('llm-trace.ts runs every per-label deterministic stage with the OverLabels variant', () => {
    expect(LLM_TRACE).toContain('runOcrPrepassOverLabels(input.intake.labels)');
    expect(LLM_TRACE).toContain('runWarningOcvOverLabels(');
    expect(LLM_TRACE).toContain('runAnchorTrackOverLabels(input.intake.labels');
    expect(LLM_TRACE).toContain('runVlmRegionDetectionOverLabels(input.intake.labels)');
    expect(LLM_TRACE).toContain('runWarningOcrCrossCheckOverLabels(');
    expect(LLM_TRACE).toContain('runSpiritsColocationOverLabels(input.intake.labels)');

    expect(LLM_TRACE).not.toMatch(/runOcrPrepass\(input\.intake\.label\)/);
    expect(LLM_TRACE).not.toMatch(/runWarningOcv\(\{\s*label:\s*input\.intake\.label/);
    expect(LLM_TRACE).not.toMatch(/runAnchorTrack\(input\.intake\.label/);
    expect(LLM_TRACE).not.toMatch(/runVlmRegionDetection\(input\.intake\.label\)/);
    expect(LLM_TRACE).not.toMatch(/runWarningOcrCrossCheck\(\{\s*label:\s*input\.intake\.label/);
    expect(LLM_TRACE).not.toMatch(/checkSpiritsColocation\(input\.intake\.label\)/);
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), 'utf8');
}
