import {
  batchDashboardResponseSchema,
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  reviewErrorSchema,
  verificationReportSchema,
  type ReviewIntakeFields
} from '../shared/contracts/review';
import { buildBatchResolutions } from './batch-runtime';
import type { BatchLabelImage, BatchMatchingState } from './batchTypes';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage
} from './types';

export const DEFAULT_FAILURE_MESSAGE =
  'The connection dropped while reading the label. Your label and inputs are still here — nothing was saved.';

function normalizeReviewBeverage(
  beverage: BeverageSelection
): ReviewIntakeFields['beverageType'] {
  return beverage === 'unknown' ? 'auto' : beverage;
}

function buildReviewFields(
  beverage: BeverageSelection,
  fields: IntakeFields
): ReviewIntakeFields {
  return {
    beverageType: normalizeReviewBeverage(beverage),
    brandName: fields.brandName,
    fancifulName: fields.fancifulName,
    classType: fields.classType,
    alcoholContent: fields.alcoholContent,
    netContents: fields.netContents,
    applicantAddress: fields.applicantAddress,
    origin: fields.origin,
    country: fields.country,
    formulaId: fields.formulaId,
    appellation: fields.appellation,
    vintage: fields.vintage,
    varietals: fields.varietals.map((row) => ({
      name: row.name,
      percentage: row.percentage
    }))
  };
}

export async function submitReview(options: {
  image: LabelImage;
  beverage: BeverageSelection;
  fields: IntakeFields;
  signal: AbortSignal;
  clientRequestId?: string;
}) {
  const formData = new FormData();
  formData.append('label', options.image.file);
  formData.append(
    'fields',
    JSON.stringify(buildReviewFields(options.beverage, options.fields))
  );

  const response = await fetch('/api/review', {
    method: 'POST',
    headers: options.clientRequestId
      ? {
          'x-review-client-id': options.clientRequestId
        }
      : undefined,
    body: formData,
    signal: options.signal
  });

  if (!response.ok) {
    try {
      const payload = reviewErrorSchema.parse(await response.json());
      return { ok: false as const, message: payload.message };
    } catch {
      return { ok: false as const, message: DEFAULT_FAILURE_MESSAGE };
    }
  }

  const report = verificationReportSchema.parse(await response.json());
  return { ok: true as const, report };
}

export async function parseApiError(response: Response, fallback: string) {
  try {
    const payload = reviewErrorSchema.parse(await response.json());
    return payload.message;
  } catch {
    return fallback;
  }
}

export async function submitBatchPreflight(options: {
  images: BatchLabelImage[];
  csvFile: File;
  signal?: AbortSignal;
}) {
  const formData = new FormData();
  formData.append(
    'manifest',
    JSON.stringify({
      batchClientId: crypto.randomUUID(),
      images: options.images
        .filter((image): image is BatchLabelImage & { file: File } => image.file instanceof File)
        .map((image) => ({
          clientId: image.id,
          filename: image.file.name,
          sizeBytes: image.file.size,
          mimeType: image.file.type
        })),
      csv: {
        filename: options.csvFile.name,
        sizeBytes: options.csvFile.size
      }
    })
  );

  options.images.forEach((image) => {
    if (image.file instanceof File) {
      formData.append('labels', image.file);
    }
  });
  formData.append('csv', options.csvFile);

  const response = await fetch('/api/batch/preflight', {
    method: 'POST',
    body: formData,
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'We could not prepare this batch right now. Try again.')
    );
  }

  return batchPreflightResponseSchema.parse(await response.json());
}

export async function streamBatchRun(options: {
  batchSessionId: string;
  matching: BatchMatchingState;
  signal?: AbortSignal;
  onFrame: (frame: ReturnType<typeof batchStreamFrameSchema.parse>) => void;
}) {
  const response = await fetch('/api/batch/run', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      batchSessionId: options.batchSessionId,
      resolutions: buildBatchResolutions(options.matching)
    }),
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'We could not start this batch right now. Try again.')
    );
  }

  if (!response.body) {
    throw new Error('We could not read the batch stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      options.onFrame(batchStreamFrameSchema.parse(JSON.parse(line)));
    }

    if (done) {
      if (buffer.trim().length > 0) {
        options.onFrame(batchStreamFrameSchema.parse(JSON.parse(buffer)));
      }
      break;
    }
  }
}

export async function fetchBatchDashboard(batchSessionId: string) {
  const response = await fetch(`/api/batch/${batchSessionId}/summary`);

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'We could not load this batch right now.')
    );
  }

  return batchDashboardResponseSchema.parse(await response.json());
}

export async function fetchBatchReport(batchSessionId: string, reportId: string) {
  const response = await fetch(`/api/batch/${batchSessionId}/report/${reportId}`);

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, "We couldn't load this label's details.")
    );
  }

  return verificationReportSchema.parse(await response.json());
}
