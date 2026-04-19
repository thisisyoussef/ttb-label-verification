/**
 * Small inline badge rendering which uploaded image a field value was
 * read from. TTB-304 let reviewers submit up to two label images per
 * application; the follow-up pipeline fan-out stamps
 * `evidenceImage` onto each CheckReview so this badge can surface the
 * attribution in the drill-in.
 *
 * Semantics:
 *   - `evidenceImage` is a 0-indexed upload ordinal (no front/back bias).
 *   - Renders nothing when `totalImages < 2` — the badge is only useful
 *     on multi-image reviews where attribution can differ.
 *   - Renders nothing when `evidenceImage` is null/undefined — the VLM
 *     couldn't attribute the value (typically because the evidence
 *     appeared on both images).
 */

interface LabelEvidenceBadgeProps {
  evidenceImage: number | null | undefined;
  totalImages: number;
}

export function LabelEvidenceBadge({
  evidenceImage,
  totalImages
}: LabelEvidenceBadgeProps) {
  if (totalImages < 2) return null;
  if (evidenceImage === undefined || evidenceImage === null) return null;
  if (!Number.isInteger(evidenceImage) || evidenceImage < 0) return null;
  const ordinal = evidenceImage + 1;
  return (
    <span
      className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded ring-1 ring-outline-variant/20"
      title={`Read from label image ${ordinal} of ${totalImages}.`}
      aria-label={`Read from label image ${ordinal} of ${totalImages}`}
    >
      Image {ordinal}
    </span>
  );
}
