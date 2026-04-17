import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHint } from './useHint';
import { CrossFieldChecks } from './CrossFieldChecks';
import { FieldRow } from './FieldRow';
import { HelpTooltip } from './HelpTooltip';
import { NoTextState } from './NoTextState';
import { ResultsPinnedColumn } from './ResultsPinnedColumn';
import { StandaloneBanner } from './StandaloneBanner';
import { VerdictBanner } from './VerdictBanner';
import type {
  BeverageSelection,
  CheckReview,
  CheckStatus,
  LabelImage,
  UIVerificationReport
} from './types';

const STATUS_RANK: Record<CheckStatus, number> = { fail: 0, review: 1, pass: 2, info: 3 };
const SEVERITY_RANK: Record<CheckReview['severity'], number> = {
  blocker: 0,
  major: 1,
  minor: 2,
  note: 3
};

interface ResultsProps {
  image: LabelImage;
  beverage: BeverageSelection;
  report: UIVerificationReport;
  tourExpandedCheckId?: string | null;
  onNewReview: () => void;
  onRunFullComparison: () => void;
  onTryAnotherImage: () => void;
  onContinueWithCaution: () => void;
  onExportResults: () => void;
  exportEnabled: boolean;
}

const TOUR_ROW_EXPAND_DELAY_MS = 220;

