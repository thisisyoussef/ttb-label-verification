/**
 * Parallel anchor track — "application value as known target" OCR.
 *
 * Reframes the extraction problem: instead of asking the VLM to READ
 * every field (slow + hallucinates), we take the COLA application
 * values as known targets and search the label's OCR text for them.
 * One Tesseract TSV call per label covers ALL fields at once because
 * per-field anchoring is a simple string search over the extracted
 * word list.
 *
 * Design goals:
 *   - ~500-1500ms wall clock (one Tesseract pass, CPU-bound).
 *   - Deterministic — no LLM involvement, reproducible results.
 *   - Complementary to the VLM extraction, not a replacement. When
 *     anchoring fires confidently (all fields ≥80% found), the
 *     caller can approve the label without waiting for the VLM.
 *     When anchoring is weak, the VLM path runs as today.
 *
 * Experiment (scripts/anchor-all-fields-experiment.ts) validated this
 * on 5 cola-cloud labels: labels with enough OCR words (55+) anchor
 * strongly (≥80% tokens found across 3-4 fields); labels with too
 * few words (<15) anchor unreliably and correctly signal "fall back
 * to VLM".
 *
 * Architectural implication: on clean-label fast-path hits, the full
 * 5-7s pipeline can collapse to ~1-2s without sacrificing judgment
 * quality.
 */

import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import sharp from 'sharp';

import type { NormalizedUploadedLabel } from './review-intake';
import type { NormalizedReviewFields } from './review-intake';
import {
  expandEquivalentPhrases,
  type AnchorFieldId
} from './anchor-taxonomy-expand';

const execAsync = promisify(exec);

/**
 * Feature flag: enable parallel anchor track + per-field merge.
 *
 *   ANCHOR_MERGE=enabled  → run anchor in parallel, use it to upgrade
 *                           review→pass where anchor confirms the app
 *                           value is present on the label.
 *   ANCHOR_MERGE=shadow   → run but don't merge (for metrics)
 *   (anything else)       → skip anchor entirely (legacy path).
 *
 * Default OFF during rollout. Graduates to on-by-default after eval
 * harness confirms zero regressions on the cola-cloud-all slice.
 */
export function resolveAnchorMergeMode(): 'enabled' | 'shadow' | 'disabled' {
  const raw = (process.env.ANCHOR_MERGE ?? '').trim().toLowerCase();
  if (raw === 'enabled' || raw === 'on' || raw === 'true') return 'enabled';
  if (raw === 'shadow') return 'shadow';
  return 'disabled';
}

/**
 * Per-field anchoring outcome. Callers use `status` to decide whether
 * a field is confidently-present (and can be auto-approved) or
 * needs the VLM / judgment path.
 */
export interface FieldAnchor {
  /** Field id (brand, class, abv, net, country, address). */
  field: string;
  /** Application value passed in as the known target. */
  expected: string;
  /** Distinct content tokens we searched for. */
  tokens: string[];
  /** How many of those tokens were found in the OCR output. */
  tokensFound: number;
  /**
   * tokensFound / tokens.length. 1.0 = every expected token is on
   * the label. Empty-token fields (e.g. blank application value)
   * return 1.0 vacuously — they're not used to gate approval.
   */
  coverage: number;
  /**
   * 'found'   = ≥80% of content tokens present → strong evidence
   *             the field matches the application.
   * 'partial' = 40-80% — present but possibly noisy OCR. Fall
   *             back to VLM judgment.
   * 'missing' = <40% — either the field isn't there or OCR
   *             couldn't read it. Fall back to VLM.
   * 'skipped' = no distinct tokens to anchor on (empty value or
   *             only common words).
   */
  status: 'found' | 'partial' | 'missing' | 'skipped';
  /**
   * How the match was achieved:
   *   'literal'    = exact/substring match on the original expected tokens
   *   'equivalent' = match required taxonomy-equivalent fallback
   *                  (e.g. app="Syrah" → label="Shiraz")
   *   'none'       = no tokens matched (status will be missing/partial)
   * The review-report layer can cite this in the evidence note so a
   * reviewer knows whether to trust the auto-approval.
   */
  matchKind: 'literal' | 'equivalent' | 'none';
}

