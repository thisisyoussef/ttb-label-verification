/**
 * Batch pipelining throughput bench.
 *
 * Posts the 28-label cola-cloud-all batch to a running API, streams the
 * NDJSON response, and reports total wall time. Run with different
 * BATCH_CONCURRENCY values on the server side to A/B sequential vs
 * pipelined throughput.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:8787 \
 *     npx tsx scripts/batch-pipelining-bench.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

type ColaCloudManifest = {
  sets: Array<{
    id: string;
    csvFile: string;
    imageCases: Array<{
      id: string;
      assetPath: string;
    }>;
  }>;
};

function mimeTypeFor(p: string) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

async function main() {
  const root = process.cwd();
  const manifestPath = path.join(root, 'evals/batch/cola-cloud/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ColaCloudManifest;
  const set = manifest.sets.find((s) => s.id === 'cola-cloud-all');
  if (!set) throw new Error('cola-cloud-all set not found');

  const csvPath = path.join(path.dirname(manifestPath), set.csvFile);
  const csvBuffer = await readFile(csvPath);

  const form = new FormData();
  const images: Array<{ id: string; filename: string }> = [];
  for (const imageCase of set.imageCases) {
    const abs = path.join(root, imageCase.assetPath);
    const buffer = await readFile(abs);
    const filename = path.basename(abs);
    images.push({ id: imageCase.id, filename });
    form.append('labels', new Blob([buffer], { type: mimeTypeFor(abs) }), filename);
  }
  form.append(
    'manifest',
    JSON.stringify({
      batchClientId: `bench-${Date.now()}`,
      images: images.map((img) => ({
        clientId: img.id,
        filename: img.filename,
        sizeBytes: 0,
        mimeType: mimeTypeFor(img.filename)
      })),
      csv: {
        filename: path.basename(csvPath),
        sizeBytes: csvBuffer.byteLength
      }
    })
  );
  form.append('csv', new Blob([csvBuffer], { type: 'text/csv' }), path.basename(csvPath));

  console.log(`Preflighting ${images.length} labels at ${BASE_URL}...`);
  const preflightRes = await fetch(`${BASE_URL}/api/batch/preflight`, {
    method: 'POST',
    body: form
  });
  if (!preflightRes.ok) {
    throw new Error(`preflight HTTP ${preflightRes.status}: ${await preflightRes.text()}`);
  }
  const preflight = await preflightRes.json();

  const rowByFilename = new Map<string, string>(
    preflight.csvRows.map((row: { filenameHint: string; id: string }) => [row.filenameHint, row.id])
  );
  const resolutions = [
    ...preflight.matching.ambiguous.map((entry: { imageId: string; candidateRowIds: string[] }) => ({
      imageId: entry.imageId,
      action: { kind: 'matched' as const, rowId: entry.candidateRowIds[0]! }
    })),
    ...preflight.matching.unmatchedImageIds.map((imageId: string) => ({
      imageId,
      action: { kind: 'dropped' as const }
    })),
    ...preflight.matching.unmatchedRowIds.map((rowId: string) => ({
      rowId,
      action: { kind: 'dropped' as const }
    }))
  ];

  void rowByFilename;

  console.log(`Preflight: ${preflight.matching.matched.length} matched, sessionId=${preflight.batchSessionId}`);
  console.log(`Starting run with ${resolutions.length} resolutions...`);
  console.log('');

  const started = performance.now();
  let firstFrameMs: number | null = null;
  let firstItemMs: number | null = null;
  let itemCount = 0;
  let itemWallMsByCompletionOrder: Array<{ at: number; id: string }> = [];

  const runRes = await fetch(`${BASE_URL}/api/batch/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ batchSessionId: preflight.batchSessionId, resolutions })
  });
  if (!runRes.ok || !runRes.body) {
    throw new Error(`run HTTP ${runRes.status}: ${await runRes.text()}`);
  }

  const reader = runRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const at = Math.round(performance.now() - started);
      if (firstFrameMs === null) firstFrameMs = at;
      try {
        const frame = JSON.parse(line);
        if (frame.type === 'item') {
          itemCount += 1;
          if (firstItemMs === null) firstItemMs = at;
          itemWallMsByCompletionOrder.push({ at, id: frame.imageId });
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  const total = Math.round(performance.now() - started);
  console.log(`Total wall:       ${total}ms`);
  console.log(`First frame:      ${firstFrameMs}ms`);
  console.log(`First item done:  ${firstItemMs}ms`);
  console.log(`Last item done:   ${itemWallMsByCompletionOrder.at(-1)?.at ?? 'n/a'}ms`);
  console.log(`Items:            ${itemCount}`);
  console.log(`Per-label avg:    ${itemCount > 0 ? Math.round(total / itemCount) : 'n/a'}ms`);
}

main().catch((err) => {
  console.error('[bench error]', err);
  process.exit(1);
});
