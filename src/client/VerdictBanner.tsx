import { HelpTooltip } from './HelpTooltip';
import type { VerificationCounts, Verdict } from './types';

interface VerdictBannerProps {
  verdict: Verdict;
  counts: VerificationCounts;
  secondary?: string;
  extractedFieldCount?: number;
  rulesAppliedCount?: number;
}

const VERDICT_COPY: Record<Verdict, { headline: string; icon: string }> = {
  approve: { headline: 'Recommend approval', icon: 'verified_user' },
  review: { headline: 'Recommend manual review', icon: 'warning' },
  reject: { headline: 'Recommend rejection', icon: 'cancel' }
};

// Plain-English definitions for the three verdicts. Written for a
// first-time visitor with no compliance background. Intentionally
// non-legal language — this is the "escape hatch" tooltip the UX plan
// calls for.
const VERDICT_HELP: Record<Verdict, { term: string; explanation: string }> = {
  approve: {
    term: 'Recommend approval',
    explanation:
      "We checked the label against the application and didn't find anything wrong. A reviewer can approve this without opening every field."
  },
  review: {
    term: 'Recommend manual review',
    explanation:
      "We're not sure. Some of the fields are hard to read, or there's a small difference that a person needs to judge. Open the flagged rows to see why."
  },
  reject: {
    term: 'Recommend rejection',
    explanation:
      "We found a clear mismatch between the application and the label — like a different alcohol percentage, or a missing government warning. A reviewer should decline this label."
  }
};

const VERDICT_SKIN: Record<Verdict, { bg: string; border: string; icon: string; text: string }> = {
  approve: {
    bg: 'bg-tertiary-container/30',
    border: 'border-tertiary',
    icon: 'text-on-tertiary-container',
    text: 'text-on-tertiary-container'
  },
  review: {
    bg: 'bg-caution-container/50',
    border: 'border-caution',
    icon: 'text-on-caution-container',
    text: 'text-on-caution-container'
  },
  reject: {
    bg: 'bg-error-container/15',
    border: 'border-error',
    icon: 'text-error',
    text: 'text-on-error-container'
  }
};

export function VerdictBanner({
  verdict,
  counts,
  secondary,
  extractedFieldCount,
  rulesAppliedCount
}: VerdictBannerProps) {
  const copy = VERDICT_COPY[verdict];
  const skin = VERDICT_SKIN[verdict];
  const attribution = buildAttribution(verdict, extractedFieldCount, rulesAppliedCount);

  return (
    <section
      aria-label="Verdict"
      data-tour-target="tour-verdict-banner"
      title={attribution ?? undefined}
      className={[
        'flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border-l-4 px-5 py-4',
        skin.bg,
        skin.border
      ].join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden="true"
          className={`material-symbols-outlined text-3xl ${skin.icon}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {copy.icon}
        </span>
        <h2
          className={[
            'font-headline text-2xl font-bold tracking-tight whitespace-nowrap',
            skin.text
          ].join(' ')}
        >
          {copy.headline}
        </h2>
        <HelpTooltip
          iconOnly
          term={VERDICT_HELP[verdict].term}
          explanation={VERDICT_HELP[verdict].explanation}
        />
      </div>

      {secondary ? (
        <span className="text-sm font-body text-on-surface-variant leading-snug hidden md:inline">
          {secondary}
        </span>
      ) : null}

      <div className="flex-1" />

      <div
        className="flex items-center gap-3 text-sm font-label font-semibold whitespace-nowrap"
        aria-label="Check counts"
      >
        <span className={counts.pass > 0 ? 'text-tertiary' : 'text-on-surface-variant/50'}>
          {counts.pass} pass
        </span>
        <span className="text-on-surface-variant/30" aria-hidden="true">
          ·
        </span>
        <span className={counts.review > 0 ? 'text-caution' : 'text-on-surface-variant/50'}>
          {counts.review} review
        </span>
        <span className="text-on-surface-variant/30" aria-hidden="true">
          ·
        </span>
        <span className={counts.fail > 0 ? 'text-error' : 'text-on-surface-variant/50'}>
          {counts.fail} fail
        </span>
      </div>
    </section>
  );
}

function buildAttribution(
  verdict: Verdict,
  fieldCount: number | undefined,
  ruleCount: number | undefined
): string | null {
  if (fieldCount == null && ruleCount == null) return null;

  const parts: string[] = [];
  if (fieldCount != null) parts.push('AI extracted ' + fieldCount + ' fields');
  if (ruleCount != null) parts.push(ruleCount + ' deterministic rules applied');

  const tail =
    verdict === 'approve'
      ? 'no violations found'
      : verdict === 'reject'
        ? 'blocking violation detected by rules'
        : 'flagged for human review by rules';

  parts.push(tail);
  return parts.join(' · ');
}
