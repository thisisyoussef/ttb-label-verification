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

export async function buildVerificationReport(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  id?: string;
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
  // fields AND the verdict isn't already sealed by a blocker fail.
  // See src/server/llm-resolver.ts for constraints.
  const resolverBase = readResolverConfig();
  const resolverOutcome = await resolveAmbiguousFieldChecks({
    checks: initialChecks,
    config: {
      ...resolverBase,
      enabled: resolverBase.enabled && !verdictAlreadySealed,
      client:
        resolverBase.enabled && !verdictAlreadySealed
          ? createJudgmentLlmClient()
          : null
    }
  });
  const checks = resolverOutcome.checks;

  const crossFieldChecks = buildCrossFieldChecks(input);
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
