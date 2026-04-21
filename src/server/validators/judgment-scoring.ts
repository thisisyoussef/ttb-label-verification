/**
 * Confidence scoring and weighted verdict derivation.
 *
 * Replaces the binary deriveVerdict that treats every review check equally.
 * Implements criticality-weighted scoring from the judgment guidance doc.
 */

import type { CheckReview, VerificationReport } from '../../shared/contracts/review';
import type { ReviewExtraction } from '../../shared/contracts/review';

type CriticalityTier = 'critical' | 'high' | 'medium' | 'low';

const TIER_WEIGHTS: Record<CriticalityTier, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0.5
};

/** Review weight threshold — below this, cosmetic reviews don't block approval. */
const REVIEW_WEIGHT_THRESHOLD = 2.5;

/**
 * Map check IDs to their criticality tier.
 * Matches the regulatory hierarchy from the judgment guidance doc.
 */
const CHECK_TIER_MAP: Record<string, CriticalityTier> = {
  'alcohol-content': 'critical',
  'government-warning': 'critical',

  'class-type': 'high',
  'country-of-origin': 'high',
  'varietal': 'high',
  'vintage-requires-appellation': 'high',

  'brand-name': 'medium',
  'net-contents': 'medium',
  'importer': 'medium',
  'applicant-address': 'medium',
  'abv-format-permitted': 'high',

  'same-field-of-vision': 'low',
  'fanciful-name': 'low'
};

function getTier(checkId: string): CriticalityTier {
  return CHECK_TIER_MAP[checkId] ?? 'medium';
}

function getWarningSubCheckStatus(
  check: CheckReview,
  subCheckId: string
): CheckReview['status'] | undefined {
  return check.warning?.subChecks.find((subCheck) => subCheck.id === subCheckId)
    ?.status as CheckReview['status'] | undefined;
}

function isAdvisoryWarningReview(check: CheckReview | undefined): boolean {
  if (
    !check ||
    check.id !== 'government-warning' ||
    check.status !== 'review'
  ) {
    return false;
  }

  const hasFailingSubCheck =
    check.warning?.subChecks.some((subCheck) => subCheck.status === 'fail') ?? false;
  const hasReadableWarningText =
    typeof check.extractedValue === 'string' &&
    check.extractedValue.trim() !== '' &&
    check.extractedValue !== '?';

  return (
    !hasFailingSubCheck &&
    hasReadableWarningText &&
    getWarningSubCheckStatus(check, 'present') === 'pass' &&
    getWarningSubCheckStatus(check, 'continuous-paragraph') === 'pass'
  );
}

function hasOnlyLenientLowConfidenceWarningReview(
  checks: CheckReview[],
  extraction: ReviewExtraction
): boolean {
  const nonPassChecks = checks.filter(
    (check) => check.status !== 'pass' && check.status !== 'info'
  );
  const hasUsableImageQuality =
    typeof extraction.imageQuality.score === 'number' &&
    extraction.imageQuality.score >= 0.55;

  return (
    hasUsableImageQuality &&
    nonPassChecks.length > 0 &&
    nonPassChecks.every((check) =>
      isAdvisoryWarningReview(check)
    )
  );
}

export type WeightedVerdictInput = {
  checks: CheckReview[];
  crossFieldChecks: CheckReview[];
  standalone: boolean;
  extraction: ReviewExtraction;
};

export type WeightedVerdictResult = {
  verdict: VerificationReport['verdict'];
  weightedReviewScore: number;
  reviewThreshold: number;
  reason: string;
};

/**
 * Derive verdict using criticality-weighted scoring.
 *
 * Rules:
 * 1. Any critical/high tier reject → reject
 * 2. Standalone mode with no application data → review (can't compare)
 * 3. Image quality degraded → review
 * 4. Weighted review score above threshold → review
 * 5. Otherwise → approve
 */
