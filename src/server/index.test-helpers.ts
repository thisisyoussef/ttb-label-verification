import { rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';

import {
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  reviewExtractionSchema,
  type ReviewExtraction,
  type ReviewExtractionFields,
  type ReviewExtractionImageQuality,
  type WarningVisualSignals
} from '../shared/contracts/review';
import { createApp } from './index';

const serversToClose: Array<{
  close: (callback: (error?: Error | undefined) => void) => void;
}> = [];
const tempDirsToRemove: string[] = [];

export async function startServer(options: Parameters<typeof createApp>[0] = {}) {
  const app = createApp(options);

  return await new Promise<{
    close: (callback: (error?: Error | undefined) => void) => void;
    address: () => AddressInfo | string | null;
  }>((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

export function registerServer(server: {
  close: (callback: (error?: Error | undefined) => void) => void;
}) {
  serversToClose.push(server);
}

export function registerTempDir(dirPath: string) {
  tempDirsToRemove.push(dirPath);
}

export async function cleanupTestResources() {
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

  tempDirsToRemove.splice(0).forEach((dirPath) => {
    rmSync(dirPath, { recursive: true, force: true });
  });
}

export function serverUrl(
  server: { address: () => AddressInfo | string | null },
  pathname: string
) {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Server address not available.');
  }

  return `http://127.0.0.1:${address.port}${pathname}`;
}

export function validReviewFields() {
  return {
    beverageType: 'auto',
    brandName: '',
    fancifulName: '',
    classType: '',
    alcoholContent: '',
    netContents: '',
    applicantAddress: '',
    origin: 'domestic',
    country: '',
    formulaId: '',
    appellation: '',
    vintage: '',
    varietals: []
  };
}

export function buildLabelFile({
  name = 'label.png',
  type = 'image/png',
  size = 8,
  data
}: {
  name?: string;
  type?: string;
  size?: number;
  data?: Uint8Array;
} = {}) {
  return new File([data ? Buffer.from(data) : Buffer.alloc(size)], name, {
    type
  });
}

export function presentField(value: string, confidence = 0.96) {
  return {
    present: true,
    value,
    confidence
  } as const;
}

export function absentField(confidence = 0.08) {
  return {
    present: false,
    confidence
  } as const;
}

export function buildExtractionPayload(
  overrides: {
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

export async function postReview(
  server: { address: () => AddressInfo | string | null },
  {
    file = buildLabelFile(),
    files,
    fields = JSON.stringify(validReviewFields()),
    clientTraceId
  }: {
    file?: File | null;
    files?: File[] | null;
    fields?: string | null;
    clientTraceId?: string;
  } = {}
) {
  const form = new FormData();

  const reviewFiles = files ?? (file ? [file] : []);

  reviewFiles.forEach((reviewFile) => {
    form.append('label', reviewFile);
  });

  if (fields !== null) {
    form.append('fields', fields);
  }

  return await fetch(serverUrl(server, '/api/review'), {
    method: 'POST',
    headers: clientTraceId ? { 'x-review-client-id': clientTraceId } : undefined,
    body: form
  });
}

export async function postReviewExtraction(
  server: { address: () => AddressInfo | string | null },
  {
    file = buildLabelFile(),
    files,
    fields = JSON.stringify(validReviewFields()),
    clientTraceId
  }: {
    file?: File | null;
    files?: File[] | null;
    fields?: string | null;
    clientTraceId?: string;
  } = {}
) {
  const form = new FormData();

  const reviewFiles = files ?? (file ? [file] : []);

  reviewFiles.forEach((reviewFile) => {
    form.append('label', reviewFile);
  });

  if (fields !== null) {
    form.append('fields', fields);
  }

  return await fetch(serverUrl(server, '/api/review/extraction'), {
    method: 'POST',
    headers: clientTraceId ? { 'x-review-client-id': clientTraceId } : undefined,
    body: form
  });
}

export async function postReviewWarning(
  server: { address: () => AddressInfo | string | null },
  {
    file = buildLabelFile(),
    files,
    fields = JSON.stringify(validReviewFields()),
    clientTraceId
  }: {
    file?: File | null;
    files?: File[] | null;
    fields?: string | null;
    clientTraceId?: string;
  } = {}
) {
  const form = new FormData();

  const reviewFiles = files ?? (file ? [file] : []);

  reviewFiles.forEach((reviewFile) => {
    form.append('label', reviewFile);
  });

  if (fields !== null) {
    form.append('fields', fields);
  }

  return await fetch(serverUrl(server, '/api/review/warning'), {
    method: 'POST',
    headers: clientTraceId ? { 'x-review-client-id': clientTraceId } : undefined,
    body: form
  });
}

export async function postBatchPreflight(
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

export async function postBatchRun(
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

export async function postBatchRetry(
  server: { address: () => AddressInfo | string | null },
  batchSessionId: string,
  imageId: string
) {
  return await fetch(serverUrl(server, `/api/batch/${batchSessionId}/retry/${imageId}`), {
    method: 'POST'
  });
}

export async function collectNdjsonFrames(response: Response) {
  const text = await response.text();

  return text
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => batchStreamFrameSchema.parse(JSON.parse(line)));
}

export async function parseBatchPreflight(response: Response) {
  return batchPreflightResponseSchema.parse(await response.json());
}
