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
        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border-l-4 px-4 py-2.5',
        skin.bg,
        skin.border
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          aria-hidden="true"
          className={`material-symbols-outlined text-xl ${skin.icon}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {copy.icon}
        </span>
        <h2
          className={[
            'font-headline text-base font-bold tracking-tight whitespace-nowrap',
            skin.text
          ].join(' ')}
        >
          {copy.headline}
        </h2>
      </div>

      {secondary ? (
        <span className="text-xs font-body text-on-surface-variant leading-tight hidden md:inline">
          {secondary}
        </span>
      ) : null}

      <div className="flex-1" />

      <div
        className="flex items-center gap-2.5 text-xs font-label font-bold whitespace-nowrap"
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
