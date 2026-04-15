import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  batchDashboardResponseSchema,
  batchExportPayloadSchema,
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  reviewExtractionSchema,
  verificationReportSchema,
  type ReviewExtraction,
  type ReviewExtractionFields,
  type ReviewExtractionImageQuality,
  type WarningVisualSignals
} from '../shared/contracts/review';
import {
  createReviewExtractionFailure,
  type ReviewExtractor
} from './review-extraction';
import { createApp } from './index';

const serversToClose: Array<{
  close: (callback: (error?: Error | undefined) => void) => void;
}> = [];

async function startServer(options: Parameters<typeof createApp>[0] = {}) {
  const app = createApp(options);

  return await new Promise<{
    close: (callback: (error?: Error | undefined) => void) => void;
    address: () => AddressInfo | string | null;
  }>((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function serverUrl(
  server: { address: () => AddressInfo | string | null },
  pathname: string
) {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Server address not available.');
  }

  return `http://127.0.0.1:${address.port}${pathname}`;
}

function presentField(value: string, confidence = 0.96) {
  return {
    present: true,
    value,
    confidence
  } as const;
}

function absentField(confidence = 0.08) {
  return {
    present: false,
    confidence
  } as const;
}

function buildExtractionPayload(
  overrides: {
    id?: string;
    beverageType?: ReviewExtraction['beverageType'];
    beverageTypeSource?: ReviewExtraction['beverageTypeSource'];
    modelBeverageTypeHint?: ReviewExtraction['modelBeverageTypeHint'];
    standalone?: boolean;
    hasApplicationData?: boolean;
    imageQuality?: Partial<ReviewExtractionImageQuality>;
    warningSignals?: Partial<WarningVisualSignals>;
    fields?: Partial<ReviewExtractionFields>;
    summary?: string;
  } = {}
) {
  const base = reviewExtractionSchema.parse({
    id: 'extract-demo-001',
    model: 'gpt-5.4',
    beverageType: 'distilled-spirits',
    beverageTypeSource: 'class-type',
    modelBeverageTypeHint: 'distilled-spirits',
    standalone: false,
    hasApplicationData: true,
    noPersistence: true,
    imageQuality: {
      score: 0.95,
      state: 'ok',
      issues: []
    },
    warningSignals: {
      prefixAllCaps: {
        status: 'yes',
        confidence: 0.98
      },
      prefixBold: {
        status: 'yes',
        confidence: 0.91
      },
      continuousParagraph: {
        status: 'yes',
        confidence: 0.9
      },
      separateFromOtherContent: {
        status: 'yes',
        confidence: 0.88
      }
    },
    fields: {
      brandName: presentField("Stone's Throw", 0.97),
      fancifulName: absentField(),
      classType: presentField('Vodka', 0.93),
      alcoholContent: presentField('45% alc./vol.', 0.91),
      netContents: presentField('750 mL', 0.92),
      applicantAddress: absentField(),
      countryOfOrigin: absentField(),
      ageStatement: absentField(),
      sulfiteDeclaration: absentField(),
      appellation: absentField(),
      vintage: absentField(),
      governmentWarning: presentField(
        'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
        0.97
      ),
      varietals: []
    },
    summary: 'Structured extraction completed successfully.'
  });

  return reviewExtractionSchema.parse({
    ...base,
    ...overrides,
    imageQuality: {
      ...base.imageQuality,
      ...overrides.imageQuality
    },
    warningSignals: {
      ...base.warningSignals,
      ...overrides.warningSignals
    },
    fields: {
      ...base.fields,
      ...overrides.fields
    }
  });
}

async function postBatchPreflight(
  server: { address: () => AddressInfo | string | null },
  options: {
    images: Array<{ id: string; file: File }>;
    csv: File;
    batchClientId?: string;
  }
) {
  const form = new FormData();
  form.append(
    'manifest',
    JSON.stringify({
      batchClientId: options.batchClientId ?? 'batch-client-001',
      images: options.images.map(({ id, file }) => ({
        clientId: id,
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type
      })),
      csv: {
        filename: options.csv.name,
        sizeBytes: options.csv.size
      }
    })
  );

  options.images.forEach(({ file }) => {
    form.append('labels', file);
  });
  form.append('csv', options.csv);

  return await fetch(serverUrl(server, '/api/batch/preflight'), {
    method: 'POST',
    body: form
  });
}

async function postBatchRun(
  server: { address: () => AddressInfo | string | null },
  payload: {
    batchSessionId: string;
    resolutions: Array<{
      imageId: string;
      action: { kind: 'matched'; rowId: string } | { kind: 'dropped' };
    }>;
  }
) {
  return await fetch(serverUrl(server, '/api/batch/run'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

async function collectNdjsonFrames(response: Response) {
  const text = await response.text();
  return text
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => batchStreamFrameSchema.parse(JSON.parse(line)));
}

afterEach(async () => {
  await Promise.all(
    serversToClose.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );
});

describe('batch routes', () => {
  it('preflights batch uploads and returns matching plus file errors', async () => {
    const server = await startServer();
    serversToClose.push(server);

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
        throw createReviewExtractionFailure({
          status: 503,
          kind: 'network',
          message: 'We could not reach the extraction service right now.',
          retryable: true
        });
      }

      return buildExtractionPayload({
        id: `extract-${intake.label.originalName}`,
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
    serversToClose.push(server);

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

    expect(frames[0]).toMatchObject({
      type: 'progress',
      done: 0,
      total: 2
    });
    expect(summaryFrame).toMatchObject({
      type: 'summary',
      total: 2,
      error: 1
    });

    const summaryResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/summary`)
    );
    expect(summaryResponse.status).toBe(200);
    const dashboard = batchDashboardResponseSchema.parse(await summaryResponse.json());

    const passRow = dashboard.rows.find((row) => row.imageId === 'image-pass');
    const errorRow = dashboard.rows.find((row) => row.imageId === 'image-retry');

    expect(passRow?.brandName).toBe('Submitted Brand Pass');
    expect(passRow?.status).not.toBe('error');
    expect(errorRow?.status).toBe('error');
    expect(errorRow?.reportId).toBeNull();

    const reportResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/report/${passRow?.reportId}`)
    );
    const report = verificationReportSchema.parse(await reportResponse.json());
    const brandCheck = report.checks.find((check) => check.id === 'brand-name');
    expect(brandCheck?.applicationValue).toBe('Submitted Brand Pass');

    const exportResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/export`)
    );
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get('content-disposition')).toContain(
      `ttb-batch-${preflight.batchSessionId}.json`
    );
    const exportPayload = batchExportPayloadSchema.parse(await exportResponse.json());
    expect(exportPayload.reports[passRow!.reportId!]?.id).toBe(report.id);

    const retryResponse = await fetch(
      serverUrl(server, `/api/batch/${preflight.batchSessionId}/retry/image-retry`),
      {
        method: 'POST'
      }
    );
    expect(retryResponse.status).toBe(200);
    const retriedDashboard = batchDashboardResponseSchema.parse(await retryResponse.json());
    const retriedRow = retriedDashboard.rows.find((row) => row.imageId === 'image-retry');

    expect(retriedRow?.status).not.toBe('error');
    expect(retriedRow?.reportId).not.toBeNull();
    expect(retriedDashboard.summary.error).toBe(0);
  }, 15000);
});
