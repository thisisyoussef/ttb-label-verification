import { afterEach, expect } from 'vitest';
import * as ls from 'langsmith/vitest';

import {
  REVIEW_EXTRACTION_GUARDRAIL_POLICY,
  REVIEW_EXTRACTION_MODE,
  REVIEW_EXTRACTION_PROMPT_PROFILE,
  REVIEW_EXTRACTION_PROVIDER
} from '../../src/server/llm-policy';
import { batchEndpointCases, type BatchEndpointCase } from './support/endpoint-cases';
import { summarizeBatchSummary } from './support/output-summaries';
import { cleanupTestResources, runBatchEvalCase } from './support/route-runner';

afterEach(cleanupTestResources);

function requireBatchCase(caseId: string): BatchEndpointCase {
  const caseItem = batchEndpointCases.find((entry) => entry.caseId === caseId);
  if (!caseItem) {
    throw new Error(`Missing batch endpoint case ${caseId}.`);
  }
  return caseItem;
}

ls.describe('TTB batch route golden evals', () => {
  ls.test.each(
    batchEndpointCases.map((caseItem) => ({
      caseKey: `${caseItem.caseId}:batch`,
      inputs: {
        caseId: caseItem.caseId,
        endpointSurface: '/api/batch/run'
      },
      referenceOutputs: caseItem.expected,
      ...caseItem
    }))
  )('$caseKey $title', async ({ inputs }) => {
    const caseItem = requireBatchCase(inputs.caseId);
    const { expected, personas, personaObservation } = caseItem;
    const result = await runBatchEvalCase(caseItem);
    const runSummary = summarizeBatchSummary(result.runSummary);
    const retrySummary = result.retrySummary
      ? summarizeBatchSummary(result.retrySummary)
      : undefined;

    ls.logOutputs({
      endpointSurface: '/api/batch/run',
      caseId: caseItem.caseId,
      title: caseItem.title,
      extractionMode: REVIEW_EXTRACTION_MODE,
      provider: REVIEW_EXTRACTION_PROVIDER,
      promptProfile: REVIEW_EXTRACTION_PROMPT_PROFILE,
      guardrailPolicy: REVIEW_EXTRACTION_GUARDRAIL_POLICY,
      fixtureMode: 'golden-fixture',
      runLatencyMs: result.runLatencyMs,
      retryLatencyMs: result.retryLatencyMs,
      latencySummaries: result.latencySummaries,
      personas,
      personaObservation,
      actual: {
        runSummary,
        retrySummary
      }
    });

    expect(result.runSummary.summary).toEqual(expected.summaryAfterRun);
    expect(result.runSummary.rows[0]?.status).toBe(expected.runStatus);

    if (expected.summaryAfterRetry) {
      expect(result.retrySummary?.summary).toEqual(expected.summaryAfterRetry);
    }

    if (expected.retryStatus) {
      expect(result.retrySummary?.rows[0]?.status).toBe(expected.retryStatus);
    }

    ls.logFeedback({
      key: `${caseItem.caseId.toLowerCase()}-contract-match`,
      score:
        JSON.stringify(result.runSummary.summary) ===
          JSON.stringify(expected.summaryAfterRun) &&
        result.runSummary.rows[0]?.status === expected.runStatus
    });
    ls.logFeedback({
      key: `${caseItem.caseId.toLowerCase()}-latency-stable`,
      score: result.runLatencyMs < 1500
    });
    ls.logFeedback({
      key: `${caseItem.caseId.toLowerCase()}-retry-contained`,
      score:
        expected.retryStatus === undefined
          ? true
          : result.retrySummary?.rows[0]?.status === expected.retryStatus
    });
    personas.forEach((persona: string) => {
      ls.logFeedback({
        key: `persona-${persona.toLowerCase()}`,
        score:
          JSON.stringify(result.runSummary.summary) ===
          JSON.stringify(expected.summaryAfterRun)
      });
    });
  });
});