export function Results({
  image,
  beverage,
  report,
  tourExpandedCheckId = null,
  onNewReview,
  onRunFullComparison,
  onTryAnotherImage,
  onContinueWithCaution,
  onExportResults,
  exportEnabled
}: ResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(tourExpandedCheckId);
  const expandRowHint = useHint('expand-row', expandedId !== null);
  const newReviewHint = useHint('new-review-shortcut', false);
  const rowRefs = useMemo(() => new Map<string, HTMLButtonElement>(), []);
  const workingAreaRef = useRef<HTMLElement | null>(null);
  const tourExpandTimeoutRef = useRef<number | null>(null);

  const sortedChecks = useMemo(
    () =>
      [...report.checks].sort((a, b) => {
        const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (statusDiff !== 0) return statusDiff;
        return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      }),
    [report.checks]
  );

  const actionableBoundary = useMemo(
    () => sortedChecks.findIndex((c) => c.status !== 'fail' && c.status !== 'review'),
    [sortedChecks]
  );

  const rowOrder = useMemo(
    () => [...sortedChecks.map((c) => c.id), ...report.crossFieldChecks.map((c) => c.id)],
    [sortedChecks, report.crossFieldChecks]
  );

  const toggleRow = useCallback((id: string) => {
    setExpandedId((previous) => (previous === id ? null : id));
  }, []);

  useEffect(() => {
    return () => {
      if (tourExpandTimeoutRef.current !== null) {
        window.clearTimeout(tourExpandTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tourExpandTimeoutRef.current !== null) {
      window.clearTimeout(tourExpandTimeoutRef.current);
      tourExpandTimeoutRef.current = null;
    }

    if (!tourExpandedCheckId) return;

    const hasMatchingRow =
      report.checks.some((check) => check.id === tourExpandedCheckId) ||
      report.crossFieldChecks.some((check) => check.id === tourExpandedCheckId);

    if (!hasMatchingRow) {
      return;
    }

    const row = rowRefs.get(tourExpandedCheckId);
    setExpandedId(null);

    if (row) {
      row.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }

    tourExpandTimeoutRef.current = window.setTimeout(() => {
      setExpandedId(tourExpandedCheckId);
      tourExpandTimeoutRef.current = null;
    }, TOUR_ROW_EXPAND_DELAY_MS);
  }, [report.checks, report.crossFieldChecks, rowRefs, tourExpandedCheckId]);

  const handleKeyNav = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
      if (event.key === 'Escape' && expandedId) {
        event.preventDefault();
        setExpandedId(null);
        rowRefs.get(id)?.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const index = rowOrder.indexOf(id);
        if (index < 0) return;
        const nextIndex =
          event.key === 'ArrowDown'
            ? Math.min(rowOrder.length - 1, index + 1)
            : Math.max(0, index - 1);
        const nextId = rowOrder[nextIndex];
        if (nextId) rowRefs.get(nextId)?.focus();
      }
    },
    [expandedId, rowOrder, rowRefs]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedId) {
        setExpandedId(null);
      }
      const target = event.target as HTMLElement | null;
      const isFormTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          (target as HTMLElement).isContentEditable);
      if (!isFormTarget && (event.key === 'n' || event.key === 'N')) {
        if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          onNewReview();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expandedId, onNewReview]);

  const isNoText = report.extractionQuality.state === 'no-text-extracted';
  const lowConfidenceSecondary =
    report.extractionQuality.state === 'low-confidence'
      ? 'The image was hard to read — please review these results carefully.'
      : null;
  const secondary =
    report.verdictSecondary ??
    (lowConfidenceSecondary ? lowConfidenceSecondary : undefined);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 h-[calc(100dvh-var(--header-h))] animate-fade-in motion-reduce:animate-none">
      <ResultsPinnedColumn image={image} beverage={beverage} />
      <section
        ref={workingAreaRef}
        className="md:col-span-7 lg:col-span-8 bg-background px-6 md:px-8 xl:px-14 py-6 xl:py-12 flex flex-col gap-6 xl:gap-8 overflow-y-auto"
      >
        <h1 className="sr-only">Results</h1>

        {isNoText ? (
          <NoTextState
            onTryAnother={onTryAnotherImage}
            onContinueWithCaution={onContinueWithCaution}
          />
        ) : (
          <>
            <VerdictBanner
              verdict={report.verdict}
              counts={report.counts}
              secondary={secondary}
              extractedFieldCount={report.checks.length}
              rulesAppliedCount={report.checks.length + report.crossFieldChecks.length}
            />

            {report.standalone ? (
              <StandaloneBanner onRunFullComparison={onRunFullComparison} />
            ) : null}

            <section aria-label="Field checklist" className="flex flex-col gap-3">
              {/*
                Small "plain English" escape hatch above the checklist.
                The rows below use status badges (Pass/Review/Fail/Info)
                that a first-time user won't recognize. One help pill
                here covers all of them without cluttering every row.
              */}
              <div className="flex items-center justify-end px-1 -mb-1">
                <HelpTooltip
                  label="What do these statuses mean?"
                  term="Pass, Review, Fail, Info"
                  explanation="Pass — we checked this and it's fine. Review — we're not sure; a person should look. Fail — we found a clear mismatch; this needs to be fixed. Info — a note for the reviewer, not a problem."
                />
              </div>
              {!report.standalone ? (
                // Header row mirrors FieldRow's flex structure exactly so
                // the "On Application" / "On Label" eyebrows line up with
                // the value columns below:
                //   FieldRow outer: [px-6 flex gap-4] → [inner-flex-1] [show-evidence ~144px]
                //   FieldRow inner:                  → [field-30%] [app-25%] [label-flex-1] [badge-w-[72px]]
                // Old header had a leftover `w-6` left spacer from the old
                // pre-Tier-3.1 chevron (removed when we moved the affordance
                // to the right side), which shifted every column 24px right.
                <div aria-hidden="true" className="hidden md:flex items-center gap-4 px-6 pb-1">
                  <div className="flex-1 flex items-center gap-4 min-w-0">
                    <span className="w-[30%] shrink-0" />
                    <span className="w-[25%] shrink-0 font-label text-xs lg:text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                      On Application
                    </span>
                    <span className="flex-1 font-label text-xs lg:text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                      On Label
                    </span>
                    <span className="shrink-0 w-[72px]" />
                  </div>
                  {/* Matches the 'Show evidence' button width on each FieldRow so the rightmost edge lines up. */}
                  <span className="shrink-0 w-[144px]" />
                </div>
              ) : null}
              {sortedChecks.map((check, index) => (
                <Fragment key={check.id}>
                  {index === actionableBoundary && actionableBoundary > 0 ? (
                    <div
                      className="border-t border-outline-variant/15 my-0.5"
                      aria-hidden="true"
                    />
                  ) : null}
                  <FieldRow
                    check={check}
                    expanded={expandedId === check.id}
                    onToggle={() => toggleRow(check.id)}
                    standalone={report.standalone}
                    rowRef={(node) => {
                      if (node) rowRefs.set(check.id, node);
                      else rowRefs.delete(check.id);
                    }}
                    onKeyNav={(event) => handleKeyNav(event, check.id)}
                  />
                </Fragment>
              ))}
            </section>

            {expandRowHint.visible ? (
              <p className="text-xs text-on-surface-variant/70 font-label flex items-center gap-1.5 -mt-1">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">lightbulb</span>
                Click any row to see what was found and the regulatory reference.
              </p>
            ) : null}

            <CrossFieldChecks
              checks={report.crossFieldChecks}
              expandedId={expandedId}
              onToggle={toggleRow}
              standalone={report.standalone}
              rowRefs={rowRefs}
              onKeyNav={handleKeyNav}
            />

            <div className="flex items-center justify-between gap-4 pt-4 xl:pt-6 border-t border-outline-variant/20">
              <div className="flex flex-wrap items-center gap-3">
                {report.standalone ? (
                  <button
                    type="button"
                    onClick={onRunFullComparison}
                    className="px-6 py-2.5 rounded-lg bg-surface-container-high text-on-surface font-label font-bold text-sm hover:bg-surface-container-highest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Run Full Comparison
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onNewReview}
                  className="px-8 py-2.5 rounded-lg bg-gradient-to-b from-primary to-primary-dim text-on-primary font-headline font-bold text-sm shadow-ambient hover:brightness-110 transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                  title="Press N to start a new review."
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                    add_circle
                  </span>
                  New Review
                </button>
                {newReviewHint.visible ? (
                  <span className="text-xs text-on-surface-variant/70 font-label">
                    Press N to start a new review.
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onExportResults}
                disabled={!exportEnabled}
                title={
                  exportEnabled
                    ? 'Download these results.'
                    : 'Complete a review first to export results.'
                }
                className="px-6 py-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-semibold text-sm hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  download
                </span>
                Export Results
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
