import {
  REVIEW_LATENCY_BUDGET_MS,
  verificationReportSchema,
  type CheckReview,
  type ReviewExtraction,
  type VerificationReport
} from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import { buildCrossFieldChecks } from './review-report-cross-field';
import { buildFieldChecks } from './review-report-field-checks';
import {
  buildExtractionQualityNote,
  countStatuses,
  deriveSummary,
  deriveVerdictSecondary
} from './review-report-helpers';
import { deriveWeightedVerdict } from './judgment-scoring';
import { createJudgmentLlmClient } from './judgment-llm-client-factory';
import {
  readResolverConfig,
  resolveAmbiguousFieldChecks
} from './llm-resolver';

/**
 * Re-derive the verdict, counts, and summary for an existing report
 * whose `checks` array has been patched after the fact (e.g. by the
 * batch-mode aggregated LLM resolver). This is the post-hoc companion
 * to `buildVerificationReport`'s inline resolver call: the caller
 * provides the already-built report plus the already-patched checks,
 * and we re-run the deterministic rollup steps only (no new LLM calls,
 * no new deterministic rule evaluations — both would be wasted work
 * since nothing else changed).
 *
 * Preserves all other fields of the original report verbatim.
 */
export function rebuildReportWithPatchedChecks(input: {
  report: VerificationReport;
  patchedChecks: CheckReview[];
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): VerificationReport {
  const counts = countStatuses(input.patchedChecks, input.report.crossFieldChecks);
  const verdictResult = deriveWeightedVerdict({
    checks: input.patchedChecks,
    crossFieldChecks: input.report.crossFieldChecks,
    standalone: input.report.standalone,
    extraction: input.extraction
  });
  const verdict = verdictResult.verdict;
  return verificationReportSchema.parse({
    ...input.report,
    verdict,
    verdictSecondary: deriveVerdictSecondary({
      verdict,
      checks: input.patchedChecks,
      crossFieldChecks: input.report.crossFieldChecks,
      standalone: input.report.standalone,
      extraction: input.extraction
    }),
    counts,
    checks: input.patchedChecks,
    summary: deriveSummary({
      verdict,
      standalone: input.report.standalone,
      extraction: input.extraction
    })
  });
}

export async function buildVerificationReport(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  id?: string;
  /**
   * When true, skip the per-label LLM uncertainty resolver. The caller is
   * responsible for running the resolver later (typically in batch mode
   * so multiple labels' ambiguous fields can be aggregated into one
   * Gemini call instead of N sequential ones).
   *
   * Default false — single-label flow runs the resolver inline.
   */
  deferResolver?: boolean;
  /**
   * Result of the parallel spirits same-field-of-vision VLM call.
   * Populated for distilled-spirits reviews when GEMINI_API_KEY is
   * configured. When omitted the cross-field check falls back to
   * the "please confirm by eye" placeholder so deploys without a
   * Gemini key still produce a coherent report.
   */
  spiritsColocation?: import('./spirits-colocation-check').SpiritsColocationResult | null;
}): Promise<VerificationReport> {
  const extractionQuality = {
    globalConfidence: input.extraction.imageQuality.score,
    state: input.extraction.imageQuality.state,
    note: buildExtractionQualityNote(input.extraction)
  } as const;

  if (input.extraction.imageQuality.state === 'no-text-extracted') {
    return verificationReportSchema.parse({
      id: input.id ?? input.extraction.id,
      mode: 'single-label',
      beverageType: input.extraction.beverageType,
      verdict: 'review',
      standalone: input.intake.standalone,
      extractionQuality,
      counts: {
        pass: 0,
        review: 0,
        fail: 0
      },
      checks: [],
      crossFieldChecks: [],
      latencyBudgetMs: REVIEW_LATENCY_BUDGET_MS,
      noPersistence: true,
      summary: 'No text could be extracted from the submitted label image.'
    });
  }

  const initialChecks = buildFieldChecks(input);
  initialChecks.push(input.warningCheck);

  // Sealed-verdict short-circuit: if any check already landed at status='fail'
  // with a blocker severity, the overall verdict will be 'reject' no matter
  // what the resolver decides. The resolver can ONLY upgrade review→pass,
  // never save a fail. So we skip the resolver entirely when the verdict is
  // already sealed. Zero latency cost on labels that are going to reject
  // anyway — the resolver's 2s timeout worst case simply doesn't apply.
  const verdictAlreadySealed = initialChecks.some(
    (check) => check.status === 'fail' && check.severity === 'blocker'
  );

  // LLM uncertainty resolver — one-directional review→pass upgrader. Only
  // fires when LLM_RESOLVER=enabled AND there are eligible ambiguous
  // fields AND the verdict isn't already sealed by a blocker fail AND
  // the caller hasn't explicitly deferred it (batch aggregation path).
  // See src/server/llm-resolver.ts for constraints.
  const resolverBase = readResolverConfig();
  const shouldRunResolver =
    resolverBase.enabled && !verdictAlreadySealed && !input.deferResolver;
  const resolverOutcome = await resolveAmbiguousFieldChecks({
    checks: initialChecks,
    config: {
      ...resolverBase,
      enabled: shouldRunResolver,
      client: shouldRunResolver ? createJudgmentLlmClient() : null
    }
  });
  const checks = resolverOutcome.checks;

  const crossFieldChecks = buildCrossFieldChecks({
    intake: input.intake,
    extraction: input.extraction,
    spiritsColocation: input.spiritsColocation
  });
  const counts = countStatuses(checks, crossFieldChecks);
  const verdictResult = deriveWeightedVerdict({
    checks,
    crossFieldChecks,
    standalone: input.intake.standalone,
    extraction: input.extraction
  });
  const verdict = verdictResult.verdict;

  return verificationReportSchema.parse({
    id: input.id ?? input.extraction.id,
    mode: 'single-label',
    beverageType: input.extraction.beverageType,
    verdict,
    verdictSecondary: deriveVerdictSecondary({
      verdict,
      checks,
      crossFieldChecks,
      standalone: input.intake.standalone,
      extraction: input.extraction
    }),
    standalone: input.intake.standalone,
    extractionQuality,
    counts,
    checks,
    crossFieldChecks,
    latencyBudgetMs: REVIEW_LATENCY_BUDGET_MS,
    noPersistence: true,
    summary: deriveSummary({
      verdict,
      standalone: input.intake.standalone,
      extraction: input.extraction
    })
  });
}
