import {
  batchDashboardResponseSchema,
  checkReviewSchema,
  reviewExtractionSchema,
  verificationReportSchema
} from '../../../src/shared/contracts/review';
import {
  createOpenAIReviewExtractor,
  type ReviewExtractionConfig
} from '../../../src/server/openai-review-extractor';
import {
  buildLabelFile,
  cleanupTestResources,
  collectNdjsonFrames,
  parseBatchPreflight,
  postBatchPreflight,
  postBatchRetry,
  postBatchRun,
  postReview,
  postReviewExtraction,
  postReviewWarning,
  registerServer,
  serverUrl,
  startServer
} from '../../../src/server/index.test-helpers';
import type {
  BatchEndpointCase,
  ExtractionEndpointCase,
  ReviewEndpointCase,
  WarningEndpointCase
} from './endpoint-cases';
import { createFixtureOpenAIClient } from './fixture-openai-client';

const FIXTURE_OPENAI_CONFIG: ReviewExtractionConfig = {
  apiKey: 'fixture-openai-key',
  visionModel: 'gpt-5.4',
  store: false
};

function buildFixtureBytes(byteSignature: string) {
  return Uint8Array.from(Buffer.from(byteSignature, 'hex'));
}

function buildFixtureExtractor(input: {
  fixtureId: string;
  byteSignature: string;
  steps: Parameters<typeof createFixtureOpenAIClient>[0][number]['steps'];
}) {
  return createOpenAIReviewExtractor({
    config: FIXTURE_OPENAI_CONFIG,
    client: createFixtureOpenAIClient([
      {
        fixtureId: input.fixtureId,
        byteSignature: input.byteSignature,
        steps: input.steps
      }
    ]) as NonNullable<Parameters<typeof createOpenAIReviewExtractor>[0]['client']>
  });
}

function buildBatchCsv(caseItem: BatchEndpointCase) {
  const row = caseItem.batchRow;

  return new File(
    [
      [
        'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
        [
          caseItem.labelFilename,
          row.beverageType,
          row.brandName,
          row.fancifulName,
          row.classType,
          row.alcoholContent,
          row.netContents,
          row.applicantAddress,
          row.origin,
          row.country,
          row.formulaId,
          row.appellation,
          row.vintage
        ].join(',')
      ].join('\n')
    ],
    'applications.csv',
    { type: 'text/csv' }
  );
}

export async function runReviewEvalCase(caseItem: ReviewEndpointCase) {
  const extractor = buildFixtureExtractor({
    fixtureId: `${caseItem.caseId}:review`,
    byteSignature: caseItem.byteSignature,
    steps: [{ type: 'output', output: caseItem.modelOutput }]
  });
  const server = await startServer({ extractor });
  registerServer(server);

  const startedAt = performance.now();
  const response = await postReview(server, {
    file: buildLabelFile({
      name: caseItem.labelFilename,
      data: buildFixtureBytes(caseItem.byteSignature)
    }),
    fields: caseItem.fields ? JSON.stringify(caseItem.fields) : null
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  return {
    latencyMs,
    payload: verificationReportSchema.parse(await response.json())
  };
}

export async function runExtractionEvalCase(caseItem: ExtractionEndpointCase) {
  const extractor = buildFixtureExtractor({
    fixtureId: `${caseItem.caseId}:extraction`,
    byteSignature: caseItem.byteSignature,
    steps: [{ type: 'output', output: caseItem.modelOutput }]
  });
  const server = await startServer({ extractor });
  registerServer(server);

  const startedAt = performance.now();
  const response = await postReviewExtraction(server, {
    file: buildLabelFile({
      name: caseItem.labelFilename,
      data: buildFixtureBytes(caseItem.byteSignature)
    }),
    fields: caseItem.fields ? JSON.stringify(caseItem.fields) : null
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  return {
    latencyMs,
    payload: reviewExtractionSchema.parse(await response.json())
  };
}

export async function runWarningEvalCase(caseItem: WarningEndpointCase) {
  const extractor = buildFixtureExtractor({
    fixtureId: `${caseItem.caseId}:warning`,
    byteSignature: caseItem.byteSignature,
    steps: [{ type: 'output', output: caseItem.modelOutput }]
  });
  const server = await startServer({ extractor });
  registerServer(server);

  const startedAt = performance.now();
  const response = await postReviewWarning(server, {
    file: buildLabelFile({
      name: caseItem.labelFilename,
      data: buildFixtureBytes(caseItem.byteSignature)
    }),
    fields: caseItem.fields ? JSON.stringify(caseItem.fields) : null
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  return {
    latencyMs,
    payload: checkReviewSchema.parse(await response.json())
  };
}

export async function runBatchEvalCase(caseItem: BatchEndpointCase) {
  const extractor = buildFixtureExtractor({
    fixtureId: `${caseItem.caseId}:batch`,
    byteSignature: caseItem.byteSignature,
    steps: caseItem.steps.map((step) =>
      step.type === 'error'
        ? {
            type: 'error',
            error: new Error('unreachable')
          }
        : step
    )
  });
  const server = await startServer({ extractor });
  registerServer(server);

  const imageId = 'batch-image-001';
  const preflightResponse = await postBatchPreflight(server, {
    images: [
      {
        id: imageId,
        file: buildLabelFile({
          name: caseItem.labelFilename,
          data: buildFixtureBytes(caseItem.byteSignature)
        })
      }
    ],
    csv: buildBatchCsv(caseItem),
    batchClientId: `${caseItem.caseId}-batch`
  });
  const preflight = await parseBatchPreflight(preflightResponse);
  const rowId = preflight.csvRows[0]?.id;

  if (!rowId) {
    throw new Error(`Preflight did not return a row id for ${caseItem.caseId}.`);
  }

  const startedAt = performance.now();
  const runResponse = await postBatchRun(server, {
    batchSessionId: preflight.batchSessionId,
    resolutions: [
      {
        imageId,
        action: {
          kind: 'matched',
          rowId
        }
      }
    ]
  });
  const runLatencyMs = Math.round(performance.now() - startedAt);
  const runFrames = await collectNdjsonFrames(runResponse);
  const runSummary = batchDashboardResponseSchema.parse(
    await fetch(serverUrl(server, `/api/batch/${preflight.batchSessionId}/summary`)).then(
      (response) => response.json()
    )
  );

  let retrySummary:
    | ReturnType<typeof batchDashboardResponseSchema.parse>
    | undefined;
  let retryLatencyMs: number | undefined;

  if (caseItem.steps.some((step) => step.type === 'error')) {
    const retryStartedAt = performance.now();
    const retryResponse = await postBatchRetry(
      server,
      preflight.batchSessionId,
      imageId
    );
    retryLatencyMs = Math.round(performance.now() - retryStartedAt);
    retrySummary = batchDashboardResponseSchema.parse(await retryResponse.json());
  }

  return {
    runLatencyMs,
    retryLatencyMs,
    runFrames,
    runSummary,
    retrySummary
  };
}

export { cleanupTestResources };
