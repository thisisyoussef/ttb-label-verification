import type { CheckReview } from './contracts/review';

/**
 * Severity-aware "Needs review" copy resolver shared between the
 * server (initial report build) and the client (re-derives the
 * subtitle on every render so refine-pass upgrades and manual
 * actions are reflected immediately without a roundtrip).
 *
 * The functions are pure — they take only checks + crossFieldChecks
 * and return a phrase. Keep them allocation-light: VerdictBanner
 * renders on every report mutation.
 */

const SEVERITY_RANK: Record<CheckReview['severity'], number> = {
  note: 0,
  minor: 1,
  major: 2,
  blocker: 3
};

export interface ReviewSeverityProfile {
  /** Number of review-status rows across primary + cross-field checks. */
  count: number;
  /** Highest severity among those review rows. 'note' when none. */
  maxSeverity: CheckReview['severity'];
}

export function summarizeReviewSeverity(
  allChecks: CheckReview[]
): ReviewSeverityProfile {
  let count = 0;
  let maxSeverity: CheckReview['severity'] = 'note';
  for (const check of allChecks) {
    if (check.status !== 'review') continue;
    count += 1;
    if (SEVERITY_RANK[check.severity] > SEVERITY_RANK[maxSeverity]) {
      maxSeverity = check.severity;
    }
  }
  return { count, maxSeverity };
}

/**
 * Maps the review severity profile to a short, human phrase that
 * tells the reviewer how much work to expect. Returns undefined
 * when nothing needs review (caller should fall back to the
 * verdict-specific copy).
 */
export function resolveDynamicReviewPhrase(
  profile: ReviewSeverityProfile
): string | undefined {
  if (profile.count === 0) return undefined;
  const heavy =
    profile.maxSeverity === 'major' || profile.maxSeverity === 'blocker';

  if (heavy) {
    if (profile.count >= 5) {
      return `${profile.count} fields need a closer look — start with the major flags.`;
    }

    return profile.count === 1
      ? '1 field needs a closer look.'
      : `${profile.count} fields need a closer look.`;
  }

  return profile.count === 1
    ? '1 field still needs review.'
    : `${profile.count} fields still need review.`;
}
