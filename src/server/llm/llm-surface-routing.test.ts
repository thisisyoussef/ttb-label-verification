import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkReviewSchema,
  verificationReportSchema
} from '../../shared/contracts/review';
import {
  buildExtractionPayload,
  buildLabelFile,
  cleanupTestResources,
  postBatchPreflight,
  postReview,
  postReviewExtraction,
  postReviewWarning,
  registerServer,
  serverUrl,
  startServer,
  validReviewFields
} from '../index.test-helpers';
import type { NormalizedReviewIntake } from '../review/review-intake';
import type { ReviewExtractor } from '../extractors/review-extraction';
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
function readCallInput<T>(mockFn: unknown, index = 0) {
  const calls = (mockFn as { mock: { calls: Array<[T]> } }).mock.calls;
  return calls[index]?.[0];
}
afterEach(async () => {
  runTracedReviewSurfaceMock.mockClear();
  runTracedExtractionSurfaceMock.mockClear();
  runTracedWarningSurfaceMock.mockClear();
  await cleanupTestResources();
});

describe('LLM route trace surfaces', () => {
  it('routes /api/review through the integrated traced review surface', async () => {
    const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReview(server, {
      file: buildLabelFile(),
      fields: JSON.stringify({ ...validReviewFields(), brandName: 'Trace Brand', classType: 'Vodka', alcoholContent: '45% Alc./Vol.', netContents: '750 mL' }),
      clientTraceId: 'trace-review-001'
    });

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
    registerServer(server);

    const response = await postReviewExtraction(server, {
      file: buildLabelFile(),
      fields: JSON.stringify({ ...validReviewFields(), brandName: 'Trace Brand', classType: 'Vodka', alcoholContent: '45% Alc./Vol.', netContents: '750 mL' }),
      clientTraceId: 'trace-extraction-001'
    });

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
    registerServer(server);

    const response = await postReviewWarning(server, {
      file: buildLabelFile(),
      fields: JSON.stringify({ ...validReviewFields(), brandName: 'Trace Brand', classType: 'Vodka', alcoholContent: '45% Alc./Vol.', netContents: '750 mL' }),
      clientTraceId: 'trace-warning-001'
    });

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
      .mockImplementationOnce(async () => {
        throw new Error('Trace review failed on the second batch attempt.');
      })
      .mockImplementationOnce(async () => buildReviewPayload());

    try {
      const server = await startServer({ extractor: vi.fn() });
      registerServer(server);

      const preflightResponse = await postBatchPreflight(server, {
        images: [
          {
            id: 'image-trace-001',
            file: buildLabelFile({ name: 'retry-trace.png', size: 1 })
          }
        ],
        csv: new File(
          [
            [
              'filename,beverage_type,brand_name,fanciful_name,class_type,alcohol_content,net_contents,applicant_address,origin,country,formula_id,appellation,vintage',
              'retry-trace.png,distilled-spirits,Trace Brand,,Vodka,45% Alc./Vol.,750 mL,Trace Distilling,domestic,,,,'
            ].join('\n')
          ],
          'applications.csv',
          { type: 'text/csv' }
        ),
        batchClientId: 'batch-trace-001'
      });
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
      await runResponse.text();

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
      expect(runTracedReviewSurfaceMock).toHaveBeenCalledTimes(3);
      const batchRunTrace = readCallInput<ReviewSurfaceCallInput>(runTracedReviewSurfaceMock, 0);
      const hiddenBatchRunRetryTrace = readCallInput<ReviewSurfaceCallInput>(
        runTracedReviewSurfaceMock,
        1
      );
      const batchRetryTrace = readCallInput<ReviewSurfaceCallInput>(runTracedReviewSurfaceMock, 2);
      expect(batchRunTrace?.surface).toBe('/api/batch/run');
      expect(batchRunTrace?.extractionMode).toBe('cloud');
      expect(batchRunTrace?.fixtureId).toBe('image-trace-001');
      expect(batchRunTrace?.clientTraceId).toBe('/api/batch/run:image-trace-001');
      expect(batchRunTrace?.deferResolver).toBeUndefined();
      expect(hiddenBatchRunRetryTrace?.surface).toBe('/api/batch/run');
      expect(hiddenBatchRunRetryTrace?.extractionMode).toBe('cloud');
      expect(hiddenBatchRunRetryTrace?.fixtureId).toBe('image-trace-001');
      expect(hiddenBatchRunRetryTrace?.clientTraceId).toBe('/api/batch/run:image-trace-001');
      expect(hiddenBatchRunRetryTrace?.deferResolver).toBeUndefined();
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
