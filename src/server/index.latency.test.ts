import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildLabelFile,
  cleanupTestResources,
  collectNdjsonFrames,
  parseBatchPreflight,
  postBatchPreflight,
  postBatchRun,
  postReview,
  postReviewExtraction,
  postReviewWarning,
  registerServer,
  startServer,
  validReviewFields
} from './index.test-helpers';
import type { ReviewExtractorProvider } from './extractors/review-extractor-factory';
import type { ReviewLatencySummary } from './review/review-latency';
import { createReviewExtractionFailure } from './extractors/review-extraction';
import type {
  ReviewExtractorProviderFactories
} from './extractors/review-extractor-factory';
import type { NormalizedReviewIntake } from './review/review-intake';
import { buildExtractionPayload } from './index.test-helpers';

function provider(input: {
  provider: ReviewExtractorProvider['provider'];
  execute: ReviewExtractorProvider['execute'];
}): ReviewExtractorProvider {
  return {
    provider: input.provider,
    supports: () => true,
    execute: input.execute
  };
}

function buildProviderFactories(input: {
  geminiExecute: ReviewExtractorProvider['execute'];
  openAiExecute?: ReviewExtractorProvider['execute'];
}): ReviewExtractorProviderFactories {
  return {
    gemini: () => ({
      success: true,
      provider: provider({
        provider: 'gemini',
        execute: input.geminiExecute
      })
    }),
    openai: () => ({
      success: true,
      provider: provider({
        provider: 'openai',
        execute:
          input.openAiExecute ??
          (async (intake: NormalizedReviewIntake) =>
            buildExtractionPayload({
              summary: 'OpenAI fallback extraction.',
              fields: {
                brandName: {
                  present: true,
                  value: intake.fields.brandName ?? 'Fallback brand',
                  confidence: 0.98
                }
              }
            }))
      })
    })
  };
}

afterEach(cleanupTestResources);

