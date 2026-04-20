import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkReviewSchema,
  reviewExtractionSchema,
  verificationReportSchema
} from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import type { ReviewExtractor } from './review-extraction';
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
function buildExtractionPayload(overrides: Record<string, unknown> = {}) {
  return reviewExtractionSchema.parse({
    id: 'trace-extract-001',
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
        confidence: 0.9
      },
      continuousParagraph: {
        status: 'yes',
        confidence: 0.92
      },
      separateFromOtherContent: {
        status: 'yes',
        confidence: 0.88
      }
    },
    fields: {
      brandName: presentField('Trace Brand'),
      fancifulName: absentField(),
      classType: presentField('Vodka'),
      alcoholContent: presentField('45% Alc./Vol.'),
      netContents: presentField('750 mL'),
      applicantAddress: absentField(),
      countryOfOrigin: absentField(),
      ageStatement: absentField(),
      sulfiteDeclaration: absentField(),
      appellation: absentField(),
      vintage: absentField(),
      governmentWarning: presentField(
        'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
      ),
      varietals: []
    },
    summary: 'Structured extraction completed successfully.',
    ...overrides
  });
}
function buildWarningPayload() {
  return checkReviewSchema.parse({
    id: 'government-warning',
    label: 'Government warning',
    status: 'pass',
    severity: 'note',
    summary: 'Warning text and formatting look correct.',
    details: 'All warning sub-checks passed.',
    confidence: 0.93,
    citations: [],
    warning: {
      required:
        'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
      extracted:
        'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
      segments: [],
      subChecks: [
        {
          id: 'present',
          label: 'Warning text is present',
          status: 'pass',
          reason: 'Warning text was detected on the label.'
        },
        {
          id: 'exact-text',
          label: 'Warning text matches required wording',
          status: 'pass',
          reason: 'Warning text matches the canonical wording.'
        },
        {
          id: 'uppercase-bold-heading',
          label: 'Warning heading is uppercase and bold',
          status: 'pass',
          reason: 'Heading format is correct.'
        },
        {
          id: 'continuous-paragraph',
          label: 'Warning is shown as a continuous paragraph',
          status: 'pass',
          reason: 'Paragraph continuity is intact.'
        },
        {
          id: 'legibility',
          label: 'Warning is legible and separate from other content',
          status: 'pass',
          reason: 'Warning text remains readable and visually distinct.'
        }
      ]
    }
  });
}
function buildReviewPayload(overrides: Record<string, unknown> = {}) {
  return verificationReportSchema.parse({
    id: 'trace-report-001',
    mode: 'single-label',
    beverageType: 'distilled-spirits',
    verdict: 'approve',
    verdictSecondary: 'Clear extraction and deterministic checks support approval.',
    standalone: false,
    extractionQuality: {
      globalConfidence: 0.95,
      state: 'ok',
      note: 'Extraction quality is high.'
    },
    counts: {
      pass: 3,
      review: 0,
      fail: 0
    },
    checks: [buildWarningPayload()],
    crossFieldChecks: [],
    noPersistence: true,
    summary: 'Trace review passed all deterministic checks.',
    ...overrides
  });
}
type ReviewSurfaceCallInput = {
  surface: string;
  extractionMode?: string;
  clientTraceId?: string;
  fixtureId?: string;
  reportId?: string;
  deferResolver?: boolean;
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
};

type ExtractionSurfaceCallInput = {
  surface: string;
  extractionMode?: string;
  clientTraceId?: string;
  fixtureId?: string;
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
};

type WarningSurfaceCallInput = {
  surface: string;
  extractionMode?: string;
  clientTraceId?: string;
  fixtureId?: string;
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
};
const {
  runTracedReviewSurfaceMock,
  runTracedExtractionSurfaceMock,
  runTracedWarningSurfaceMock
} = vi.hoisted(() => ({
  runTracedReviewSurfaceMock: vi.fn(async () => buildReviewPayload()),
  runTracedExtractionSurfaceMock: vi.fn(async (input: ExtractionSurfaceCallInput) =>
    input.extractor(input.intake)
  ),
  runTracedWarningSurfaceMock: vi.fn(async () => buildWarningPayload())
}));
vi.mock('./llm-trace', () => ({
  runTracedReviewSurface: runTracedReviewSurfaceMock,
  runTracedExtractionSurface: runTracedExtractionSurfaceMock,
  runTracedWarningSurface: runTracedWarningSurfaceMock
}));
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

