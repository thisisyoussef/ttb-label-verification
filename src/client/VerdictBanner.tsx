import { HelpTooltip } from './HelpTooltip';
import {
  DISPLAY_VERDICT_COPY,
  toDisplayCounts,
  toDisplayVerdict,
  type DisplayVerdict
} from './reviewDisplayAdapter';
import type { VerificationCounts, Verdict } from './types';

interface VerdictBannerProps {
  verdict: Verdict;
  counts: VerificationCounts;
  secondary?: string;
  extractedFieldCount?: number;
  rulesAppliedCount?: number;
}

// Display-only skins. The third state (engine's `reject`) is collapsed
// into `review` by toDisplayVerdict — users only see "Looks good" or
// "Needs your review". Engine rejects still surface as review rows with
// their own plain-language reasons; they just don't label the whole
// label as "rejected" in the banner.
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
  }
};

export function VerdictBanner({
  verdict,
  counts,
  secondary,
  extractedFieldCount,
  rulesAppliedCount
}: VerdictBannerProps) {
  // Collapse to the two-state UI verdict. Engine rejects become review
  // so the banner reads as guidance, not a machine verdict. Per-row
  // reasons still surface individually.
  const displayVerdict = toDisplayVerdict(verdict);
  const copy = DISPLAY_VERDICT_COPY[displayVerdict];
  const skin = VERDICT_SKIN[displayVerdict];
  const displayCounts = toDisplayCounts(counts);
  const attribution = buildAttribution(
    displayVerdict,
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
      : 'some fields need a human look';

  parts.push(tail);
  return parts.join(' · ');
}
