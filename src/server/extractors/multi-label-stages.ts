/**
 * Multi-label stage variants.
 *
 * TTB-304 added support for up to two label images per review, but the
 * per-label pipeline stages still consumed `intake.label` (the first
 * image) only. This module wraps each deterministic stage with a
 * fan-out-and-merge helper so every image contributes to the deterministic
 * signals, without breaking the single-image call shape.
 *
 * Design contract:
 *   - On `labels.length === 1` every helper short-circuits to the
 *     existing single-image implementation. Zero behavioral change for
 *     single-image intakes.
 *   - On `labels.length > 1` the helpers run the underlying stage in
 *     parallel (`Promise.all`) and fold the results using stage-specific
 *     merge semantics documented below.
 *   - Helpers return the same result shape as the underlying single-image
 *     function so call sites in `llm-trace.ts` can swap them in without
 *     changing downstream types.
 *
 * No front/back semantics are assumed. Users may upload in any order;
 * merges always union information rather than asserting which side holds
 * which field.
 */

import {
  runAnchorTrack,
  type AnchorTrackResult,
  type FieldAnchor
} from '../anchors/anchor-field-track';
import { runOcrPrepass, type OcrPrepassResult } from './ocr-prepass';
import type { NormalizedReviewFields, NormalizedUploadedLabel } from '../review/review-intake';
import {
  runVlmRegionDetection,
  type RegionOcrResult,
  type VlmRegionDetectionResult
} from './vlm-region-detector';
import {
  runWarningOcrCrossCheck,
  type OcrCrossCheckResult
} from '../validators/warning-ocr-cross-check';
import {
  runWarningOcv,
  type WarningOcvResult
} from '../validators/warning-region-ocv';
import {
  checkSpiritsColocation,
  type SpiritsColocationResult
} from '../validators/spirits-colocation-check';

// ---------- OCR PREPASS ----------
//
// Merge rule: concatenate successful texts with an inline separator so
// downstream regex extractors (ocr-field-extractor) simply see more
// vocabulary. Duration is the max of child durations (we ran in
// parallel). Preprocessing applied is the union across labels.
//
// If every child failed → return the first failure verbatim so callers
// that inspect `status === 'failed'` keep working unchanged.

export const MULTI_LABEL_OCR_SEPARATOR = '\n\n--- LABEL IMAGE 2 ---\n\n';

export async function runOcrPrepassOverLabels(
  labels: NormalizedUploadedLabel[]
): Promise<OcrPrepassResult> {
  if (labels.length === 0) {
    return { status: 'failed', reason: 'no-labels-provided', durationMs: 0 };
  }
  if (labels.length === 1) {
    return runOcrPrepass(labels[0]!);
  }
  const started = performance.now();
  const results = await Promise.all(labels.map(runOcrPrepass));
  return mergeOcrPrepassResults(results, Math.round(performance.now() - started));
}

export function mergeOcrPrepassResults(
  results: OcrPrepassResult[],
  overrideDurationMs?: number
): OcrPrepassResult {
  if (results.length === 0) {
    return { status: 'failed', reason: 'no-labels-provided', durationMs: 0 };
  }
  if (results.length === 1) {
    return results[0]!;
  }
  const durationMs =
    overrideDurationMs ?? results.reduce((m, r) => Math.max(m, r.durationMs), 0);
  const successes = results.filter(hasText);
  if (successes.length === 0) {
    return { ...results[0]!, durationMs };
  }
  // Preserve upload order for the separator labels so index-aware
  // readers can reason about which half of the concatenation belongs
  // to which image.
  const chunks: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (!hasText(r)) continue;
    chunks.push(`--- LABEL IMAGE ${i + 1} ---\n${r.text}`);
  }
  const text = chunks.join('\n\n');
  const preprocessingApplied = Array.from(
    new Set(successes.flatMap((r) => r.preprocessingApplied))
  );
  const anyDegraded = successes.some((r) => r.status === 'degraded');
  if (anyDegraded) {
    return {
      status: 'degraded',
      text,
      durationMs,
      reason: 'merged-multi-label',
      preprocessingApplied
    };
  }
  return {
    status: 'ok',
    text,
    durationMs,
    preprocessingApplied
  };
}

function hasText(
  result: OcrPrepassResult
): result is Extract<OcrPrepassResult, { text: string; preprocessingApplied: string[] }> {
  return result.status === 'ok' || result.status === 'degraded';
}

// ---------- WARNING OCV ----------
//
// Merge rule: the Government Warning lives on exactly one face. Prefer
// the best per-label outcome in order: verified → partial → not-found →
// error. On ties, the first label wins (stable order). Duration is the
// sum — OCV is cancellable and the aggregate wall-clock matters for
// telemetry.