export interface AnchorTrackResult {
  /** Per-field anchors, keyed by field id. */
  fields: FieldAnchor[];
  /** Words Tesseract extracted from the full label. */
  ocrWordCount: number;
  /** Whole-pass wall clock. */
  durationMs: number;
  /**
   * True when the track is confident enough to approve without
   * waiting for the VLM: every non-skipped field anchored ≥80%
   * AND Tesseract extracted enough words (≥20) to trust the miss
   * signal on fields that didn't anchor.
   */
  canFastApprove: boolean;
}

/**
 * Content tokens we extract from an expected value. Stopwords are
 * omitted because they're too common to discriminate — finding "the"
 * or "and" on a label tells us nothing. Minimum length is 2 so numeric
 * fragments like "12", "fl", "oz" ARE included (fixes an earlier bug
 * where 3-char minimum stripped net-contents tokens to empty).
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'by', 'for', 'with', 'from',
  'in', 'on', 'at', 'to', 'is', 'was', 'it', 'that', 'this'
]);

export function tokenizeExpectedValue(value: string): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .replace(/[.,%!?;:()/\\-]/g, ' ')
    .split(/\s+/)
    // 2-char floor (not 3) so net-contents tokens like "12", "fl",
    // "oz" survive the filter. 1-char junk (stray letters) still
    // filtered.
    .filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok));
}

interface TsvWord {
  text: string;
  confidence: number;
}

/**
 * Run Tesseract in TSV mode on the full label. Fast PSM 3 (full auto)
 * because we're not targeting a specific region — we want every word
 * on the label so per-field anchoring has the full vocabulary to
 * search.
 */
