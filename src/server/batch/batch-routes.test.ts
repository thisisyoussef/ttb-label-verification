import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  batchDashboardResponseSchema,
  batchExportPayloadSchema,
  batchPreflightResponseSchema,
  verificationReportSchema,
} from '../../shared/contracts/review';
import {
  buildExtractionPayload,
  cleanupTestResources,
  collectNdjsonFrames,
  postBatchPreflight,
  postBatchRun,
  presentField,
  registerServer,
  serverUrl,
  startServer
} from '../index.test-helpers';
import {
  createReviewExtractionFailure,
  type ReviewExtractor
} from '../extractors/review-extraction';

function createRetryableBatchFailure(message: string) {
  return createReviewExtractionFailure({
    status: 503,
    kind: 'network',
    message,
    retryable: true
  });
}
afterEach(cleanupTestResources);

describe('batch routes', () => {
  it('preflights batch uploads and returns matching plus file errors', async () => {
    const server = await startServer();
    registerServer(server);

    const csv = new File(
      [
        [
          'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
          'old-oak-bourbon.jpg,distilled-spirits,Old Oak Bourbon,,Kentucky Straight Bourbon,45% Alc./Vol.,750 mL,Old Oak Distilling,domestic,,,,',
          'stones-throw-gin.jpg,distilled-spirits,Stone Throw Gin,,Small Batch Gin,45% Alc./Vol.,750 mL,Stone Throw Distilling,domestic,,,,'
        ].join('\n')
      ],
      'applications.csv',
      { type: 'text/csv' }
    );

    const response = await postBatchPreflight(server, {
      images: [
        {
          id: 'image-1',
          file: new File([new Uint8Array([1])], 'old-oak-bourbon.jpg', {
            type: 'image/jpeg'
          })
        },
        {
          id: 'image-2',
          file: new File([new Uint8Array([2])], 'old-oak-bourbon.jpg', {
            type: 'image/jpeg'
          })
        },
        {
          id: 'image-3',
          file: new File([new Uint8Array([3])], 'notes.txt', {
            type: 'text/plain'
          })
        }
      ],
      csv
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const payload = batchPreflightResponseSchema.parse(await response.json());

    expect(payload.matching.matched).toHaveLength(1);
    expect(payload.fileErrors.map((entry) => entry.reason).sort()).toEqual([
      'duplicate',
      'unsupported-type'
    ]);
  });

  it('runs a batch, keeps submitted identity in the dashboard, exports reports, and retries errored items', async () => {
    let retryAttempts = 0;
    const extractor: ReviewExtractor = vi.fn(async (intake) => {
      if (intake.label.originalName === 'retry-me.png' && retryAttempts === 0) {
        retryAttempts += 1;
        throw createRetryableBatchFailure(
          'We could not reach the extraction service right now.'
        );
      }

      return buildExtractionPayload({
        fields: {
          brandName: presentField(
            intake.label.originalName === 'brand-pass.png'
              ? 'Submitted Brand Pass'
              : 'Submitted Retry Brand'
          ),
          classType: presentField('Straight Rye'),
          alcoholContent: presentField('45% Alc./Vol.'),
          netContents: presentField('750 mL')
        },
        summary: `Extracted ${intake.label.originalName}`
      });
    });

    const server = await startServer({ extractor });
    registerServer(server);

    const csv = new File(
      [
        [
          'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
          'brand-pass.png,distilled-spirits,Submitted Brand Pass,,Straight Rye,45% Alc./Vol.,750 mL,Pass Distilling,domestic,,,,',
          'retry-me.png,distilled-spirits,Submitted Retry Brand,,Straight Rye,45% Alc./Vol.,750 mL,Retry Distilling,domestic,,,,'
        ].join('\n')
      ],
      'applications.csv',
      { type: 'text/csv' }
    );

    const preflightResponse = await postBatchPreflight(server, {
      images: [
        {
          id: 'image-pass',
          file: new File([new Uint8Array([1])], 'brand-pass.png', {
            type: 'image/png'
          })
        },
        {
          id: 'image-retry',
          file: new File([new Uint8Array([2])], 'retry-me.png', {
            type: 'image/png'
          })
        }
      ],
      csv
    });

    const preflight = batchPreflightResponseSchema.parse(await preflightResponse.json());
    const runResponse = await postBatchRun(server, {
      batchSessionId: preflight.batchSessionId,
      resolutions: []
    });

    expect(runResponse.status).toBe(200);
    expect(runResponse.headers.get('cache-control')).toBe('no-store');

    const frames = await collectNdjsonFrames(runResponse);
    const summaryFrame = frames.at(-1);

    expect(frames[0]).toMatchObject({
      type: 'progress',
      done: 0,
      total: 2
    });
    expect(summaryFrame).toMatchObject({
      type: 'summary',
      total: 2,
      error: 0
    });

    const summaryResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/summary`)
    );
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.headers.get('cache-control')).toBe('no-store');
    const dashboard = batchDashboardResponseSchema.parse(await summaryResponse.json());

    const passRow = dashboard.rows.find((row) => row.imageId === 'image-pass');
    const errorRow = dashboard.rows.find((row) => row.imageId === 'image-retry');

    expect(passRow?.brandName).toBe('Submitted Brand Pass');
    expect(passRow?.status).not.toBe('error');
    expect(errorRow?.status).not.toBe('error');
    expect(errorRow?.reportId).not.toBeNull();

    const reportResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/report/${passRow?.reportId}`)
    );
    expect(reportResponse.headers.get('cache-control')).toBe('no-store');
    const report = verificationReportSchema.parse(await reportResponse.json());
    const brandCheck = report.checks.find((check) => check.id === 'brand-name');
    expect(brandCheck?.applicationValue).toBe('Submitted Brand Pass');

    const exportResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/export`)
    );
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get('cache-control')).toBe('no-store');
    expect(exportResponse.headers.get('content-disposition')).toContain(
      `ttb-batch-${preflight.batchSessionId}.json`
    );
    const exportPayload = batchExportPayloadSchema.parse(await exportResponse.json());
    expect(exportPayload.reports[passRow!.reportId!]?.id).toBe(report.id);
    expect(exportPayload.summary.error).toBe(0);
    expect(retryAttempts).toBe(1);
  }, 15000);

  it('surfaces a batch item only after two consecutive retryable failures and lets explicit retry recover it', async () => {
    let surfacedItemAttempts = 0;
    const extractor: ReviewExtractor = vi.fn(async (intake) => {
      if (intake.label.originalName === 'retry-me.png' && surfacedItemAttempts < 2) {
        surfacedItemAttempts += 1;
        throw createRetryableBatchFailure(
          'We could not reach the extraction service right now.'
        );
      }

      return buildExtractionPayload({
        fields: {
          brandName: presentField(
            intake.label.originalName === 'brand-pass.png'
              ? 'Submitted Brand Pass'
              : 'Submitted Retry Brand'
          ),
          classType: presentField('Straight Rye'),
          alcoholContent: presentField('45% Alc./Vol.'),
          netContents: presentField('750 mL')
        },
        summary: `Extracted ${intake.label.originalName}`
      });
    });

    const server = await startServer({ extractor });
    registerServer(server);

    const csv = new File(
      [
        [
          'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
          'brand-pass.png,distilled-spirits,Submitted Brand Pass,,Straight Rye,45% Alc./Vol.,750 mL,Pass Distilling,domestic,,,,',
          'retry-me.png,distilled-spirits,Submitted Retry Brand,,Straight Rye,45% Alc./Vol.,750 mL,Retry Distilling,domestic,,,,'
        ].join('\n')
      ],
      'applications.csv',
      { type: 'text/csv' }
    );

    const preflightResponse = await postBatchPreflight(server, {
      images: [
        {
          id: 'image-pass',
          file: new File([new Uint8Array([1])], 'brand-pass.png', {
            type: 'image/png'
          })
        },
        {
          id: 'image-retry',
          file: new File([new Uint8Array([2])], 'retry-me.png', {
            type: 'image/png'
          })
        }
      ],
      csv
    });

    const preflight = batchPreflightResponseSchema.parse(await preflightResponse.json());
    const runResponse = await postBatchRun(server, {
      batchSessionId: preflight.batchSessionId,
      resolutions: []
    });

    expect(runResponse.status).toBe(200);
    const frames = await collectNdjsonFrames(runResponse);
    const summaryFrame = frames.at(-1);

    expect(summaryFrame).toMatchObject({
      type: 'summary',
      total: 2,
      error: 1
    });

    const summaryResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/summary`)
    );
    const dashboard = batchDashboardResponseSchema.parse(await summaryResponse.json());
    const errorRow = dashboard.rows.find((row) => row.imageId === 'image-retry');

    expect(errorRow?.status).toBe('error');
    expect(errorRow?.reportId).toBeNull();
    expect(surfacedItemAttempts).toBe(2);

    const retryResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/retry/image-retry`),
      {
        method: 'POST'
      }
    );
    expect(retryResponse.status).toBe(200);
    expect(retryResponse.headers.get('cache-control')).toBe('no-store');
    const retriedDashboard = batchDashboardResponseSchema.parse(await retryResponse.json());
    const retriedRow = retriedDashboard.rows.find((row) => row.imageId === 'image-retry');

    expect(retriedRow?.status).not.toBe('error');
    expect(retriedRow?.reportId).not.toBeNull();
    expect(retriedDashboard.summary.error).toBe(0);
  }, 15000);

  it('marks batch cancellation responses as non-cacheable', async () => {
    const server = await startServer();
    registerServer(server);

    const csv = new File(
      [
        [
          'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
          'brand-pass.png,distilled-spirits,Submitted Brand Pass,,Straight Rye,45% Alc./Vol.,750 mL,Pass Distilling,domestic,,,,'
        ].join('\n')
      ],
      'applications.csv',
      { type: 'text/csv' }
    );

    const preflightResponse = await postBatchPreflight(server, {
      images: [
        {
          id: 'image-pass',
          file: new File([new Uint8Array([1])], 'brand-pass.png', {
            type: 'image/png'
          })
        }
      ],
      csv
    });
    const preflight = batchPreflightResponseSchema.parse(await preflightResponse.json());

    const cancelResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/cancel`),
      {
        method: 'POST'
      }
    );

    expect(cancelResponse.status).toBe(202);
    expect(cancelResponse.headers.get('cache-control')).toBe('no-store');
    expect(await cancelResponse.json()).toEqual({ status: 'cancelling' });
  });
});