export async function runWarningOcvOverLabels(input: {
  labels: NormalizedUploadedLabel[];
  signal?: AbortSignal;
  prepassOcrTexts?: (string | undefined)[];
}): Promise<WarningOcvResult> {
  const { labels, signal, prepassOcrTexts } = input;
  if (labels.length === 0) {
    return errorOcv();
  }
  if (labels.length === 1) {
    return runWarningOcv({
      label: labels[0]!,
      signal,
      prepassOcrText: prepassOcrTexts?.[0]
    });
  }
  const results = await Promise.all(
    labels.map((label, i) =>
      runWarningOcv({ label, signal, prepassOcrText: prepassOcrTexts?.[i] })
    )
  );
  return mergeWarningOcvResults(results);
}

export function mergeWarningOcvResults(
  results: WarningOcvResult[]
): WarningOcvResult {
  if (results.length === 0) return errorOcv();
  if (results.length === 1) return results[0]!;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  const rank: WarningOcvResult['status'][] = ['verified', 'partial', 'not-found', 'error'];
  for (const status of rank) {
    const match = results.find((r) => r.status === status);
    if (match) return { ...match, durationMs: totalDuration };
  }
  return { ...results[0]!, durationMs: totalDuration };
}

function errorOcv(): WarningOcvResult {
  return {
    status: 'error',
    similarity: 0,
    extractedText: '',
    editDistance: 999,
    headingAllCaps: false,
    confidence: 0.1,
    durationMs: 0
  };
}

// ---------- ANCHOR TRACK ----------
//
// Merge rule: each image gets its own Tesseract TSV pass. For each
// expected field, pick the per-image anchor with the highest
// `tokensFound` (→ highest coverage). Ocr word counts sum across images
// so the fast-approve word floor (≥20) still behaves. Re-derives
// `canFastApprove` from the merged field list.
//
// Rationale: the applicant-declared expected value is identical across
// images; the only per-image variation is which Tesseract pass found
// how many tokens. "Best observation wins" naturally handles the case
// where brand is on image A and warning is on image B.

export async function runAnchorTrackOverLabels(
  labels: NormalizedUploadedLabel[],
  fields: NormalizedReviewFields
): Promise<AnchorTrackResult> {
  if (labels.length === 0) {
    return { fields: [], ocrWordCount: 0, durationMs: 0, canFastApprove: false };
  }
  if (labels.length === 1) {
    return runAnchorTrack(labels[0]!, fields);
  }
  const started = performance.now();
  const perLabel = await Promise.all(
    labels.map((label) => runAnchorTrack(label, fields))
  );
  return mergeAnchorTrackResults(perLabel, Math.round(performance.now() - started));
}

export function mergeAnchorTrackResults(
  results: AnchorTrackResult[],
  overrideDurationMs?: number
): AnchorTrackResult {
  if (results.length === 0) {
    return { fields: [], ocrWordCount: 0, durationMs: 0, canFastApprove: false };
  }
  if (results.length === 1) return results[0]!;

  const durationMs =
    overrideDurationMs ?? results.reduce((m, r) => Math.max(m, r.durationMs), 0);
  const ocrWordCount = results.reduce((sum, r) => sum + r.ocrWordCount, 0);

  // Index anchors by field id across all results, then pick the best
  // anchor per field.
  const fieldIdsSeen: string[] = [];
  const bestByField = new Map<string, FieldAnchor>();
  for (const result of results) {
    for (const anchor of result.fields) {
      if (!fieldIdsSeen.includes(anchor.field)) fieldIdsSeen.push(anchor.field);
      const current = bestByField.get(anchor.field);
      if (!current || betterAnchor(anchor, current)) {
        bestByField.set(anchor.field, anchor);
      }
    }
  }
  const fields = fieldIdsSeen.map((id) => bestByField.get(id)!);

  const nonSkipped = fields.filter((a) => a.status !== 'skipped');
  const allStrong = nonSkipped.length > 0 && nonSkipped.every((a) => a.status === 'found');
  const enoughOcrWords = ocrWordCount >= 20;
  const canFastApprove = allStrong && enoughOcrWords;

  return { fields, ocrWordCount, durationMs, canFastApprove };
}

function betterAnchor(candidate: FieldAnchor, current: FieldAnchor): boolean {
  // Higher tokensFound wins; ties break on non-skipped > skipped, then
  // literal > equivalent matchKind.
  if (candidate.tokensFound !== current.tokensFound) {
    return candidate.tokensFound > current.tokensFound;
  }
  if (candidate.status === 'skipped' && current.status !== 'skipped') return false;
  if (current.status === 'skipped' && candidate.status !== 'skipped') return true;
  if (candidate.matchKind === 'literal' && current.matchKind !== 'literal') return true;
  return false;
}

// ---------- VLM REGION DETECTION ----------
//
// Merge rule: region detection runs per label and each region carries
// the image ordinal it was detected in. The downstream
// `applyRegionOverrides` consumer iterates all regions and applies
// verified-OCR overrides independently, so unioning the per-label
// arrays is semantically correct: whichever image holds the field
// contributes its verified read.
//
// On conflict (two images each report a verified read for the same
// field) we keep the earliest-by-upload-order first; `applyRegionOverrides`
// itself already de-duplicates by field key so downstream behavior is
// stable.

