import { afterEach, expect } from 'vitest';
import * as ls from 'langsmith/vitest';

import {
  REVIEW_EXTRACTION_GUARDRAIL_POLICY,
  REVIEW_EXTRACTION_PROMPT_PROFILE,
  REVIEW_EXTRACTION_PROVIDER
} from '../../src/server/llm-policy';
import {
  extractionEndpointCases,
  type ExtractionEndpointCase,
  reviewEndpointCases,
  type ReviewEndpointCase,
  type WarningEndpointCase,
  warningEndpointCases
} from './support/endpoint-cases';
import {
  cleanupTestResources,
  runExtractionEvalCase,
  runReviewEvalCase,
  runWarningEvalCase
} from './support/route-runner';
import {
  summarizeExtractionPayload,
  summarizeReviewPayload,
  summarizeWarningPayload
} from './support/output-summaries';

const FIXTURE_TRACE_CONTEXT = {
  provider: REVIEW_EXTRACTION_PROVIDER,
  promptProfile: REVIEW_EXTRACTION_PROMPT_PROFILE,
  guardrailPolicy: REVIEW_EXTRACTION_GUARDRAIL_POLICY,
  fixtureMode: 'golden-fixture'
} as const;

afterEach(cleanupTestResources);

function requireReviewCase(caseId: string): ReviewEndpointCase {
  const caseItem = reviewEndpointCases.find((entry) => entry.caseId === caseId);
  if (!caseItem) {
    throw new Error(`Missing review endpoint case ${caseId}.`);
  }
  return caseItem;
}

function requireExtractionCase(caseId: string): ExtractionEndpointCase {
  const caseItem = extractionEndpointCases.find((entry) => entry.caseId === caseId);
  if (!caseItem) {
    throw new Error(`Missing extraction endpoint case ${caseId}.`);
  }
  return caseItem;
}

function requireWarningCase(caseId: string): WarningEndpointCase {
  const caseItem = warningEndpointCases.find((entry) => entry.caseId === caseId);
  if (!caseItem) {
    throw new Error(`Missing warning endpoint case ${caseId}.`);
  }
  return caseItem;
}

function logCommonFeedback(input: {
  keyPrefix: string;
  contractMatch: boolean;
  noPersistence: boolean;
  latencyMs: number;
  personas: string[];
}) {
  ls.logFeedback({
    key: `${input.keyPrefix}-contract-match`,
    score: input.contractMatch
  });
  ls.logFeedback({
    key: `${input.keyPrefix}-privacy-safe`,
    score: input.noPersistence
  });
  ls.logFeedback({
    key: `${input.keyPrefix}-latency-stable`,
    score: input.latencyMs < 1500
  });

  input.personas.forEach((persona) => {
    ls.logFeedback({
      key: `persona-${persona.toLowerCase()}`,
      score: input.contractMatch && input.noPersistence
    });
  });
}

ls.describe('TTB review route golden evals', () => {
  ls.test.each(
    reviewEndpointCases.map((caseItem) => ({
      caseKey: `${caseItem.caseId}:review`,
      inputs: {
        caseId: caseItem.caseId,
        endpointSurface: '/api/review'
      },
      referenceOutputs: {
        verdict: caseItem.expected.verdict,
        summaryIncludes: caseItem.expected.summaryIncludes
      },
      ...caseItem
    }))
  )('$caseKey $title', async ({ inputs }) => {
    const caseItem = requireReviewCase(inputs.caseId);
    const { expected, personas, personaObservation } = caseItem;
    const { payload, latencyMs } = await runReviewEvalCase(caseItem);
    const summary = summarizeReviewPayload(payload);

    ls.logOutputs({
      ...FIXTURE_TRACE_CONTEXT,
      endpointSurface: '/api/review',
      caseId: caseItem.caseId,
      title: caseItem.title,
      latencyMs,
      personas,
      personaObservation,
      actual: summary
    });

    expect(payload.verdict).toBe(expected.verdict);
    expect(payload.summary).toContain(expected.summaryIncludes);

    expected.reviewCheckIds?.forEach((checkId: string) => {
      expect(
        [...payload.checks, ...payload.crossFieldChecks].find(
          (check) => check.id === checkId
        )?.status
      ).toBe('review');
    });

    expected.failCheckIds?.forEach((checkId: string) => {
      expect(
        [...payload.checks, ...payload.crossFieldChecks].find(
          (check) => check.id === checkId
        )?.status
      ).toBe('fail');
    });

    if (expected.standalone !== undefined) {
      expect(payload.standalone).toBe(expected.standalone);
    }

    if (expected.extractionState) {
      expect(payload.extractionQuality.state).toBe(expected.extractionState);
    }

    logCommonFeedback({
      keyPrefix: caseItem.caseId.toLowerCase(),
      contractMatch: payload.verdict === expected.verdict,
      noPersistence: payload.noPersistence,
      latencyMs,
      personas
    });
  });
});