describe('server latency summaries', () => {
  it('captures the primary-success path for /api/review without changing the report contract', async () => {
    const summaries: ReviewLatencySummary[] = [];
    const geminiExecute = vi.fn(async (intake: NormalizedReviewIntake) =>
      buildExtractionPayload({
        fields: {
          brandName: {
            present: true,
            value: intake.fields.brandName ?? 'Primary success brand',
            confidence: 0.97
          }
        }
      })
    );

    const server = await startServer({
      providerFactories: buildProviderFactories({
        geminiExecute
      }),
      latencyObserver: (summary) => summaries.push(summary)
    });
    registerServer(server);

    const response = await postReview(server, {
      fields: JSON.stringify({
        ...validReviewFields(),
        brandName: 'Primary success brand',
        classType: 'Vodka'
      }),
      clientTraceId: 'latency-review-primary-001'
    });

    expect(response.status).toBe(200);
    await response.json();

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      surface: '/api/review',
      outcomePath: 'primary-success',
      fallbackAttempted: false,
      providerOrder: ['gemini', 'openai'],
      clientTraceId: 'latency-review-primary-001'
    });
    expect(summaries[0]?.spans.some((span) => span.stage === 'report-shaping')).toBe(true);
  }, 15000);

  it('captures the fast-fail fallback path for /api/review/extraction', async () => {
    const summaries: ReviewLatencySummary[] = [];
    const geminiExecute = vi.fn().mockRejectedValue(
      createReviewExtractionFailure({
        status: 502,
        kind: 'network',
        message: 'Gemini is temporarily unavailable.',
        retryable: true
      })
    );
    const openAiExecute = vi.fn(async (intake: NormalizedReviewIntake) =>
      buildExtractionPayload({
        fields: {
          brandName: {
            present: true,
            value: intake.fields.brandName ?? 'Fallback brand',
            confidence: 0.96
          }
        }
      })
    );

    const server = await startServer({
      providerFactories: buildProviderFactories({
        geminiExecute,
        openAiExecute
      }),
      latencyObserver: (summary) => summaries.push(summary)
    });
    registerServer(server);

    const response = await postReviewExtraction(server, {
      fields: JSON.stringify({
        ...validReviewFields(),
        brandName: 'Fallback brand',
        classType: 'Vodka'
      }),
      clientTraceId: 'latency-extraction-fallback-001'
    });

    expect(response.status).toBe(200);
    await response.json();

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).toHaveBeenCalledTimes(1);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      surface: '/api/review/extraction',
      outcomePath: 'fast-fail-fallback-success',
      fallbackAttempted: true
    });
    expect(
      summaries[0]?.spans.find(
        (span) =>
          span.stage === 'fallback-handoff' &&
          span.attempt === 'fallback' &&
          span.outcome === 'success'
      )
    ).toBeTruthy();
  });

  it('captures the late-fail retryable path for /api/review/warning', async () => {
    const summaries: ReviewLatencySummary[] = [];
    const geminiExecute = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      throw createReviewExtractionFailure({
        status: 504,
        kind: 'timeout',
        message: 'Gemini timed out.',
        retryable: true
      });
    });
    const openAiExecute = vi.fn(async () => buildExtractionPayload());

    const server = await startServer({
      providerFactories: buildProviderFactories({
        geminiExecute,
        openAiExecute
      }),
      maxRetryableFallbackElapsedMs: 1,
      latencyObserver: (summary) => summaries.push(summary)
    });
    registerServer(server);

    const response = await postReviewWarning(server, {
      clientTraceId: 'latency-warning-late-fail-001'
    });

    expect(response.status).toBe(504);
    await response.json();

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).not.toHaveBeenCalled();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      surface: '/api/review/warning',
      outcomePath: 'late-fail-retryable',
      fallbackAttempted: false
    });
    expect(
      summaries[0]?.spans.find(
        (span) =>
          span.stage === 'fallback-handoff' &&
          span.outcome === 'late-fail'
      )
    ).toBeTruthy();
  });

  it('captures the pre-provider failure path when review upload validation stops early', async () => {
    const summaries: ReviewLatencySummary[] = [];

    const server = await startServer({
      latencyObserver: (summary) => summaries.push(summary)
    });
    registerServer(server);

    const response = await postReview(server, {
      file: null,
      clientTraceId: 'latency-review-pre-provider-001'
    });

    expect(response.status).toBe(400);
    await response.json();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      surface: '/api/review',
      outcomePath: 'pre-provider-failure',
      clientTraceId: 'latency-review-pre-provider-001'
    });
  });

  it('captures one timing summary per completed batch item', async () => {
    const summaries: ReviewLatencySummary[] = [];
    const geminiExecute = vi.fn(async () => buildExtractionPayload());

    const server = await startServer({
      providerFactories: buildProviderFactories({
        geminiExecute
      }),
      latencyObserver: (summary) => summaries.push(summary)
    });
    registerServer(server);

    const csv = new File(
      [
        [
          'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
          'batch-latency.png,distilled-spirits,Batch Latency Brand,,Vodka,45% Alc./Vol.,750 mL,Trace Distilling,domestic,,,,'
        ].join('\n')
      ],
      'applications.csv',
      { type: 'text/csv' }
    );

    const preflightResponse = await postBatchPreflight(server, {
      images: [
        {
          id: 'batch-image-latency-001',
          file: buildLabelFile({
            name: 'batch-latency.png',
            type: 'image/png'
          })
        }
      ],
      csv,
      batchClientId: 'batch-latency-client-001'
    });
    const preflight = await parseBatchPreflight(preflightResponse);
    const rowId = preflight.csvRows[0]?.id;

    expect(rowId).toBeTruthy();

    const runResponse = await postBatchRun(server, {
      batchSessionId: preflight.batchSessionId,
      resolutions: [
        {
          imageId: 'batch-image-latency-001',
          action: {
            kind: 'matched',
            rowId: rowId ?? ''
          }
        }
      ]
    });

    expect(runResponse.status).toBe(200);
    await collectNdjsonFrames(runResponse);

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      surface: '/api/batch/run',
      outcomePath: 'primary-success'
    });
    expect(summaries[0]?.spans.some((span) => span.stage === 'intake-normalization')).toBe(true);
  }, 15000);
});
