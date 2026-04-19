import type { CheckReview } from '../shared/contracts/review';
import type { AnchorTrackResult, FieldAnchor } from './anchor-field-track';

/**
 * Map a check spec `id` → anchor-track `field` id. The anchor track
 * uses short keys ('brand', 'class', 'abv', 'net', 'country',
 * 'address') while the report uses longer hyphenated ids. Fanciful
 * has no analogous check spec id because cross-field judgment handles
 * it; it's still anchored for telemetry but not merged here.
 */
const CHECK_TO_ANCHOR_ID: Record<string, string> = {
  'brand-name': 'brand',
  'class-type': 'class',
  'alcohol-content': 'abv',
  'net-contents': 'net',
  'country-of-origin': 'country',
  'applicant-address': 'address'
};

/**
 * Look up the per-field anchor result for a given check id. Returns
 * null when no anchor ran (feature flag off) or the field didn't
 * anchor strongly enough to be useful.
 *
 * We only return 'found'-status anchors. 'partial' and 'missing' are
 * useless for the upgrade path — they can't tell us the VLM's review
 * was wrong. 'skipped' (blank application value) already means there's
 * nothing to verify.
 */
function findStrongAnchorFor(
  checkId: string,
  anchorTrack: AnchorTrackResult | null | undefined
): FieldAnchor | null {
  if (!anchorTrack) return null;
  const anchorFieldId = CHECK_TO_ANCHOR_ID[checkId];
  if (!anchorFieldId) return null;
  const anchor = anchorTrack.fields.find((field) => field.field === anchorFieldId);
  if (!anchor || anchor.status !== 'found') return null;
  return anchor;
}

/**
 * Per-field merge: when the anchor confirms the application value is
 * present on the label, upgrade a 'review' check to 'pass'. Never
 * downgrades — anchor can only save uncertainty, not create it.
 *
 * Applies to review verdicts only; fail/pass are preserved. Downstream
 * the resolver and weighted-verdict pass still run on the upgraded
 * check set, so if a blocker fail is present in another field, the
 * overall verdict is unaffected.
 */
export function maybeUpgradeCheckWithAnchor(
  check: CheckReview,
  anchor: FieldAnchor | null
): CheckReview {
  if (!anchor) return check;
  if (check.status !== 'review') return check;
  const equivalenceHint =
    anchor.matchKind === 'equivalent'
      ? 'The label shows a recognized equivalent of the approved value.'
      : 'The approved value is clearly printed on the label.';
  const matchedLabelValue =
    anchor.expected || check.applicationValue || check.extractedValue;
  return {
    ...check,
    status: 'pass',
    severity: 'note',
    summary: 'Label matches the approved record.',
    details: equivalenceHint,
    extractedValue: matchedLabelValue,
    comparison: matchedLabelValue
      ? {
          status: 'match',
          applicationValue: check.applicationValue ?? anchor.expected,
          extractedValue: matchedLabelValue,
          note: equivalenceHint
        }
      : check.comparison
  };
}

export function maybeUpgradeChecksWithAnchors(
  checks: CheckReview[],
  anchorTrack: AnchorTrackResult | null | undefined
): CheckReview[] {
  return checks.map((check) =>
    maybeUpgradeCheckWithAnchor(check, findStrongAnchorFor(check.id, anchorTrack))
  );
}
