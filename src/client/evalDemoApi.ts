import { z } from 'zod';

import {
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  type BatchStreamFrame,
  verificationReportSchema,
  type VerificationReport
} from '../shared/contracts/review';
import { withProviderOverrideHeader } from './providerOverride';

export const evalPackImageSchema = z.object({
  id: z.string(),
  source: z.string(),
  assetPath: z.string(),
  filename: z.string(),
  beverageType: z.string(),
  expectedRecommendation: z.string().optional()
});

export const evalPackSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  csvFile: z.string(),
  imageCount: z.number().int().nonnegative(),
  images: z.array(evalPackImageSchema)
});

export const evalPacksResponseSchema = z.object({
  packs: z.array(evalPackSchema)
});

export type EvalPackImage = z.infer<typeof evalPackImageSchema>;
export type EvalPack = z.infer<typeof evalPackSchema>;

export async function fetchEvalPacks(signal?: AbortSignal): Promise<EvalPack[]> {
  const response = await fetch('/api/eval/packs', { signal });
  if (!response.ok) {
    throw new Error(`Failed to load eval packs (${response.status}).`);
  }
  return evalPacksResponseSchema.parse(await response.json()).packs;
}

async function fetchPackCsvBlob(packId: string): Promise<Blob> {
  const response = await fetch(`/api/eval/pack/${packId}/csv`);
  if (!response.ok) {
    throw new Error(`Failed to load eval CSV for "${packId}".`);
  }
  return await response.blob();
}

async function fetchImageFile(image: EvalPackImage): Promise<File> {
  const response = await fetch(
    `/api/eval/label-image/${image.source}/${encodeURIComponent(image.filename)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load image "${image.filename}".`);
  }
  const blob = await response.blob();
  return new File([blob], image.filename, {
    type: blob.type || 'image/webp'
  });
}

export function imageUrlFor(image: EvalPackImage): string {
  return `/api/eval/label-image/${image.source}/${encodeURIComponent(
    image.filename
  )}`;
}

export type PreparedEvalRun = {
  batchSessionId: string;
  preflight: z.infer<typeof batchPreflightResponseSchema>;
  // Client-side mapping from the imageId the server assigned to the source
  // pack image so the UI can show thumbnails as item frames arrive.
  imageIdToPackImage: Map<string, EvalPackImage>;
};

export async function prepareEvalRun(options: {
  pack: EvalPack;
  onProgress?: (done: number, total: number) => void;
}): Promise<PreparedEvalRun> {
  const { pack, onProgress } = options;
  const totalSteps = pack.images.length + 1;
  let completed = 0;
  const notify = () => {
    completed += 1;
    onProgress?.(completed, totalSteps);
  };

  // Fetch CSV + each image in parallel.
  const [csvBlob, ...imageFiles] = await Promise.all([
    fetchPackCsvBlob(pack.id).finally(notify),
    ...pack.images.map((image) =>
      fetchImageFile(image).finally(notify)
    )
  ]);

  const batchClientId = crypto.randomUUID();
  const imageMeta = pack.images.map((image, index) => {
    const file = imageFiles[index];
    const clientId = `${pack.id}-${image.id}-${index}`;
    return { image, file, clientId };
  });

  const formData = new FormData();
  formData.append(
    'manifest',
    JSON.stringify({
      batchClientId,
      images: imageMeta.map(({ image, file, clientId }) => ({
        clientId,
        filename: image.filename,
        sizeBytes: file.size,
        mimeType: file.type || 'image/webp'
      })),
      csv: {
        filename: pack.csvFile,
        sizeBytes: csvBlob.size
      }
    })
  );
  for (const { image, file } of imageMeta) {
    formData.append('labels', file, image.filename);
  }
  formData.append('csv', csvBlob, pack.csvFile);

  const preflightResponse = await fetch('/api/batch/preflight', {
    method: 'POST',
    headers: withProviderOverrideHeader(),
    body: formData
  });

  if (!preflightResponse.ok) {
    const text = await preflightResponse.text();
    throw new Error(
      `Preflight failed (${preflightResponse.status}): ${text || 'unknown error'}`
    );
  }

  const preflight = batchPreflightResponseSchema.parse(
    await preflightResponse.json()
  );

  const imageIdToPackImage = new Map<string, EvalPackImage>();
  for (const { image, clientId } of imageMeta) {
    imageIdToPackImage.set(clientId, image);
  }

  return {
    batchSessionId: preflight.batchSessionId,
    preflight,
    imageIdToPackImage
  };
}

export async function streamEvalRun(options: {
  batchSessionId: string;
  preflight: z.infer<typeof batchPreflightResponseSchema>;
  signal?: AbortSignal;
  onFrame: (frame: BatchStreamFrame) => void;
}) {
  const resolutions = [
    ...options.preflight.matching.matched.map((pair) => ({
      imageId: pair.imageId,
      action: { kind: 'matched' as const, rowId: pair.row.id }
    })),
    ...options.preflight.matching.ambiguous.map((entry) => ({
      imageId: entry.imageId,
      action: { kind: 'matched' as const, rowId: entry.candidates[0]!.id }
    })),
    ...options.preflight.matching.unmatchedImageIds.map((imageId) => ({
      imageId,
      action: { kind: 'dropped' as const }
    }))
  ];

  const response = await fetch('/api/batch/run', {
    method: 'POST',
    headers: withProviderOverrideHeader({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      batchSessionId: options.batchSessionId,
      resolutions
    }),
    signal: options.signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Batch run failed (${response.status}): ${text}`);
  }

  if (!response.body) {
    throw new Error('Batch run returned no body.');
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
      if (line.trim().length === 0) continue;
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

export async function fetchEvalExport(
  batchSessionId: string
): Promise<unknown> {
  const response = await fetch(`/api/batch/${batchSessionId}/export`);
  if (!response.ok) {
    throw new Error(`Export failed (${response.status}).`);
  }
  return await response.json();
}

export async function fetchReport(
  batchSessionId: string,
  reportId: string
): Promise<VerificationReport> {
  const response = await fetch(
    `/api/batch/${batchSessionId}/report/${reportId}`
  );
  if (!response.ok) {
    throw new Error(`Report fetch failed (${response.status}).`);
  }
  return verificationReportSchema.parse(await response.json());
}
