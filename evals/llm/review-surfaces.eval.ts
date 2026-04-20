import { afterEach, describe, expect, test } from 'vitest';

import {
  REVIEW_EXTRACTION_MODE,
  REVIEW_EXTRACTION_PROVIDER
} from '../../src/server/llm/llm-policy';
import { resolveReviewPromptPolicy } from '../../src/server/review/review-prompt-policy';
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
  extractionMode: REVIEW_EXTRACTION_MODE,
  provider: REVIEW_EXTRACTION_PROVIDER,
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
  void input;
}

function resolveFixturePolicy(surface: '/api/review' | '/api/review/extraction' | '/api/review/warning') {
  return resolveReviewPromptPolicy({
    surface,
    extractionMode: REVIEW_EXTRACTION_MODE
  });
}

describe('TTB review route golden evals', () => {
  test.each(
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
    const { payload, latencyMs, latencySummary } = await runReviewEvalCase(caseItem);
    const summary = summarizeReviewPayload(payload);
    const promptPolicy = resolveFixturePolicy('/api/review');

    const diagnostics = {
      ...FIXTURE_TRACE_CONTEXT,
      endpointSurface: '/api/review',
      promptProfile: promptPolicy.promptProfile,
      guardrailPolicy: promptPolicy.guardrailPolicy,
      caseId: caseItem.caseId,
      title: caseItem.title,
      latencyMs,
      latencySummary,
      personas,
      personaObservation,
      actual: summary
    };
    void diagnostics;

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

describe('TTB extraction route golden evals', () => {
  test.each(
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
    const { payload, latencyMs, latencySummary } = await runExtractionEvalCase(caseItem);
    const summary = summarizeExtractionPayload(payload);
    const promptPolicy = resolveFixturePolicy('/api/review/extraction');

    const diagnostics = {
      ...FIXTURE_TRACE_CONTEXT,
      endpointSurface: '/api/review/extraction',
      promptProfile: promptPolicy.promptProfile,
      guardrailPolicy: promptPolicy.guardrailPolicy,
      caseId: caseItem.caseId,
      title: caseItem.title,
      latencyMs,
      latencySummary,
      personas,
      personaObservation,
      actual: summary
    };
    void diagnostics;

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

describe('TTB warning route golden evals', () => {
  test.each(
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
    const { payload, latencyMs, latencySummary } = await runWarningEvalCase(caseItem);
    const summary = summarizeWarningPayload(payload);
    const promptPolicy = resolveFixturePolicy('/api/review/warning');

    const diagnostics = {
      ...FIXTURE_TRACE_CONTEXT,
      endpointSurface: '/api/review/warning',
      promptProfile: promptPolicy.promptProfile,
      guardrailPolicy: promptPolicy.guardrailPolicy,
      caseId: caseItem.caseId,
      title: caseItem.title,
      latencyMs,
      latencySummary,
      personas,
      personaObservation,
      actual: summary
    };
    void diagnostics;

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
