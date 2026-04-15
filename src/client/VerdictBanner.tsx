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

const VERDICT_SKIN: Record<
  Verdict,
  { banner: string; accent: string; iconBg: string; iconText: string; headline: string }
> = {
  approve: {
    banner: 'bg-tertiary-container/30',
    accent: 'border-tertiary',
    iconBg: 'bg-tertiary-container',
    iconText: 'text-on-tertiary-container',
    headline: 'text-on-tertiary-container'
  },
  review: {
    banner: 'bg-caution-container/50',
    accent: 'border-caution',
    iconBg: 'bg-caution-container',
    iconText: 'text-on-caution-container',
    headline: 'text-on-caution-container'
  },
  reject: {
    banner: 'bg-error-container/15',
    accent: 'border-error',
    iconBg: 'bg-error',
    iconText: 'text-on-error',
    headline: 'text-on-error-container'
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
      className={[
        'relative rounded-lg border-l-4 p-6 flex flex-col gap-4',
        skin.banner,
        skin.accent
      ].join(' ')}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={[
              'w-12 h-12 rounded flex items-center justify-center flex-shrink-0',
              skin.iconBg,
              skin.iconText
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {copy.icon}
            </span>
          </div>
          <div className="flex flex-col">
            <h2
              className={[
                'font-headline text-2xl font-extrabold tracking-tight',
                skin.headline
              ].join(' ')}
            >
              {copy.headline}
            </h2>
            {secondary ? (
              <p className="mt-1 text-sm font-body text-on-surface-variant">{secondary}</p>
            ) : null}
          </div>
        </div>
        <CountsPills counts={counts} />
      </div>
      {attribution ? (
        <p className="flex items-center gap-2 text-xs font-mono text-on-surface-variant/70 border-t border-on-surface-variant/10 pt-3">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
            account_tree
          </span>
          {attribution}
        </p>
      ) : null}
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
  return parts.join(' \u00b7 ');
}

function CountsPills({ counts }: { counts: VerificationCounts }) {
  const items = [
    { label: 'Pass', value: counts.pass, tone: 'text-tertiary', border: 'border-tertiary' },
    { label: 'Review', value: counts.review, tone: 'text-caution', border: 'border-caution' },
    { label: 'Fail', value: counts.fail, tone: 'text-error', border: 'border-error' }
  ];
  return (
    <ul className="flex items-stretch gap-3" aria-label="Check counts">
      {items.map((item) => (
        <li
          key={item.label}
          className={[
            'text-center px-4 py-2 bg-surface-container-lowest rounded shadow-ambient border-b-2 min-w-[64px]',
            item.border
          ].join(' ')}
        >
          <span
            className={[
              'block text-2xl font-headline font-bold',
              item.value > 0 ? item.tone : 'text-on-surface-variant'
            ].join(' ')}
          >
            {item.value}
          </span>
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