ls.describe('TTB extraction route golden evals', () => {
  ls.test.each(
    extractionEndpointCases.map((caseItem) => ({
      caseKey: `${caseItem.caseId}:extraction`,
      inputs: {
        caseId: caseItem.caseId,
        endpointSurface: '/api/review/extraction'
      },
      referenceOutputs: caseItem.expected,
      ...caseItem
    }))
  )('$caseKey $title', async ({ inputs }) => {
    const caseItem = requireExtractionCase(inputs.caseId);
    const { expected, personas, personaObservation } = caseItem;
    const { payload, latencyMs } = await runExtractionEvalCase(caseItem);
    const summary = summarizeExtractionPayload(payload);

    ls.logOutputs({
      ...FIXTURE_TRACE_CONTEXT,
      endpointSurface: '/api/review/extraction',
      caseId: caseItem.caseId,
      title: caseItem.title,
      latencyMs,
      personas,
      personaObservation,
      actual: summary
    });

    expect(payload.beverageType).toBe(expected.beverageType);
    expect(payload.beverageTypeSource).toBe(expected.beverageTypeSource);
    expect(payload.standalone).toBe(expected.standalone);
    expect(payload.hasApplicationData).toBe(expected.hasApplicationData);
    expect(payload.imageQuality.state).toBe(expected.imageQualityState);
    expect(summary.presentFieldIds).toEqual(expected.presentFieldIds);

    logCommonFeedback({
      keyPrefix: caseItem.caseId.toLowerCase(),
      contractMatch:
        payload.beverageType === expected.beverageType &&
        payload.imageQuality.state === expected.imageQualityState,
      noPersistence: payload.noPersistence,
      latencyMs,
      personas
    });
  });
});

ls.describe('TTB warning route golden evals', () => {
  ls.test.each(
    warningEndpointCases.map((caseItem) => ({
      caseKey: `${caseItem.caseId}:warning`,
      inputs: {
        caseId: caseItem.caseId,
        endpointSurface: '/api/review/warning'
      },
      referenceOutputs: caseItem.expected,
      ...caseItem
    }))
  )('$caseKey $title', async ({ inputs }) => {
    const caseItem = requireWarningCase(inputs.caseId);
    const { expected, personas, personaObservation } = caseItem;
    const { payload, latencyMs } = await runWarningEvalCase(caseItem);
    const summary = summarizeWarningPayload(payload);

    ls.logOutputs({
      ...FIXTURE_TRACE_CONTEXT,
      endpointSurface: '/api/review/warning',
      caseId: caseItem.caseId,
      title: caseItem.title,
      latencyMs,
      personas,
      personaObservation,
      actual: summary
    });

    expect(payload.status).toBe(expected.status);

    Object.entries(expected.subChecks).forEach(([subCheckId, status]) => {
      expect(
        payload.warning?.subChecks.find((subCheck) => subCheck.id === subCheckId)
          ?.status
      ).toBe(status);
    });

    logCommonFeedback({
      keyPrefix: caseItem.caseId.toLowerCase(),
      contractMatch: payload.status === expected.status,
      noPersistence: true,
      latencyMs,
      personas
    });
  });
});
