/**
 * Executes focused LLM judgment calls for field mismatches that survive
 * deterministic code normalization.
 *
 * This is the "Call 3" from the three-call pipeline:
 * extraction → code normalization → (only if ambiguous) → LLM judgment.
 *
 * Uses temperature 0 for reproducibility. Only called for genuinely
 * ambiguous cases — most comparisons should be resolved in code.
 */

import type { CheckReview } from '../shared/contracts/review';
import { buildFieldJudgmentPrompt, type JudgmentInput, type JudgmentOutput } from './judgment-llm-prompt';

type JudgmentLlmClient = {
  complete: (system: string, user: string) => Promise<string>;
};

/**
 * Attempt to resolve ambiguous field checks via a focused LLM judgment call.
 *
 * Only processes checks with status='review' that have both an application
 * value and an extracted value (genuinely ambiguous comparisons).
 *
 * Returns the same checks array with upgraded dispositions where the LLM
 * was able to resolve the ambiguity. Unresolvable checks stay as review.
 */
export async function resolveAmbiguousChecks(input: {
  checks: CheckReview[];
  beverageType: string;
  client: JudgmentLlmClient | null;
}): Promise<CheckReview[]> {
  if (!input.client) {
    return input.checks;
  }

  const results: CheckReview[] = [];

  for (const check of input.checks) {
    // Only send genuinely ambiguous field comparisons to the LLM.
    // Skip: already pass, already fail, no comparison values, rule checks.
    if (
      check.status !== 'review' ||
      !check.applicationValue ||
      !check.extractedValue ||
      !check.comparison ||
      check.comparison.status === 'not-applicable'
    ) {
      results.push(check);
      continue;
    }

    try {
      const judgmentInput: JudgmentInput = {
        fieldId: check.id,
        fieldLabel: check.label,
        applicationValue: check.applicationValue,
        extractedValue: check.extractedValue,
        extractionConfidence: check.confidence,
        beverageType: input.beverageType,
        codeNormalizationResult: check.comparison.note ?? 'no code normalization details'
      };

      const { system, user } = buildFieldJudgmentPrompt(judgmentInput);
      const raw = await input.client.complete(system, user);
      const judgment = parseJudgmentOutput(raw);

      if (!judgment) {
        // LLM returned unparseable output — keep the code-based review
        results.push(check);
        continue;
      }

      if (judgment.disposition === 'APPROVE') {
        results.push({
          ...check,
          status: 'pass',
          severity: 'note',
          summary: 'Resolved by judgment: ' + judgment.reasoning,
          details: `[${judgment.ruleApplied}] ${judgment.reasoning}`,
          confidence: judgment.confidence,
          comparison: {
            ...check.comparison,
            status: 'match',
            note: `LLM judgment resolved: ${judgment.ruleApplied}`
          }
        });
      } else if (judgment.disposition === 'REJECT') {
        results.push({
          ...check,
          status: 'fail',
          severity: 'major',
          summary: 'Judgment: ' + judgment.reasoning,
          details: `[${judgment.ruleApplied}] ${judgment.reasoning}`,
          confidence: judgment.confidence,
          comparison: {
            ...check.comparison,
            note: `LLM judgment: ${judgment.ruleApplied}`
          }
        });
      } else {
        // REVIEW — LLM also couldn't resolve it. Keep as-is but add reasoning.
        results.push({
          ...check,
          details: check.details + ` | LLM judgment: ${judgment.reasoning}`,
          confidence: Math.min(check.confidence, judgment.confidence)
        });
      }
    } catch {
      // LLM call failed — keep the code-based review. Judgment is optional.
      results.push(check);
    }
  }

  return results;
}

function parseJudgmentOutput(raw: string): JudgmentOutput | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed.disposition === 'string' &&
      ['APPROVE', 'REVIEW', 'REJECT'].includes(parsed.disposition) &&
      typeof parsed.confidence === 'number'
    ) {
      return {
        disposition: parsed.disposition,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: String(parsed.reasoning ?? ''),
        ruleApplied: String(parsed.ruleApplied ?? 'unknown')
      };
    }

    return null;
  } catch {
    return null;
  }
}
