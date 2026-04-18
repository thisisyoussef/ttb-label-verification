/**
 * User-facing display adapter.
 *
 * The rule engine produces verdicts in {approve, review, reject} and field
 * checks in {pass, review, fail, info} with numeric confidence scores.
 * That surface is correct for eval, export, and internal consumers — but
 * the reviewer-facing UI deliberately hides it. Assessors see only:
 *
 *   - a neutral approval state when nothing still needs review
 *   - a review state that scales with the amount of remaining work
 *
 * No confidence percentages. No "fail" status (it becomes "needs review").
 * No tier jargon. No internal rule ids in copy. The compliance substance
 * stays the same — every check's citation and evidence is still shown —
 * but the framing stops treating the tool as the decision-maker.
 *
 * This module is the single seam. Upstream code doesn't change; downstream
 * UI components pull their copy + status from here.
 */

import type {
  CheckReview,
  ExtractionQualityState,
  VerificationCounts
} from './types';

/** UI-only verdict. The engine's `reject` collapses to `review` here. */
export type DisplayVerdict = 'approve' | 'review';

/** UI-only check status. The engine's `fail` collapses to `review` here. */
export type DisplayCheckStatus = 'pass' | 'review' | 'info';

/** Collapse check-level `fail` to `review`. Pass-through for pass/info. */
export function toDisplayStatus(status: CheckReview['status']): DisplayCheckStatus {
  if (status === 'pass') return 'pass';
  if (status === 'info') return 'info';
  return 'review';
}

/**
 * Collapse the counts. The engine tracks pass/review/fail; the UI shows
 * "matched" and "needs review" only. Fail rolls into review.
 */
export type DisplayCounts = {
  matched: number;
  needsReview: number;
};

export function toDisplayCounts(counts: VerificationCounts): DisplayCounts {
  return {
    matched: counts.pass,
    needsReview: counts.review + counts.fail
  };
}

export interface DisplayVerdictCopy {
  verdict: DisplayVerdict;
  headline: string;
  explanation: string;
  icon: string;
}

/**
 * Plain-language headline + explanation for each display verdict. These
 * intentionally avoid:
 *   - "reject" / "rejection" / "violation" — tool is guiding, not gating
 *   - percentages, confidence numbers, probabilistic language
 *   - regulatory jargon (27 CFR, tier, disposition)
 */
export const DISPLAY_VERDICT_COPY: Record<
  DisplayVerdict,
  { headline: string; explanation: string; icon: string }
> = {
  approve: {
    headline: 'Looks good',
    explanation:
      "We checked every field from the application against the label and everything matches. You can approve without opening each row.",
    icon: 'verified_user'
  },
  review: {
    headline: 'Needs your review',
    explanation:
      "Some fields need a human eye — either the label and application don't match, or the label image is hard for us to read. Open the flagged rows below to see the details.",
    icon: 'visibility'
  }
};

export function resolveDisplayVerdict(input: {
  counts: VerificationCounts;
  standalone: boolean;
  extractionQualityState: ExtractionQualityState;
}): DisplayVerdict {
  const displayCounts = toDisplayCounts(input.counts);
  if (
    input.standalone ||
    input.extractionQualityState !== 'ok' ||
    displayCounts.needsReview > 0
  ) {
    return 'review';
  }

  return 'approve';
}

export function resolveDisplayVerdictCopy(input: {
  counts: VerificationCounts;
  standalone: boolean;
  extractionQualityState: ExtractionQualityState;
}): DisplayVerdictCopy {
  const displayVerdict = resolveDisplayVerdict(input);
  const displayCounts = toDisplayCounts(input.counts);

  if (input.standalone) {
    return {
      verdict: 'review',
      headline: 'Check extracted details',
      explanation:
        'This run extracted the label details without application data. Confirm the fields below before approving.',
      icon: 'visibility'
    };
  }

  if (input.extractionQualityState !== 'ok') {
    return {
      verdict: 'review',
      headline: 'Image needs review',
      explanation:
        'The image was hard to read, so the extracted fields below still need a human check.',
      icon: 'visibility'
    };
  }

  if (displayVerdict === 'approve') {
    return {
      verdict: 'approve',
      ...DISPLAY_VERDICT_COPY.approve
    };
  }

  const rowLabel = displayCounts.needsReview === 1 ? 'row' : 'rows';
  const issueLabel = displayCounts.needsReview === 1 ? 'issue' : 'issues';

  return {
    verdict: 'review',
    headline:
      displayCounts.needsReview === 1
        ? '1 field needs review'
        : `${displayCounts.needsReview} fields need review`,
    explanation:
      displayCounts.matched > 0
        ? `${displayCounts.matched} fields matched. Open the flagged ${rowLabel} below to review the remaining ${issueLabel}.`
        : `Open the flagged ${rowLabel} below to review the remaining ${issueLabel}.`,
    icon: 'visibility'
  };
}