export type ImageScopedRegionOcrResult = RegionOcrResult & { imageIndex: number };

export async function runVlmRegionDetectionOverLabels(
  labels: NormalizedUploadedLabel[]
): Promise<VlmRegionDetectionResult> {
  if (labels.length === 0) {
    return { regions: [], durationMs: 0 };
  }
  if (labels.length === 1) {
    return runVlmRegionDetection(labels[0]!);
  }
  const started = performance.now();
  const perLabel = await Promise.all(labels.map((label) => runVlmRegionDetection(label)));
  return mergeVlmRegionDetectionResults(perLabel, Math.round(performance.now() - started));
}

export function mergeVlmRegionDetectionResults(
  results: VlmRegionDetectionResult[],
  overrideDurationMs?: number
): VlmRegionDetectionResult {
  if (results.length === 0) return { regions: [], durationMs: 0 };
  if (results.length === 1) return results[0]!;
  const durationMs =
    overrideDurationMs ?? results.reduce((m, r) => Math.max(m, r.durationMs), 0);

  // De-dup by field: prefer verified with ocrText, then found, then the
  // first seen. Preserve upload order for stability.
  const byField = new Map<string, RegionOcrResult>();
  for (let i = 0; i < results.length; i++) {
    for (const region of results[i]!.regions) {
      const current = byField.get(region.field);
      if (!current || betterRegion(region, current)) {
        byField.set(region.field, region);
      }
    }
  }
  return { regions: Array.from(byField.values()), durationMs };
}

function betterRegion(candidate: RegionOcrResult, current: RegionOcrResult): boolean {
  const score = (r: RegionOcrResult) =>
    (r.verified ? 2 : 0) + (r.ocrText && r.ocrText.length > 0 ? 1 : 0);
  return score(candidate) > score(current);
}

// ---------- WARNING OCR CROSS-CHECK ----------
//
// Merge rule: any `agree` across images wins (warning text can only be
// on one side; confirming agreement anywhere is authoritative). Else
// any `disagree` (OCR produced usable text that doesn't match the
// VLM's warning — retain that signal). Else `abstain`.

export async function runWarningOcrCrossCheckOverLabels(input: {
  labels: NormalizedUploadedLabel[];
  vlmWarningText: string;
}): Promise<OcrCrossCheckResult> {
  const { labels, vlmWarningText } = input;
  if (labels.length === 0) return { status: 'abstain', reason: 'no-labels-provided' };
  if (labels.length === 1) {
    return runWarningOcrCrossCheck({ label: labels[0]!, vlmWarningText });
  }
  const results = await Promise.all(
    labels.map((label) => runWarningOcrCrossCheck({ label, vlmWarningText }))
  );
  return mergeWarningOcrCrossCheckResults(results);
}

export function mergeWarningOcrCrossCheckResults(
  results: OcrCrossCheckResult[]
): OcrCrossCheckResult {
  if (results.length === 0) return { status: 'abstain', reason: 'no-labels-provided' };
  if (results.length === 1) return results[0]!;
  const agree = results.find((r) => r.status === 'agree');
  if (agree) return agree;
  const disagree = results.find((r) => r.status === 'disagree');
  if (disagree) return disagree;
  return results[0]!;
}

// ---------- SPIRITS CO-LOCATION ----------
//
// Merge rule: 27 CFR § 5.61 requires all three (brand, class/type, ABV)
// on the SAME panel — a cross-image union does NOT satisfy the rule.
// So: if any per-image check returns `colocated: true`, pass. Else
// return the most-informative failure (lowest confidence wins as a
// proxy for "most uncertain about the miss", which is the reviewer-
// friendly default). If every call returned `null` (provider absent
// or error), propagate `null` for the legacy placeholder path.

export async function runSpiritsColocationOverLabels(
  labels: NormalizedUploadedLabel[]
): Promise<SpiritsColocationResult | null> {
  if (labels.length === 0) return null;
  if (labels.length === 1) {
    return checkSpiritsColocation(labels[0]!);
  }
  const results = await Promise.all(labels.map((label) => checkSpiritsColocation(label)));
  return mergeSpiritsColocationResults(results);
}

export function mergeSpiritsColocationResults(
  results: (SpiritsColocationResult | null)[]
): SpiritsColocationResult | null {
  const defined = results.filter((r): r is SpiritsColocationResult => r !== null);
  if (defined.length === 0) return null;
  if (defined.length === 1) return defined[0]!;
  const pass = defined.find((r) => r.colocated);
  if (pass) return pass;
  // No panel satisfies the rule. Return the most-confident miss so the
  // report layer renders an actionable reason. If every miss has the
  // same confidence the first-seen wins.
  return defined.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best));
}