export function deriveWeightedVerdict(input: WeightedVerdictInput): WeightedVerdictResult {
  const allChecks = [...input.checks, ...input.crossFieldChecks];

  // Rule 1: Any reject from critical or high tier → reject.
  //
  // Exception (government warning ONLY): the warning check is a composite of
  // several sub-checks. When the failure is caused by extraction noise rather
  // than a genuine regulatory defect, downgrade to review.
  //
  // Heuristic: if the extracted text clearly contains anchor words
  // ("GOVERNMENT WARNING" / "SURGEON GENERAL") AND the warning's overall
  // confidence is low (< 0.7) — meaning the model itself wasn't sure about
  // the defect signal — treat as review. When confidence is high (e.g. 0.9+
  // saying "heading is NOT in all caps"), that's a confident real defect and
  // we keep the reject.
  for (const check of allChecks) {
    if (check.status === 'fail') {
      const tier = getTier(check.id);
      if (tier === 'critical' || tier === 'high') {
        if (check.id === 'government-warning') {
          const appRaw = (check.applicationValue ?? check.comparison?.applicationValue ?? '').trim();
          const extRaw = (check.extractedValue ?? check.comparison?.extractedValue ?? '').trim();
          const ext = extRaw.toUpperCase();
          const appEmpty = !appRaw || appRaw === '?';
          const extEmpty = !extRaw || extRaw === '?';

          // "Warning not in this photo" — both sides empty. The VLM may have
          // flagged a visual-formatting sub-check as a defect ("no heading
          // in all caps") purely because there's NO warning to assess on
          // this face of the label. Downgrade to review so a reviewer can
          // check the back label.
          if (appEmpty && extEmpty) {
            continue;
          }

          // Garbled OCR extraction — anchor words present but confidence is
          // low. Treat as review rather than auto-reject.
          const hasAnchorWords = ext.includes('GOVERNMENT WARNING') || ext.includes('SURGEON GENERAL');
          const lowConfidenceDefect = check.confidence < 0.7;
          if (hasAnchorWords && lowConfidenceDefect) {
            continue;
          }
        }
        return {
          verdict: 'reject',
          weightedReviewScore: 0,
          reviewThreshold: REVIEW_WEIGHT_THRESHOLD,
          reason: `${check.id} failed at ${tier} tier: ${check.summary}`
        };
      }
    }
  }

  // Medium/low tier rejects also block, but as review (not reject)
  const hasAnyFail = allChecks.some(c => c.status === 'fail');

  // Rule 2: Standalone mode
  if (input.standalone) {
    return {
      verdict: 'review',
      weightedReviewScore: 0,
      reviewThreshold: REVIEW_WEIGHT_THRESHOLD,
      reason: 'Standalone mode — no application data to compare against.'
    };
  }

  // Rule 3: Image quality
  const warningOnlyLowConfidence =
    input.extraction.imageQuality.state === 'low-confidence' &&
    hasOnlyLenientLowConfidenceWarningReview(allChecks, input.extraction);

  if (
    input.extraction.imageQuality.state !== 'ok' &&
    !warningOnlyLowConfidence
  ) {
    return {
      verdict: 'review',
      weightedReviewScore: 0,
      reviewThreshold: REVIEW_WEIGHT_THRESHOLD,
      reason: `Image quality: ${input.extraction.imageQuality.state}`
    };
  }

  // Rule 3b: Critical-tier safety gate.
  // If a critical-tier check passed but its confidence is suspiciously low,
  // or if the extraction's warning field confidence is below the safety floor,
  // force the verdict to review. This catches VLM hallucination where the model
  // confidently reports warning text that was actually occluded or damaged.
  const warningCheck = allChecks.find(c => c.id === 'government-warning');
  if (warningCheck?.status === 'pass' && warningCheck.confidence < 0.70) {
    return {
      verdict: 'review',
      weightedReviewScore: 0,
      reviewThreshold: REVIEW_WEIGHT_THRESHOLD,
      reason: `Government warning passed but with low confidence (${warningCheck.confidence.toFixed(2)}) — safety gate forces review.`
    };
  }

  // Rule 3c: If ALL checks pass with zero issues, verify we have confident
  // evidence on at least one critical-tier check. A label where everything
  // "looks fine" but no critical check has high confidence is suspicious.
  const criticalChecks = allChecks.filter(c => getTier(c.id) === 'critical');
  const allCriticalPass = criticalChecks.length > 0 && criticalChecks.every(c => c.status === 'pass');
  const anyCriticalConfident = criticalChecks.some(c => c.confidence >= 0.85);
  const anyNonPassCheck = allChecks.some(c => c.status !== 'pass' && c.status !== 'info');

  if (allCriticalPass && !anyCriticalConfident && !anyNonPassCheck) {
    return {
      verdict: 'review',
      weightedReviewScore: 0,
      reviewThreshold: REVIEW_WEIGHT_THRESHOLD,
      reason: 'All checks pass but no critical-tier check has confident evidence — safety gate forces review.'
    };
  }

  // Rule 4: Weighted review score
  let weightedScore = 0;
  const reviewChecks: string[] = [];

  for (const check of allChecks) {
    if (check.status === 'review') {
      const tier = getTier(check.id);
      let weight = TIER_WEIGHTS[tier];
      // Scale by severity: major = full weight, minor = half
      const severityScale = check.severity === 'minor' ? 0.5 : 1.0;

      // Government warning "not verifiable from this image" policy:
      // When the warning check is review AND no warning text was detected
      // on either side (app=empty AND ext=empty), the warning simply isn't
      // in this photo — likely a front-label-only image. Downweight to low
      // tier instead of critical. The warning IS mandatory on the physical
      // label, but this PHOTO may only show the front. The reviewer knows
      // to check the actual bottle.
      //
      // Note: We check text emptiness rather than confidence because a
      // high-confidence "inconclusive visual sub-check" result still means
      // "I confidently don't have enough evidence" — not "there's a defect."
      if (check.id === 'government-warning') {
        if (isAdvisoryWarningReview(check)) {
          weight = TIER_WEIGHTS.low;
          reviewChecks.push(
            `${check.id}(downweighted:low-confidence-warning,${check.severity})`
          );
          weightedScore += weight * severityScale;
          continue;
        }

        const appEmpty = !check.applicationValue || check.applicationValue === '?' || check.applicationValue.trim() === '';
        const extEmpty = !check.extractedValue || check.extractedValue === '?' || check.extractedValue.trim() === '';
        const lowConfidence = check.confidence < 0.55;
        // Downweight when: text missing OR model not confident
        if ((appEmpty && extEmpty) || lowConfidence) {
          weight = TIER_WEIGHTS.low; // 0.5 instead of 3.0
          reviewChecks.push(`${check.id}(downweighted:not-in-photo,${check.severity})`);
          weightedScore += weight * severityScale;
          continue;
        }
      }

      weightedScore += weight * severityScale;
      reviewChecks.push(`${check.id}(${tier},${check.severity})`);
    }
  }

  if (hasAnyFail) {
    // Medium/low tier fails get added to weighted score instead of auto-rejecting
    for (const check of allChecks) {
      if (check.status === 'fail') {
        const tier = getTier(check.id);
        if (tier !== 'critical' && tier !== 'high') {
          weightedScore += TIER_WEIGHTS[tier] * 2; // fails count double
          reviewChecks.push(`${check.id}(${tier},fail)`);
        }
      }
    }
  }

  if (weightedScore > REVIEW_WEIGHT_THRESHOLD) {
    return {
      verdict: 'review',
      weightedReviewScore: weightedScore,
      reviewThreshold: REVIEW_WEIGHT_THRESHOLD,
      reason: `Weighted review score ${weightedScore.toFixed(1)} exceeds threshold ${REVIEW_WEIGHT_THRESHOLD}: ${reviewChecks.join(', ')}`
    };
  }

  // Rule 5: Approve
  return {
    verdict: 'approve',
    weightedReviewScore: weightedScore,
    reviewThreshold: REVIEW_WEIGHT_THRESHOLD,
    reason: weightedScore > 0
      ? `Approved with minor flags (score ${weightedScore.toFixed(1)} < ${REVIEW_WEIGHT_THRESHOLD}): ${reviewChecks.join(', ')}`
      : 'All checks passed or resolved by normalization.'
  };
}
