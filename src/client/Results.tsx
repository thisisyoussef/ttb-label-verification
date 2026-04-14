import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CrossFieldChecks } from './CrossFieldChecks';
import { FieldRow } from './FieldRow';
import { NoTextState } from './NoTextState';
import { ResultsPinnedColumn } from './ResultsPinnedColumn';
import { StandaloneBanner } from './StandaloneBanner';
import { VerdictBanner } from './VerdictBanner';
import type {
  BeverageSelection,
  LabelImage,
  UIVerificationReport
} from './types';

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
  const rowRefs = useMemo(() => new Map<string, HTMLButtonElement>(), []);
  const workingAreaRef = useRef<HTMLElement | null>(null);
  const tourExpandTimeoutRef = useRef<number | null>(null);

  const rowOrder = useMemo(
    () => [...report.checks.map((c) => c.id), ...report.crossFieldChecks.map((c) => c.id)],
    [report.checks, report.crossFieldChecks]
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
      ? 'Low extraction confidence — review carefully.'
      : null;
  const secondary =
    report.verdictSecondary ??
    (lowConfidenceSecondary ? lowConfidenceSecondary : undefined);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 min-h-[calc(100vh-56px)]">
      <ResultsPinnedColumn image={image} beverage={beverage} />
      <section
        ref={workingAreaRef}
        className="md:col-span-8 lg:col-span-9 bg-background px-6 md:px-10 lg:px-14 py-10 lg:py-12 flex flex-col gap-8"
      >
        <header className="flex items-center justify-between">
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            Results
          </h1>
        </header>

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
            />

            {report.standalone ? (
              <StandaloneBanner onRunFullComparison={onRunFullComparison} />
            ) : null}

            <section aria-label="Field checklist" className="flex flex-col gap-3">
              {report.checks.map((check) => (
                <FieldRow
                  key={check.id}
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
              ))}
            </section>

            <CrossFieldChecks
              checks={report.crossFieldChecks}
              expandedId={expandedId}
              onToggle={toggleRow}
              standalone={report.standalone}
              rowRefs={rowRefs}
              onKeyNav={handleKeyNav}
            />

            <div className="flex items-center justify-between gap-4 pt-6 border-t border-outline-variant/20">
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
              </div>
              <button
                type="button"
                onClick={onExportResults}
                disabled={!exportEnabled}
                title={
                  exportEnabled
                    ? 'Download this result set as JSON.'
                    : 'Export is enabled when the live pipeline lands.'
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