function readCallInput<T>(mockFn: unknown, index = 0) {
  const calls = (mockFn as { mock: { calls: Array<[T]> } }).mock.calls;
  return calls[index]?.[0];
}
function validReviewFields() {
  return {
    beverageType: 'auto',
    brandName: 'Trace Brand',
    fancifulName: '',
    classType: 'Vodka',
    alcoholContent: '45% Alc./Vol.',
    netContents: '750 mL',
    applicantAddress: '',
    origin: 'domestic',
    country: '',
    formulaId: '',
    appellation: '',
    vintage: '',
    varietals: []
  };
}

function buildLabelFile({
  name = 'label.png',
  type = 'image/png'
}: {
  name?: string;
  type?: string;
} = {}) {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type });
}

async function postReviewRoute(
  server: { address: () => AddressInfo | string | null },
  pathname: '/api/review' | '/api/review/extraction' | '/api/review/warning',
  traceId = 'trace-client-001'
) {
  const form = new FormData();
  form.append('label', buildLabelFile());
  form.append('fields', JSON.stringify(validReviewFields()));

  return await fetch(serverUrl(server, pathname), {
    method: 'POST',
    headers: {
      'x-review-client-id': traceId
    },
    body: form
  });
}

async function postBatchPreflight(
  server: { address: () => AddressInfo | string | null },
  imageName: string
) {
  const csv = new File(
    [
      [
        'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
        `${imageName},distilled-spirits,Trace Brand,,Vodka,45% Alc./Vol.,750 mL,Trace Distilling,domestic,,,,`
      ].join('\n')
    ],
    'applications.csv',
    { type: 'text/csv' }
  );

  const image = new File([new Uint8Array([1])], imageName, {
    type: 'image/png'
  });

  const form = new FormData();
  form.append(
    'manifest',
    JSON.stringify({
      batchClientId: 'batch-trace-001',
      images: [
        {
          clientId: 'image-trace-001',
          filename: image.name,
          sizeBytes: image.size,
          mimeType: image.type
        }
      ],
      csv: {
        filename: csv.name,
        sizeBytes: csv.size
      }
    })
  );
  form.append('labels', image);
  form.append('csv', csv);

  return await fetch(serverUrl(server, '/api/batch/preflight'), {
    method: 'POST',
    body: form
  });
}