async function runTesseractFullLabel(
  label: NormalizedUploadedLabel
): Promise<TsvWord[]> {
  const meta = await sharp(label.buffer).metadata();
  const width = meta.width ?? 1000;
  const targetWidth = Math.min(2400, Math.max(1600, width * 2));
  const tmp = path.join(tmpdir(), `anchor-${randomBytes(8).toString('hex')}.png`);
  try {
    const prepped = await sharp(label.buffer)
      .resize({ width: targetWidth, kernel: 'lanczos3' })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
    writeFileSync(tmp, prepped);
    const { stdout } = await execAsync(
      `tesseract ${tmp} stdout -l eng --psm 3 --oem 1 tsv 2>/dev/null`,
      { timeout: 8000, maxBuffer: 20 * 1024 * 1024 }
    );
    return parseTsvWords(stdout);
  } catch {
    return [];
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function parseTsvWords(tsv: string): TsvWord[] {
  const rows = tsv.split('\n').slice(1); // skip header
  const out: TsvWord[] = [];
  for (const row of rows) {
    const cols = row.split('\t');
    if (cols.length < 12) continue;
    const text = cols[11]?.trim();
    const conf = Number.parseFloat(cols[10] ?? '-1');
    if (!text || text.length === 0) continue;
    if (!Number.isFinite(conf) || conf < 40) continue;
    out.push({ text: text.toLowerCase(), confidence: conf });
  }
  return out;
}

/** Decide a status bucket for a coverage score. */
function coverageToStatus(coverage: number): FieldAnchor['status'] {
  if (coverage >= 0.8) return 'found';
  if (coverage >= 0.4) return 'partial';
  return 'missing';
}

/**
 * Anchor one field's known value against the OCR word set. Exact
 * match first, then substring-tolerance fallback (OCR may split or
 * merge tokens).
 *
 * When the literal anchor would fall short (<80% coverage), retry
 * with taxonomy equivalents — grape synonyms, country aliases +
 * subdivisions, USPS address expansions, unit variants. An
 * equivalent-only match is reported via `matchKind: 'equivalent'`
 * so downstream callers can cite it in the evidence note.
 */
export function anchorOneField(
  field: string,
  expected: string,
  words: TsvWord[]
): FieldAnchor {
  const tokens = tokenizeExpectedValue(expected);
  if (tokens.length === 0) {
    return {
      field,
      expected,
      tokens: [],
      tokensFound: 0,
      coverage: 1, // vacuously — don't gate approval on blank fields
      status: 'skipped',
      matchKind: 'none'
    };
  }
  const ocrTextSet = new Set(words.map((w) => w.text));
  const { found: literalFound } = matchTokensAgainstWords(tokens, ocrTextSet, words);
  let found = literalFound;
  let matchKind: FieldAnchor['matchKind'] = literalFound > 0 ? 'literal' : 'none';

  // Taxonomy-equivalent backup: if the literal match is weak, retry
  // against synonyms/aliases for this field. Only runs when literal is
  // below the 'found' threshold so we don't burn cycles on already-
  // confident matches.
  if (found < tokens.length * 0.8) {
    const equivalentPhrases = expandEquivalentPhrases(
      field as AnchorFieldId,
      expected
    );
    if (equivalentPhrases.length > 0) {
      const equivalentTokens = Array.from(
        new Set(
          equivalentPhrases.flatMap((phrase) => tokenizeExpectedValue(phrase))
        )
      ).filter((t) => !tokens.includes(t));
      if (equivalentTokens.length > 0) {
        const { found: equivFound } = matchTokensAgainstWords(
          equivalentTokens,
          ocrTextSet,
          words
        );
        if (equivFound > 0) {
          // Blend equivalent matches into overall coverage so a label
          // showing "SHIRAZ" for app "Syrah" anchors strongly. Cap at
          // tokens.length to keep coverage in [0, 1].
          found = Math.min(tokens.length, found + equivFound);
          matchKind = literalFound > 0 ? 'literal' : 'equivalent';
        }
      }
    }
  }

  const coverage = found / tokens.length;
  return {
    field,
    expected,
    tokens,
    tokensFound: found,
    coverage,
    status: coverageToStatus(coverage),
    matchKind
  };
}

/**
 * Score how many of `tokens` appear in the OCR output, via exact hit
 * or substring tolerance. Extracted so the base-token pass and the
 * equivalent-token fallback share the same matching logic.
 */
function matchTokensAgainstWords(
  tokens: string[],
  ocrTextSet: Set<string>,
  words: TsvWord[]
): { found: number } {
  let found = 0;
  for (const tok of tokens) {
    if (ocrTextSet.has(tok)) {
      found += 1;
      continue;
    }
    if (words.some((w) => w.text.includes(tok) || tok.includes(w.text))) {
      found += 1;
    }
  }
  return { found };
}

/**
 * Full parallel anchor pass. One Tesseract call → per-field string
 * searches → aggregate into a fast-approve decision.
 */
export async function runAnchorTrack(
  label: NormalizedUploadedLabel,
  fields: NormalizedReviewFields
): Promise<AnchorTrackResult> {
  const startedAt = performance.now();
  const words = await runTesseractFullLabel(label);
  const fieldAnchors: FieldAnchor[] = [
    anchorOneField('brand', fields.brandName ?? '', words),
    anchorOneField('fanciful', fields.fancifulName ?? '', words),
    anchorOneField('class', fields.classType ?? '', words),
    anchorOneField('abv', fields.alcoholContent ?? '', words),
    anchorOneField('net', fields.netContents ?? '', words),
    anchorOneField('country', fields.country ?? '', words),
    anchorOneField('address', fields.applicantAddress ?? '', words)
  ];

  // Fast-approve gate: every NON-SKIPPED field anchored at ≥80% AND
  // Tesseract produced at least 20 words. The word floor prevents a
  // garbled OCR (few recognizable tokens) from false-positively
  // anchoring everything by substring.
  const nonSkipped = fieldAnchors.filter((a) => a.status !== 'skipped');
  const allStrong = nonSkipped.length > 0 &&
    nonSkipped.every((a) => a.status === 'found');
  const enoughOcrWords = words.length >= 20;
  const canFastApprove = allStrong && enoughOcrWords;

  return {
    fields: fieldAnchors,
    ocrWordCount: words.length,
    durationMs: Math.round(performance.now() - startedAt),
    canFastApprove
  };
}
