/**
 * 2-of-3 warning vote — stabilizes the fuzzy-match boundary by combining
 * three independent reads of the warning text so single-signal jitter
 * can't single-handedly flip a label between review and fail.
 *
 * The three signals that feed the vote are all computed upstream in
 * llm-trace.ts (VLM extraction, OCV cropped region, Tesseract full-image
 * cross-check) and arrive as parameters to `buildGovernmentWarningCheck`.
 *
 * See government-warning-validator.ts for how the voted similarity is
 * consumed by the `exact-text` subCheck.
 */

import { CANONICAL_GOVERNMENT_WARNING } from '../../shared/contracts/review';
import type { OcrCrossCheckResult } from './warning-ocr-cross-check';
import type { WarningOcvResult } from './warning-region-ocv';

export type WarningSignalVote = 'pass' | 'review' | 'fail' | 'abstain';

export type WarningVoteSignal = {
  source: 'vlm' | 'ocv' | 'ocr-cross-check';
  vote: WarningSignalVote;
  similarity: number;
};

/**
 * Case-insensitive normalized Levenshtein similarity. Real COLA labels
 * commonly print the entire warning block in ALL CAPS because TTB
 * interprets all-caps as satisfying the "conspicuous" requirement
 * (27 CFR 16.22). Canonical text is mixed case; a case-sensitive
 * comparison produced false rejects on those labels.
 */
export function computeWarningSimilarity(
  extracted: string,
  canonical: string
): number {
  const a = extracted.trim().toUpperCase();
  const b = canonical.trim().toUpperCase();
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / max);
}

/**
 * Build the three independent warning signals. Each signal votes
 * pass/review/fail using the same Levenshtein tiers the exact-text
 * subCheck uses, OR abstains when its input is unusable.
 */
export function collectWarningVoteSignals(input: {
  vlmSimilarity: number;
  hasVlmText: boolean;
  ocrCrossCheck?: OcrCrossCheckResult;
  warningOcv?: WarningOcvResult;
}): WarningVoteSignal[] {
  const signals: WarningVoteSignal[] = [];

  // VLM signal — always available when the VLM extraction has warning text.
  signals.push({
    source: 'vlm',
    vote: input.hasVlmText ? similarityToVote(input.vlmSimilarity) : 'abstain',
    similarity: input.hasVlmText ? input.vlmSimilarity : 0
  });

  // OCV cropped-region signal.
  if (input.warningOcv) {
    if (
      input.warningOcv.status === 'verified' ||
      input.warningOcv.status === 'partial'
    ) {
      const ocvSim =
        typeof input.warningOcv.similarity === 'number'
          ? input.warningOcv.similarity
          : computeWarningSimilarity(
              input.warningOcv.extractedText ?? '',
              CANONICAL_GOVERNMENT_WARNING
            );
      signals.push({
        source: 'ocv',
        vote: similarityToVote(ocvSim),
        similarity: ocvSim
      });
    } else {
      signals.push({ source: 'ocv', vote: 'abstain', similarity: 0 });
    }
  }

  // Full-image Tesseract OCR cross-check signal. It measures edit distance
  // against the VLM's warning text, not the canonical, so we translate
  // its status into a vote: agree with VLM that reads at ≥pass tier →
  // pass; disagree → review (one of the two reads is noisy, hold for
  // human); abstain → no signal.
  if (input.ocrCrossCheck) {
    if (input.ocrCrossCheck.status === 'agree') {
      signals.push({
        source: 'ocr-cross-check',
        vote: input.hasVlmText ? similarityToVote(input.vlmSimilarity) : 'abstain',
        similarity: input.vlmSimilarity
      });
    } else if (input.ocrCrossCheck.status === 'disagree') {
      signals.push({ source: 'ocr-cross-check', vote: 'review', similarity: 0 });
    } else {
      signals.push({ source: 'ocr-cross-check', vote: 'abstain', similarity: 0 });
    }
  }

  return signals;
}

export function similarityToVote(similarity: number): WarningSignalVote {
  if (similarity >= 0.9) return 'pass';
  if (similarity >= 0.65) return 'review';
  return 'fail';
}

/**
 * Resolve the three-signal vote into a single similarity score that
 * downstream subChecks can use with the existing 0.9 / 0.65 tiers.
 *
 * Conservative rules:
 *   - 2+ signals pass (regardless of the third) → treat as pass (1.0)
 *   - 2+ signals fail (regardless of the third) → treat as fail (0.0)
 *   - Otherwise → median of non-abstaining similarities so one outlier
 *     signal can't dominate.
 *
 * Single-signal runs collapse back to vlmSimilarity for backwards
 * compatibility.
 */
export function deriveVotedSimilarity(
  signals: WarningVoteSignal[],
  fallback: number
): number {
  const active = signals.filter((s) => s.vote !== 'abstain');
  if (active.length === 0) return fallback;
  if (active.length === 1) return active[0]!.similarity || fallback;

  const passes = active.filter((s) => s.vote === 'pass').length;
  const fails = active.filter((s) => s.vote === 'fail').length;
  if (passes >= 2) return 1.0;
  if (fails >= 2) return 0.0;

  const sims = active.map((s) => s.similarity).sort((a, b) => a - b);
  if (sims.length === 2) return (sims[0]! + sims[1]!) / 2;
  return sims[Math.floor(sims.length / 2)]!;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let previous = new Array<number>(n + 1);
  let current = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) previous[j] = j;
  for (let i = 1; i <= m; i += 1) {
    current[0] = i;
    for (let j = 1; j <= n; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[n];
}