afterEach(async () => {
  runTracedReviewSurfaceMock.mockClear();
  runTracedExtractionSurfaceMock.mockClear();
  runTracedWarningSurfaceMock.mockClear();
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

describe('LLM route trace surfaces', () => {
  it('routes /api/review through the integrated traced review surface', async () => {
    const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
    const server = await startServer({ extractor });
    serversToClose.push(server);

    const response = await postReviewRoute(server, '/api/review', 'trace-review-001');

    expect(response.status).toBe(200);
    expect(runTracedReviewSurfaceMock).toHaveBeenCalledTimes(1);

    const traceInput = readCallInput<ReviewSurfaceCallInput>(
      runTracedReviewSurfaceMock
    );

    expect(traceInput?.surface).toBe('/api/review');
    expect(traceInput?.extractionMode).toBe('cloud');
    expect(traceInput?.clientTraceId).toBe('trace-review-001');
    expect(traceInput?.extractor).toBe(extractor);
    expect(traceInput?.intake.label.originalName).toBe('label.png');
    expect(traceInput?.intake.fields.brandName).toBe('Trace Brand');
  });
  it('routes /api/review/extraction through the traced extraction surface', async () => {
    const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
    const server = await startServer({ extractor });
    serversToClose.push(server);

    const response = await postReviewRoute(
      server,
      '/api/review/extraction',
      'trace-extraction-001'
    );

    expect(response.status).toBe(200);
    expect(runTracedExtractionSurfaceMock).toHaveBeenCalledTimes(1);

    const traceInput = readCallInput<ExtractionSurfaceCallInput>(
      runTracedExtractionSurfaceMock
    );

    expect(traceInput?.surface).toBe('/api/review/extraction');
    expect(traceInput?.extractionMode).toBe('cloud');
    expect(traceInput?.clientTraceId).toBe('trace-extraction-001');
    expect(traceInput?.extractor).toBe(extractor);
    expect(traceInput?.intake.label.originalName).toBe('label.png');
    expect(traceInput?.intake.fields.brandName).toBe('Trace Brand');
  });

  it('routes /api/review/warning through the traced warning surface', async () => {
    const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
    const server = await startServer({ extractor });
    serversToClose.push(server);

    const response = await postReviewRoute(
      server,
      '/api/review/warning',
      'trace-warning-001'
    );

    expect(response.status).toBe(200);
    expect(runTracedWarningSurfaceMock).toHaveBeenCalledTimes(1);

    const traceInput = readCallInput<WarningSurfaceCallInput>(
      runTracedWarningSurfaceMock
    );

    expect(traceInput?.surface).toBe('/api/review/warning');
    expect(traceInput?.extractionMode).toBe('cloud');
    expect(traceInput?.clientTraceId).toBe('trace-warning-001');
    expect(traceInput?.extractor).toBe(extractor);
    expect(traceInput?.intake.label.originalName).toBe('label.png');
    expect(traceInput?.intake.fields.brandName).toBe('Trace Brand');
  });

  it('routes batch run and retry through their own traced review surfaces', async () => {
    const previousBatchResolverAggregation =
      process.env.BATCH_RESOLVER_AGGREGATION;
    process.env.BATCH_RESOLVER_AGGREGATION = 'enabled';
    runTracedReviewSurfaceMock
      .mockImplementationOnce(async () => {
        throw new Error('Trace review failed on the first batch attempt.');
      })
      .mockImplementationOnce(async () => buildReviewPayload());

    try {
      const server = await startServer({ extractor: vi.fn() });
      serversToClose.push(server);

      const preflightResponse = await postBatchPreflight(server, 'retry-trace.png');
      const preflightPayload = (await preflightResponse.json()) as {
        batchSessionId: string;
      };

      const runResponse = await fetch(serverUrl(server, '/api/batch/run'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          batchSessionId: preflightPayload.batchSessionId,
          resolutions: [
            {
              imageId: 'image-trace-001',
              action: {
                kind: 'matched',
                rowId: 'row-1'
              }
            }
          ]
        })
      });

      expect(runResponse.status).toBe(200);

      const retryResponse = await fetch(
        serverUrl(
          server,
          `/api/batch/${preflightPayload.batchSessionId}/retry/image-trace-001`
        ),
        {
          method: 'POST'
        }
      );

      expect(retryResponse.status).toBe(200);
      expect(runTracedReviewSurfaceMock).toHaveBeenCalledTimes(2);
      const batchRunTrace = readCallInput<ReviewSurfaceCallInput>(runTracedReviewSurfaceMock, 0);
      const batchRetryTrace = readCallInput<ReviewSurfaceCallInput>(runTracedReviewSurfaceMock, 1);
      expect(batchRunTrace?.surface).toBe('/api/batch/run');
      expect(batchRunTrace?.extractionMode).toBe('cloud');
      expect(batchRunTrace?.fixtureId).toBe('image-trace-001');
      expect(batchRunTrace?.clientTraceId).toBe('/api/batch/run:image-trace-001');
      expect(batchRunTrace?.deferResolver).toBeUndefined();
      expect(batchRetryTrace?.surface).toBe('/api/batch/retry');
      expect(batchRetryTrace?.extractionMode).toBe('cloud');
      expect(batchRetryTrace?.fixtureId).toBe('image-trace-001');
      expect(batchRetryTrace?.clientTraceId).toBe('/api/batch/retry:image-trace-001');
      expect(batchRetryTrace?.deferResolver).toBeUndefined();
    } finally {
      if (previousBatchResolverAggregation === undefined) {
        delete process.env.BATCH_RESOLVER_AGGREGATION;
      } else {
        process.env.BATCH_RESOLVER_AGGREGATION =
          previousBatchResolverAggregation;
      }
    }
  });
});
