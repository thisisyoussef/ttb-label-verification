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

import { CANONICAL_GOVERNMENT_WARNING } from '../shared/contracts/review';
import type { OcrCrossCheckResult } from './warning-ocr-cross-check';
import type { WarningOcvResult } from './warning-region-ocv';

export type WarningSignalVote = 'pass' | 'review' | 'fail' | 'abstain';
export const WARNING_PASS_SIMILARITY = 0.93;
export const WARNING_REVIEW_SIMILARITY = 0.75;

export type WarningVoteSignal = {
  source: 'vlm' | 'ocv' | 'ocr-cross-check';
  vote: WarningSignalVote;
  similarity: number;
};

type ActiveWarningVoteSignal = WarningVoteSignal & {
  vote: Exclude<WarningSignalVote, 'abstain'>;
};

export type WarningVoteResolution = {
  vote: Exclude<WarningSignalVote, 'abstain'>;
  similarity: number;
  activeSignals: number;
  passCount: number;
  reviewCount: number;
  failCount: number;
  passConsensus: boolean;
  failConsensus: boolean;
  conflictingSignals: boolean;
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

export function similarityToVote(
  similarity: number
): Exclude<WarningSignalVote, 'abstain'> {
  if (similarity >= WARNING_PASS_SIMILARITY) return 'pass';
  if (similarity >= WARNING_REVIEW_SIMILARITY) return 'review';
  return 'fail';
}

/**
 * Resolve the three-signal vote into a single similarity score that
 * downstream subChecks can use with the shared warning similarity tiers.
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
  return resolveWarningVote(signals, fallback).similarity;
}

export function resolveWarningVote(
  signals: WarningVoteSignal[],
  fallback: number
): WarningVoteResolution {
  const active = signals.filter(isActiveWarningVoteSignal);
  if (active.length === 0) {
    const fallbackVote = similarityToVote(fallback);
    return {
      vote: fallbackVote,
      similarity: fallback,
      activeSignals: 0,
      passCount: fallbackVote === 'pass' ? 1 : 0,
      reviewCount: fallbackVote === 'review' ? 1 : 0,
      failCount: fallbackVote === 'fail' ? 1 : 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    };
  }

  if (active.length === 1) {
    const [signal] = active;
    return {
      vote: signal.vote,
      similarity: signal.similarity || fallback,
      activeSignals: 1,
      passCount: signal.vote === 'pass' ? 1 : 0,
      reviewCount: signal.vote === 'review' ? 1 : 0,
      failCount: signal.vote === 'fail' ? 1 : 0,
      passConsensus: false,
      failConsensus: false,
      conflictingSignals: false
    };
  }

  const passSignals = active.filter((signal) => signal.vote === 'pass');
  const reviewSignals = active.filter((signal) => signal.vote === 'review');
  const failSignals = active.filter((signal) => signal.vote === 'fail');
  const passCount = passSignals.length;
  const reviewCount = reviewSignals.length;
  const failCount = failSignals.length;
  const passConsensus = passCount >= 2;
  const failConsensus = failCount >= 2;
  const conflictingSignals =
    (passCount > 0 && failCount > 0) ||
    (reviewCount > 0 && (passCount > 0 || failCount > 0));

  if (passConsensus) {
    return {
      vote: 'pass',
      similarity: meanSimilarity(passSignals.map((signal) => signal.similarity), fallback),
      activeSignals: active.length,
      passCount,
      reviewCount,
      failCount,
      passConsensus,
      failConsensus,
      conflictingSignals
    };
  }

  if (failConsensus) {
    return {
      vote: 'fail',
      similarity: meanSimilarity(failSignals.map((signal) => signal.similarity), fallback),
      activeSignals: active.length,
      passCount,
      reviewCount,
      failCount,
      passConsensus,
      failConsensus,
      conflictingSignals
    };
  }

  const similarities = active.map((signal) => signal.similarity).sort((a, b) => a - b);

  return {
    vote: 'review',
    similarity:
      similarities.length === 2
        ? (similarities[0]! + similarities[1]!) / 2
        : similarities[Math.floor(similarities.length / 2)]!,
    activeSignals: active.length,
    passCount,
    reviewCount,
    failCount,
    passConsensus,
    failConsensus,
    conflictingSignals
  };
}

function meanSimilarity(values: number[], fallback: number) {
  if (values.length === 0) {
    return fallback;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isActiveWarningVoteSignal(
  signal: WarningVoteSignal
): signal is ActiveWarningVoteSignal {
  return signal.vote !== 'abstain';
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
