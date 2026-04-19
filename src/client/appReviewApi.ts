import {
  batchDashboardResponseSchema,
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  reviewErrorSchema,
  reviewRelevanceResultSchema,
  reviewStreamFrameSchema,
  verificationReportSchema,
  type ReviewIntakeFields,
  type ReviewStreamFrame
} from '../shared/contracts/review';
import { buildBatchResolutions } from './batch-runtime';
import type { BatchLabelImage, BatchMatchingState } from './batchTypes';
import { withProviderOverrideHeader } from './providerOverride';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage
} from './types';
import { DEFAULT_FAILURE_MESSAGE } from './reviewFailureMessage';

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

function appendReviewImages(
  formData: FormData,
  image: LabelImage,
  secondaryImage?: LabelImage | null
) {
  formData.append('label', image.file);
  if (secondaryImage) {
    formData.append('label', secondaryImage.file);
  }
}

export async function submitReview(options: {
  image: LabelImage;
  secondaryImage?: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  signal: AbortSignal;
  clientRequestId?: string;
  /**
   * Cache key returned by a prior /api/review/extract-only call. When
   * provided, the server skips re-extraction and runs only judgment +
   * report against the cached extraction. Sub-second vs 5-7s on a
   * cold Verify.
   */
  extractionCacheKey?: string;
}) {
  const formData = new FormData();
  appendReviewImages(formData, options.image, options.secondaryImage);
  formData.append(
    'fields',
    JSON.stringify(buildReviewFields(options.beverage, options.fields))
  );

  const headers: Record<string, string> = {};
  if (options.clientRequestId) headers['x-review-client-id'] = options.clientRequestId;
  if (options.extractionCacheKey) headers['x-extraction-cache-key'] = options.extractionCacheKey;

  const response = await fetch('/api/review', {
    method: 'POST',
    headers: withProviderOverrideHeader(headers),
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

/**
 * Fire the image-first prefetch. Server runs the full VLM extraction +
 * warning OCV on the uploaded image and stashes it in an in-memory
 * cache keyed by image-bytes hash. Returns the cache key + a
 * lightweight OCR preview. Client stores the key and passes it on the
 * eventual /api/review Verify call so extraction is skipped there.
 *
 * Silent failure — callers should ignore rejection; the canonical
 * /api/review path still runs cold extraction when the prefetch is
 * missing.
 */
export async function prefetchExtraction(options: {
  image: LabelImage;
  secondaryImage?: LabelImage | null;
  beverage: BeverageSelection;
  signal: AbortSignal;
  clientRequestId?: string;
}): Promise<{ cacheKey: string; ocrText: string } | null> {
  const formData = new FormData();
  appendReviewImages(formData, options.image, options.secondaryImage);
  formData.append(
    'fields',
    JSON.stringify(
      buildReviewFields(options.beverage, {
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
      })
    )
  );

  const response = await fetch('/api/review/extract-only', {
    method: 'POST',
    headers: withProviderOverrideHeader(
      options.clientRequestId
        ? { 'x-review-client-id': options.clientRequestId }
        : undefined
    ),
    body: formData,
    signal: options.signal
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { cacheKey?: string; ocrText?: string };
  if (!payload.cacheKey) return null;
  return { cacheKey: payload.cacheKey, ocrText: payload.ocrText ?? '' };
}

export async function checkReviewRelevance(options: {
  image: LabelImage;
  secondaryImage?: LabelImage | null;
  beverage: BeverageSelection;
  signal: AbortSignal;
  clientRequestId?: string;
}) {
  const formData = new FormData();
  appendReviewImages(formData, options.image, options.secondaryImage);
  formData.append(
    'fields',
    JSON.stringify(
      buildReviewFields(options.beverage, {
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
      })
    )
  );

  const response = await fetch('/api/review/relevance', {
    method: 'POST',
    headers: withProviderOverrideHeader(
      options.clientRequestId
        ? { 'x-review-client-id': options.clientRequestId }
        : undefined
    ),
    body: formData,
    signal: options.signal
  });

  if (!response.ok) return null;

  try {
    return reviewRelevanceResultSchema.parse(await response.json());
  } catch {
    return null;
  }
}

/**
 * Stream a review via Server-Sent Events from `/api/review/stream`.
 * Calls `onFrame` as each SSE frame arrives. Resolves when the server
 * emits a `done` frame or the response body ends. Rejects if the
 * response is not ok or the body is unavailable.
 *
 * The server emits SSE format (`data: {json}\n\n` per frame plus
 * periodic `: heartbeat` keep-alives). This parser handles both.
 */
export async function streamReview(options: {
  image: LabelImage;
  secondaryImage?: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  signal: AbortSignal;
  clientRequestId?: string;
  /**
   * When true, asks the server to stop after the ocr-done frame. Used
   * for the low-cost OCR-only preview path that Processing screen
   * fires alongside the canonical /api/review call. No VLM cost.
   */
  onlyOcr?: boolean;
  onFrame: (frame: ReviewStreamFrame) => void;
}): Promise<void> {
  const formData = new FormData();
  appendReviewImages(formData, options.image, options.secondaryImage);
  formData.append(
    'fields',
    JSON.stringify(buildReviewFields(options.beverage, options.fields))
  );

  const url = options.onlyOcr
    ? '/api/review/stream?only=ocr'
    : '/api/review/stream';
  const response = await fetch(url, {
    method: 'POST',
    headers: withProviderOverrideHeader(
      options.clientRequestId
        ? { 'x-review-client-id': options.clientRequestId }
        : undefined
    ),
    body: formData,
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, DEFAULT_FAILURE_MESSAGE)
    );
  }
  if (!response.body) {
    throw new Error(DEFAULT_FAILURE_MESSAGE);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // SSE frames are separated by `\n\n`. Each frame may span multiple
  // `data:` lines (we always emit one line, but parse defensively).
  const flushFrame = (raw: string) => {
    const dataLines = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) return;
    const payload = dataLines.join('\n');
    try {
      const parsed = reviewStreamFrameSchema.parse(JSON.parse(payload));
      options.onFrame(parsed);
    } catch {
      // Skip malformed frames — the server schema-validates before
      // writing, so this should only happen on partial / corrupt
      // buffer edges. The next frame will still parse.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let separatorIdx = buffer.indexOf('\n\n');
    while (separatorIdx !== -1) {
      const rawFrame = buffer.slice(0, separatorIdx);
      buffer = buffer.slice(separatorIdx + 2);
      if (rawFrame.trim().length > 0) flushFrame(rawFrame);
      separatorIdx = buffer.indexOf('\n\n');
    }

    if (done) {
      if (buffer.trim().length > 0) flushFrame(buffer);
      break;
    }
  }
}

/**
 * Option C row-level refine. After the initial live report lands, if
 * any identifier row is in 'review' status, we can ask the server to
 * re-run the pipeline with VERIFICATION_MODE forced on — the VLM then
 * sees the applicant's brand/class/country values and verifies
 * visibility on the label instead of bottom-up guessing. Returns the
 * full refined report so the client can merge specific rows.
 *
 * Silent failure — refine is always a "nice to have" second pass; the
 * original report stays displayed if the refine request errors.
 */
export async function refineReview(options: {
  image: LabelImage;
  secondaryImage?: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  signal: AbortSignal;
  clientRequestId?: string;
}) {
  const formData = new FormData();
  appendReviewImages(formData, options.image, options.secondaryImage);
  formData.append(
    'fields',
    JSON.stringify(buildReviewFields(options.beverage, options.fields))
  );

  const response = await fetch('/api/review/refine', {
    method: 'POST',
    headers: withProviderOverrideHeader(
      options.clientRequestId
        ? { 'x-review-client-id': options.clientRequestId }
        : undefined
    ),
    body: formData,
    signal: options.signal
  });

  if (!response.ok) return { ok: false as const };
  try {
    const report = verificationReportSchema.parse(await response.json());
    return { ok: true as const, report };
  } catch {
    return { ok: false as const };
  }
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
    headers: withProviderOverrideHeader(),
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
    headers: withProviderOverrideHeader({
      'content-type': 'application/json'
    }),
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
    throw new Error('We could not start the batch review. Try again.');
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
