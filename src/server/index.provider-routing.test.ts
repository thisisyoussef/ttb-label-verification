import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  batchDashboardResponseSchema,
  reviewExtractionSchema,
  verificationReportSchema
} from '../shared/contracts/review';
import {
  buildExtractionPayload,
  buildLabelFile,
  cleanupTestResources,
  collectNdjsonFrames,
  parseBatchPreflight,
  postBatchPreflight,
  postBatchRun,
  postReviewExtraction,
  registerServer,
  serverUrl,
  startServer,
  validReviewFields
} from './index.test-helpers';
import type { NormalizedReviewIntake } from './review-intake';
import { createReviewExtractionFailure } from './review-extraction';
import type {
  ReviewExtractorProvider,
  ReviewExtractorProviderFactories
} from './review-extractor-factory';

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
          (async () => buildExtractionPayload({ summary: 'OpenAI fallback extraction.' }))
      })
    })
  };
}

function extractionFromIntake(intake: NormalizedReviewIntake) {
  return buildExtractionPayload({
    summary: 'Extracted ' + (intake.fields.brandName ?? 'unknown brand'),
    fields: {
      brandName: {
        present: true,
        value: intake.fields.brandName ?? 'unknown brand',
        confidence: 0.98
      },
      classType: {
        present: true,
        value: intake.fields.classType ?? 'Vodka',
        confidence: 0.93
      },
      alcoholContent: {
        present: true,
        value: intake.fields.alcoholContent ?? '45% Alc./Vol.',
        confidence: 0.91
      },
      netContents: {
        present: true,
        value: intake.fields.netContents ?? '750 mL',
        confidence: 0.92
      }
    }
  });
}

afterEach(cleanupTestResources);

describe('server provider routing', () => {
  it('routes /api/review/extraction through Gemini first and preserves non-default submitted values', async () => {
    const geminiExecute = vi.fn(async (intake: NormalizedReviewIntake) =>
      extractionFromIntake(intake)
    );
    const openAiExecute = vi.fn(async (intake: NormalizedReviewIntake) =>
      extractionFromIntake(intake)
    );

    const server = await startServer({
      providerFactories: buildProviderFactories({
        geminiExecute,
        openAiExecute
      })
    });
    registerServer(server);

    const response = await postReviewExtraction(server, {
      fields: JSON.stringify({
        ...validReviewFields(),
        brandName: 'Gemini Routed Brand',
        classType: 'Vodka',
        alcoholContent: '45% Alc./Vol.',
        netContents: '750 mL'
      })
    });

    expect(response.status).toBe(200);

    const payload = reviewExtractionSchema.parse(await response.json());

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).not.toHaveBeenCalled();
    expect(payload.fields.brandName.value).toBe('Gemini Routed Brand');
  });

  it('falls back from retryable Gemini failures to OpenAI on /api/review/extraction', async () => {
    const geminiExecute = vi.fn().mockRejectedValue(
      createReviewExtractionFailure({
        status: 502,
        kind: 'network',
        message: 'Gemini is temporarily unavailable.',
        retryable: true
      })
    );
    const openAiExecute = vi.fn(async (intake: NormalizedReviewIntake) =>
      extractionFromIntake(intake)
    );

    const server = await startServer({
      providerFactories: buildProviderFactories({
        geminiExecute,
        openAiExecute
      })
    });
    registerServer(server);

    const response = await postReviewExtraction(server, {
      fields: JSON.stringify({
        ...validReviewFields(),
        brandName: 'Fallback Routed Brand',
        classType: 'Vodka',
        alcoholContent: '45% Alc./Vol.',
        netContents: '750 mL'
      })
    });

    expect(response.status).toBe(200);

    const payload = reviewExtractionSchema.parse(await response.json());

    expect(geminiExecute).toHaveBeenCalledTimes(1);
    expect(openAiExecute).toHaveBeenCalledTimes(1);
    expect(payload.fields.brandName.value).toBe('Fallback Routed Brand');
  });

  it(
    'uses the shared provider router for batch execution and preserves matched row values',
    async () => {
      const geminiExecute = vi.fn(async (intake: NormalizedReviewIntake) =>
        extractionFromIntake(intake)
      );

      const server = await startServer({
        providerFactories: buildProviderFactories({
          geminiExecute
        })
      });
      registerServer(server);

      const csv = new File(
        [
          [
            'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
            'batch-routed.png,distilled-spirits,Batch Routed Brand,,Vodka,45% Alc./Vol.,750 mL,Trace Distilling,domestic,,,,',
          ].join('\n')
        ],
        'applications.csv',
        { type: 'text/csv' }
      );

      const preflightResponse = await postBatchPreflight(server, {
        images: [
          {
            id: 'image-batch-routed',
            file: buildLabelFile({
              name: 'batch-routed.png',
              type: 'image/png'
            })
          }
        ],
        csv
      });

      const preflight = await parseBatchPreflight(preflightResponse);

      const runResponse = await postBatchRun(server, {
        batchSessionId: preflight.batchSessionId,
        resolutions: []
      });

      expect(runResponse.status).toBe(200);
      const frames = await collectNdjsonFrames(runResponse);
      expect(frames.at(-1)).toMatchObject({
        type: 'summary',
        total: 1,
        error: 0
      });

      expect(geminiExecute).toHaveBeenCalledTimes(1);
      expect(geminiExecute.mock.calls[0]?.[0].fields.brandName).toBe('Batch Routed Brand');

      const summaryResponse = await fetch(
        serverUrl(server, `/api/batch/${preflight.batchSessionId}/summary`)
      );
      expect(summaryResponse.status).toBe(200);
      const dashboard = batchDashboardResponseSchema.parse(await summaryResponse.json());
      const row = dashboard.rows.find((entry) => entry.imageId === 'image-batch-routed');
      expect(row?.brandName).toBe('Batch Routed Brand');

      const reportResponse = await fetch(
        serverUrl(server, `/api/batch/${preflight.batchSessionId}/report/${row?.reportId}`)
      );
      expect(reportResponse.status).toBe(200);
      const report = verificationReportSchema.parse(await reportResponse.json());
      const brandCheck = report.checks.find((check) => check.id === 'brand-name');
      expect(brandCheck?.applicationValue).toBe('Batch Routed Brand');
    },
    15_000
  );
});
