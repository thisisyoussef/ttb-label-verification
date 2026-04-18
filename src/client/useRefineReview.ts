import { useCallback, useEffect, useRef, useState } from 'react';

import {
  resolveDynamicReviewPhrase,
  summarizeReviewSeverity
} from '../shared/dynamic-review-copy';
import { refineReview } from './appReviewApi';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  UIVerificationReport
} from './types';

/**
 * Row-level refine (Option C). After the initial Results render, any
 * identifier row in 'review' status gets a second-pass verification
 * call. Server re-runs the pipeline with VERIFICATION_MODE=on so the
 * VLM sees the applicant-declared identifiers and decides whether
 * each is actually visible on the label (instead of bottom-up
 * guessing, which commonly mis-slots brand vs fanciful name).
 *
 * The initial report stays authoritative. When the refine completes,
 * the consumer merges individual rows from the refined report back
 * into the displayed state. Rows that didn't change visually are no-op.
 *
 * Failure-tolerant: if the refine call errors (network, quota,
 * timeout), we stay on the original report silently. Never a hard
 * error to the user.
 */

export type RefineStatus = 'idle' | 'refining' | 'done' | 'error';

export interface RefineHandle {
  status: RefineStatus;
  refinedReport: UIVerificationReport | null;
  /** Fire the refine call. Silently drops if no review rows to refine. */
  start: (input: {
    image: LabelImage;
    beverage: BeverageSelection;
    fields: IntakeFields;
  }) => void;
  reset: () => void;
}

/**
 * Which rows the "Verifying" indicator lights up on. The refine
 * server call runs the full pipeline under VERIFICATION_MODE=on and
 * returns EVERY field refreshed, so we merge every row regardless of
 * id — but we still surface the pulsing pill on the same identifier
 * + numeric fields that benefit from the second pass (brand, class,
 * country, address, ABV, net contents, warning).
 */
export const REFINABLE_FIELD_IDS = new Set([
  'brand-name',
  'class-type',
  'country-of-origin',
  'applicant-address',
  'alcohol-content',
  'net-contents',
  'government-warning'
]);

/** @deprecated Use REFINABLE_FIELD_IDS. Kept for backwards compatibility. */
export const IDENTIFIER_FIELD_IDS = REFINABLE_FIELD_IDS;

/**
 * Pure: returns true when the report has ANY field in 'review'
 * status. Refine runs the full pipeline with verification-mode on
 * and refreshes every row — not just identifiers — so the "one more
 * look" pass applies to ABV, net contents, warning, and address the
 * same way it does to brand / class / country.
 */
export function hasRefinableRows(report: UIVerificationReport | null): boolean {
  if (!report) return false;
  return report.checks.some((check) => check.status === 'review');
}

export function useRefineReview(): RefineHandle {
  const [status, setStatus] = useState<RefineStatus>('idle');
  const [refinedReport, setRefinedReport] = useState<UIVerificationReport | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setRefinedReport(null);
  }, []);

  const start = useCallback<RefineHandle['start']>(
    (input) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('refining');
      setRefinedReport(null);

      refineReview({
        image: input.image,
        beverage: input.beverage,
        fields: input.fields,
        signal: controller.signal
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.ok) {
            setRefinedReport(result.report as UIVerificationReport);
            setStatus('done');
          } else {
            setStatus('error');
          }
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setStatus('error');
        });
    },
    []
  );

  return { status, refinedReport, start, reset };
}

/**
 * Merge refined identifier rows back into the original report. Only
 * identifier rows are swapped; numeric / canonical rows (ABV, net
 * contents, warning, etc.) stay from the original report because
 * verification-mode doesn't touch them.
 *
 * Returns a new report object — safe to pass straight to useState.
 */
export function mergeRefinedReport(
  base: UIVerificationReport,
  refined: UIVerificationReport
): UIVerificationReport {
  const refinedById = new Map(refined.checks.map((check) => [check.id, check]));
  // Merge every row the refined report touched, not just identifiers.
  // The refine call re-runs the full pipeline so ABV / net contents /
  // warning / address all come back refreshed too; dropping the
  // identifier-only filter means the second pass actually resolves
  // what the user sees in `review` status.
  const nextChecks = base.checks.map((check) => {
    const swap = refinedById.get(check.id);
    return swap ?? check;
  });
  // Recount statuses after the swap so the summary stays accurate.
  const counts = { pass: 0, review: 0, fail: 0 };
  for (const check of [...nextChecks, ...base.crossFieldChecks]) {
    if (check.status === 'pass') counts.pass += 1;
    else if (check.status === 'fail') counts.fail += 1;
    else if (check.status === 'review') counts.review += 1;
  }
  // Recompute the verdict subtitle from the merged checks. The
  // server-supplied `verdictSecondary` was correct at the moment the
  // initial report was built, but a refine pass can drop review rows
  // to pass — leaving the original "4 fields need a closer look."
  // text stuck on the banner after the count pill has already
  // dropped to 2. Results.tsx ALSO recomputes on every render for
  // the live case; this mirror inside the merge keeps the report
  // object itself consistent so any other consumer (export, batch
  // drill-in) reads the right phrase.
  const dynamicPhrase = resolveDynamicReviewPhrase(
    summarizeReviewSeverity([...nextChecks, ...base.crossFieldChecks])
  );
  const verdictSecondary =
    dynamicPhrase ?? base.verdictSecondary;
  return {
    ...base,
    checks: nextChecks,
    counts,
    verdictSecondary
  };
}