/**
 * Plain-language status labels for individual field checks. Used by the
 * per-row badge component.
 */
export const DISPLAY_STATUS_COPY: Record<
  DisplayCheckStatus,
  { label: string; icon: string }
> = {
  pass: { label: 'Matches', icon: 'check_circle' },
  review: { label: 'Needs review', icon: 'visibility' },
  info: { label: 'Info', icon: 'info' }
};

/**
 * Pick the badge copy for a single check row. Almost always returns
 * the static `DISPLAY_STATUS_COPY` entry, but pass-status rows whose
 * comparison is `not-applicable` (the application didn't fill that
 * field, so there's nothing to compare against — we just confirmed
 * the value is on the label) get a distinct label so the reviewer
 * doesn't read "Matches" and assume the application data was
 * checked. The status itself stays `pass` so the green skin and
 * counts work unchanged.
 */
export function resolveCheckBadge(check: CheckReview): {
  label: string;
  icon: string;
} {
  const display = toDisplayStatus(check.status);
  const isFoundOnly =
    display === 'pass' && check.comparison?.status === 'not-applicable';
  if (isFoundOnly) {
    return { label: 'Found on label', icon: 'visibility' };
  }
  return DISPLAY_STATUS_COPY[display];
}

/**
 * User-facing reason rewrite. The engine's check summaries sometimes
 * contain internal rule ids or regulation numbers; this strips those so
 * the reviewer sees plain language only. The stripped content is
 * preserved in `citation` which the UI can disclose behind an
 * "Regulatory reference" expander if/when that surface is built.
 *
 * Strips:
 *   - Leading "[rule-id]" bracket tags
 *   - Trailing "(X% match)" percentage annotations
 *   - Explicit confidence probability mentions
 *   - Phrases that imply a machine verdict (e.g. "we reject", "rule fails")
 */
export function plainifyReason(raw: string): string {
  if (!raw) return raw;
  return raw
    // Internal rule ids wrapped in square brackets can appear at the
    // start OR inline (e.g. "Label matches.\n\n[class-type-exact-match]
    // Class/type matches..."). Strip every occurrence — they're engine
    // debug breadcrumbs, not reviewer-facing copy.
    .replace(/\[\s*[a-z0-9][a-z0-9-]*\s*\]\s*/gi, '')
    // Strip engine-level diagnostic formatting like `app="X" ext="Y"`
    // that leaked into a couple of judgment notes. The server copy
    // has been updated to avoid this but the rewrite is a safety
    // net — a reviewer should never see quoted-key debug bags.
    .replace(/\bapp\s*=\s*"[^"]*"\s*(?:ext\s*=\s*"[^"]*"\s*)?/gi, '')
    .replace(/\bext\s*=\s*"[^"]*"\s*/gi, '')
    // Strip "Defer to LLM" / "LLM judgment" phrasing — users don't
    // care which component resolves an ambiguity.
    .replace(/\s*Defer to (?:the )?LLM(?: judgment)?(?: or human review)?\.?/gi, '')
    .replace(/\bLLM judgment\b/gi, 'further review')
    // "(95% match)" / "(90% match)" → ""
    .replace(/\s*\(\s*\d+%\s*match\s*\)/gi, '')
    // "Warning text matches the required wording (95% match)." handled above
    // Standalone "XX% match" or "XX%" at end → dropped
    .replace(/\s*[~≈]?\d+%\s*match[^.]*\.?\s*$/i, '.')
    // "disposition" → "result" (softer, less juridical)
    .replace(/\bdisposition\b/gi, 'result')
    // "reject" / "rejects" / "rejected" / "rejection" → "needs review"
    .replace(/\brejects?\b/gi, 'needs review')
    .replace(/\brejected\b/gi, 'flagged for review')
    .replace(/\brejection\b/gi, 'review')
    // "fail" / "fails" / "failed" as a check result → "needs review"
    .replace(/\b(check|rule)\s+fails?\b/gi, '$1 needs review')
    .replace(/\bfailed the check\b/gi, 'needs review')
    // Collapse the duplicate-summary pattern — engine often emits
    // "Label matches the approved record.\n\nClass/type matches the
    // approved record." where both halves are essentially the same
    // sentence. Keep the more specific half.
    .replace(/\s*\n\s*\n\s*/g, '\n\n')
    // Trim leftover double spaces and leading/trailing whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Compose a single, plain-language reason sentence for a given check,
 * drawing from both the `summary` and `details` strings the engine
 * emits. Prefers summary when present; falls back to details.
 */
export function plainifyCheckReason(check: CheckReview): string {
  const picked = check.summary && check.summary.length > 0 ? check.summary : check.details;
  return plainifyReason(picked ?? '');
}
