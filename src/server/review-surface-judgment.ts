// Post-extraction LLM judgment pass for the review surface.
//
// After deterministic field comparison lands a check at `review` status for
// certain fields that benefit from semantic equivalence (country aliases,
// address abbreviation), we fire a focused LLM prompt per field to either
// upgrade the check to `pass` or keep it at `review` with better
// reasoning. Extracted from llm-trace.ts to keep that file within the
// 500-line source-size cap.
//
// Design notes:
//   - Only fires for a fixed allowlist of fields. Brand, class, ABV, and
//     net-contents stay in the deterministic fast path because the
//     judgment layer's per-field normalizers already cover those well.
//   - All ambiguous checks run in parallel — resolveAmbiguousChecks is
//     sequential internally for a single batch, so we wrap each check in
//     its own Promise.all slot.
//   - Returns an updated VerificationReport when the judgment pass ran,
//     otherwise returns the original report unchanged. Callers don't need
//     to care which happened.

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { resolveAmbiguousChecks } from './judgment-llm-executor';
import { deriveWeightedVerdict } from './judgment-scoring';

// Intentionally local shape — the client type is declared as a private
// alias in several files (judgment-llm-client, judgment-llm-executor,
// judgment-llm-client-factory) rather than exported. We replicate the
// minimal shape here so resolveReviewJudgment stays statically typed
// without forcing a cross-cutting refactor of those client modules.
type JudgmentLlmClient = {
  complete: (system: string, user: string) => Promise<string>;
};

const LLM_JUDGMENT_FIELD_IDS: ReadonlySet<string> = new Set([
  'country-of-origin',
  'applicant-address'
]);

interface JudgmentInput {
  report: VerificationReport;
  extraction: ReviewExtraction;
  client: JudgmentLlmClient;
}

/**
 * Resolve ambiguous field checks via a focused LLM prompt.
 *
 * If no checks match the LLM judgment allowlist OR the allowlist-matching
 * checks are not at `review` status, this is a no-op and the caller gets
 * back the original report.
 */
export async function resolveReviewJudgment(
  input: JudgmentInput
): Promise<VerificationReport> {
  const { report, extraction, client } = input;

  const { toJudge, toSkip } = partitionChecks(report.checks);

  if (toJudge.length === 0) {
    return report;
  }

  // Fire each judgment call concurrently.
  const judgedChecks = await Promise.all(
    toJudge.map((check) =>
      resolveAmbiguousChecks({
        checks: [check],
        beverageType: report.beverageType,
        client
      }).then((arr) => arr[0])
    )
  );

  const updatedChecks: CheckReview[] = [...toSkip, ...judgedChecks];

  const verdictResult = deriveWeightedVerdict({
    checks: updatedChecks,
    crossFieldChecks: report.crossFieldChecks,
    standalone: report.standalone,
    extraction
  });

  const counts = countStatuses(updatedChecks, report.crossFieldChecks);

  return {
    ...report,
    verdict: verdictResult.verdict,
    checks: updatedChecks,
    counts
  };
}

function partitionChecks(checks: CheckReview[]): {
  toJudge: CheckReview[];
  toSkip: CheckReview[];
} {
  const toJudge: CheckReview[] = [];
  const toSkip: CheckReview[] = [];

  for (const check of checks) {
    if (LLM_JUDGMENT_FIELD_IDS.has(check.id) && check.status === 'review') {
      toJudge.push(check);
    } else {
      toSkip.push(check);
    }
  }

  return { toJudge, toSkip };
}

function countStatuses(
  checks: CheckReview[],
  crossFieldChecks: readonly CheckReview[]
): { pass: number; review: number; fail: number } {
  const counts = { pass: 0, review: 0, fail: 0 };
  for (const c of checks) {
    if (c.status === 'pass') counts.pass += 1;
    else if (c.status === 'review') counts.review += 1;
    else if (c.status === 'fail') counts.fail += 1;
  }
  for (const c of crossFieldChecks) {
    if (c.status === 'pass') counts.pass += 1;
    else if (c.status === 'review') counts.review += 1;
    else if (c.status === 'fail') counts.fail += 1;
  }
  return counts;
}
