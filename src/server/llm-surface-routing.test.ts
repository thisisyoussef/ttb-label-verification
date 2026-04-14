import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { reviewExtractionSchema } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';
import type { ReviewExtractor } from './review-extraction';
import { createReviewExtractionFailure } from './review-extraction';

type TraceCallInput = {
  surface: string;
  fixtureId?: string;
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
};

const { runTracedReviewExtractionMock } = vi.hoisted(() => ({
  runTracedReviewExtractionMock: vi.fn(
    async (input: TraceCallInput) => input.extractor(input.intake)
  )
}));

vi.mock('./llm-trace', () => ({
  runTracedReviewExtraction: runTracedReviewExtractionMock
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

async function postReviewRoute(
  server: { address: () => AddressInfo | string | null },
  pathname: '/api/review' | '/api/review/extraction' | '/api/review/warning'
) {
  const form = new FormData();
  form.append('label', buildLabelFile());
  form.append('fields', JSON.stringify(validReviewFields()));

  return await fetch(serverUrl(server, pathname), {
    method: 'POST',
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
  runTracedReviewExtractionMock.mockClear();

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
  it.each([
    ['/api/review', '/api/review'],
    ['/api/review/extraction', '/api/review/extraction'],
    ['/api/review/warning', '/api/review/warning']
  ] as const)(
    'routes %s through the traced extraction surface',
    async (pathname, surface) => {
      const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
      const server = await startServer({ extractor });
      serversToClose.push(server);

      const response = await postReviewRoute(server, pathname);

      expect(response.status).toBe(200);
      expect(runTracedReviewExtractionMock).toHaveBeenCalledTimes(1);

      const traceInput = runTracedReviewExtractionMock.mock.calls[0]?.[0];

      expect(traceInput?.surface).toBe(surface);
      expect(traceInput?.extractor).toBe(extractor);
      expect(traceInput?.intake.label.originalName).toBe('label.png');
      expect(traceInput?.intake.fields.brandName).toBe('Trace Brand');
    }
  );

  it('routes batch run and retry through their own traced extraction surfaces', async () => {
    const extractor = vi.fn(async (intake) => {
      if (intake.label.originalName === 'retry-trace.png' && extractor.mock.calls.length === 1) {
        throw createReviewExtractionFailure({
          status: 503,
          kind: 'network',
          message: 'We could not reach the extraction service right now.',
          retryable: true
        });
      }

      return buildExtractionPayload({
        id: `trace-${intake.label.originalName}`
      });
    });

    const server = await startServer({ extractor });
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
    expect(runTracedReviewExtractionMock).toHaveBeenCalledTimes(2);
    expect(runTracedReviewExtractionMock.mock.calls[0]?.[0]?.surface).toBe(
      '/api/batch/run'
    );
    expect(runTracedReviewExtractionMock.mock.calls[0]?.[0]?.fixtureId).toBe(
      'image-trace-001'
    );
    expect(runTracedReviewExtractionMock.mock.calls[1]?.[0]?.surface).toBe(
      '/api/batch/retry'
    );
    expect(runTracedReviewExtractionMock.mock.calls[1]?.[0]?.fixtureId).toBe(
      'image-trace-001'
    );
  });
});
