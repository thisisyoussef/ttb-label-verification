import { HelpTooltip } from './HelpTooltip';
import {
  resolveDisplayVerdictCopy,
  toDisplayCounts,
  type DisplayVerdict
} from './reviewDisplayAdapter';
import type {
  CheckReview,
  ExtractionQualityState,
  VerificationCounts
} from './types';

interface VerdictBannerProps {
  counts: VerificationCounts;
  standalone: boolean;
  extractionQualityState: ExtractionQualityState;
  checks?: CheckReview[];
  secondary?: string;
  extractedFieldCount?: number;
  rulesAppliedCount?: number;
}

// Display-only skins. Approve stays tertiary (matched-green), review stays
// caution-amber, and recommend-reject uses the error palette — muted
// enough to match the softer copy ("probably not a label") while still
// reading as a clearly different state from a normal review.
const VERDICT_SKIN: Record<DisplayVerdict, { bg: string; border: string; icon: string; text: string }> = {
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
  'recommend-reject': {
    bg: 'bg-error-container/40',
    border: 'border-error',
    icon: 'text-on-error-container',
    text: 'text-on-error-container'
  }
};

export function VerdictBanner({
  counts,
  standalone,
  extractionQualityState,
  checks,
  secondary,
  extractedFieldCount,
  rulesAppliedCount
}: VerdictBannerProps) {
  const copy = resolveDisplayVerdictCopy({
    counts,
    standalone,
    extractionQualityState,
    checks
  });
  const skin = VERDICT_SKIN[copy.verdict];
  const displayCounts = toDisplayCounts(counts);
  const attribution = buildAttribution(
    copy.verdict,
    extractedFieldCount,
    rulesAppliedCount
  );

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
          term={copy.headline}
          explanation={copy.explanation}
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
        aria-label="Check summary"
      >
        <span
          className={displayCounts.matched > 0 ? 'text-tertiary' : 'text-on-surface-variant/50'}
        >
          {displayCounts.matched} matched
        </span>
        <span className="text-on-surface-variant/30" aria-hidden="true">
          ·
        </span>
        <span
          className={displayCounts.needsReview > 0 ? 'text-caution' : 'text-on-surface-variant/50'}
        >
          {displayCounts.needsReview} needs review
        </span>
      </div>
    </section>
  );
}

function buildAttribution(
  verdict: DisplayVerdict,
  fieldCount: number | undefined,
  ruleCount: number | undefined
): string | null {
  if (fieldCount == null && ruleCount == null) return null;

  const parts: string[] = [];
  if (fieldCount != null) parts.push('AI extracted ' + fieldCount + ' fields');
  if (ruleCount != null) parts.push(ruleCount + ' checks applied');

  const tail =
    verdict === 'approve'
      ? 'everything matched'
      : verdict === 'recommend-reject'
        ? "nothing we recognise as label content came through"
        : 'some fields need a human look';

  parts.push(tail);
  return parts.join(' · ');
}
