/**
 * Head-to-head compare per-label eval outputs for PDF vs image ingestion.
 *
 * Reads the two JSON files produced by run-cola-cloud-batch-fixtures.ts,
 * focuses on the `cola-cloud-all` pack, and prints:
 *  - a status-change matrix per label
 *  - latency stats for both runs
 *  - flagged cases where the verdict differed or either run errored
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type PackResult = {
  id: string;
  run: {
    summary: Record<string, number>;
    latency: {
      avgPerItemMs: number;
      p50PerItemMs: number;
      p95PerItemMs: number;
      maxPerItemMs: number;
    };
    rowStatuses: Array<{
      imageId: string;
      filename: string;
      status: string;
      expectedRecommendation: string | null;
      brandName: string;
      classType: string;
      extractionQualityState: string | null;
      verdictSecondary: string | null;
      latencyMs: number | null;
      errorMessage: string | null;
      issues: { blocker: number; major: number; minor: number; note: number };
      fieldChecks: Record<string, { status: string } | null>;
      ruleChecks: Record<string, { status: string } | null>;
    }>;
  };
};

type RunFile = {
  generatedAt: string;
  manifest: string;
  results: PackResult[];
};

async function loadPack(filePath: string, packId: string): Promise<PackResult | null> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as RunFile;
  return raw.results.find((p) => p.id === packId) ?? null;
}

function fmtLatency(pack: PackResult) {
  const l = pack.run.latency;
  return `avg=${l.avgPerItemMs}ms p50=${l.p50PerItemMs}ms p95=${l.p95PerItemMs}ms max=${l.maxPerItemMs}ms`;
}

async function main() {
  const [, , imagePath, pdfPath, maybePack] = process.argv;
  if (!imagePath || !pdfPath) {
    console.error('usage: compare-pdf-vs-image-results.ts <image-result.json> <pdf-result.json> [packId]');
    process.exit(1);
  }
  const packId = maybePack ?? 'cola-cloud-all';

  const image = await loadPack(path.resolve(imagePath), packId);
  const pdf = await loadPack(path.resolve(pdfPath), packId);
  if (!image || !pdf) {
    console.error('could not find pack in one of the result files');
    process.exit(1);
  }

  console.log(`Pack: ${packId}`);
  console.log('');
  console.log(`images: summary=${JSON.stringify(image.run.summary)}  ${fmtLatency(image)}`);
  console.log(`pdfs:   summary=${JSON.stringify(pdf.run.summary)}  ${fmtLatency(pdf)}`);
  console.log('');

  const imageById = new Map(image.run.rowStatuses.map((r) => [r.imageId, r]));
  const pdfById = new Map(pdf.run.rowStatuses.map((r) => [r.imageId, r]));

  const allIds = Array.from(new Set([...imageById.keys(), ...pdfById.keys()])).sort();

  const transitions: Record<string, number> = {};
  const differences: string[] = [];
  const bothErrored: string[] = [];
  const onlyImageErrored: string[] = [];
  const onlyPdfErrored: string[] = [];
  let matchedBehavior = 0;

  for (const id of allIds) {
    const i = imageById.get(id);
    const p = pdfById.get(id);
    const iStatus = i?.status ?? 'missing';
    const pStatus = p?.status ?? 'missing';
    const key = `${iStatus} → ${pStatus}`;
    transitions[key] = (transitions[key] ?? 0) + 1;

    if (iStatus === 'error' && pStatus === 'error') bothErrored.push(id);
    else if (iStatus === 'error') onlyImageErrored.push(id);
    else if (pStatus === 'error') onlyPdfErrored.push(id);

    if (iStatus === pStatus) {
      matchedBehavior++;
    } else {
      const iExpected = i?.expectedRecommendation ?? '—';
      const iLatency = i?.latencyMs ?? '—';
      const pLatency = p?.latencyMs ?? '—';
      differences.push(
        `  ${id.padEnd(55)} image=${iStatus.padEnd(6)} pdf=${pStatus.padEnd(6)} expected=${iExpected.padEnd(8)} lat(img)=${iLatency} lat(pdf)=${pLatency}`
      );
    }
  }

  console.log(`Verdict parity: ${matchedBehavior}/${allIds.length} items had the same status`);
  console.log('');
  console.log('Status transitions (image → pdf):');
  for (const [k, v] of Object.entries(transitions).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${k.padEnd(30)} ${v}`);
  }

  if (differences.length > 0) {
    console.log('');
    console.log('Cases where verdict changed:');
    for (const line of differences) console.log(line);
  }

  if (onlyImageErrored.length > 0) {
    console.log('');
    console.log('Errored on image, NOT on pdf:');
    for (const id of onlyImageErrored) {
      const i = imageById.get(id);
      console.log(`  ${id}  ${i?.errorMessage ?? ''}`);
    }
  }
  if (onlyPdfErrored.length > 0) {
    console.log('');
    console.log('Errored on pdf, NOT on image:');
    for (const id of onlyPdfErrored) {
      const p = pdfById.get(id);
      console.log(`  ${id}  ${p?.errorMessage ?? ''}`);
    }
  }
  if (bothErrored.length > 0) {
    console.log('');
    console.log('Errored on both runs:');
    for (const id of bothErrored) console.log(`  ${id}`);
  }

  // Latency comparison for items that succeeded on both sides.
  const pairedLatency: Array<{ id: string; img: number; pdf: number; delta: number }> = [];
  for (const id of allIds) {
    const i = imageById.get(id);
    const p = pdfById.get(id);
    if (i?.latencyMs != null && p?.latencyMs != null && i.latencyMs > 0 && p.latencyMs > 0) {
      pairedLatency.push({ id, img: i.latencyMs, pdf: p.latencyMs, delta: p.latencyMs - i.latencyMs });
    }
  }
  if (pairedLatency.length > 0) {
    const deltas = pairedLatency.map((e) => e.delta).sort((a, b) => a - b);
    const avgDelta = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
    console.log('');
    console.log(`Paired latency delta (pdf - image) across ${pairedLatency.length} items:`);
    console.log(
      `  avg=${avgDelta}ms min=${deltas[0]}ms p50=${deltas[Math.floor(deltas.length / 2)]}ms p95=${deltas[Math.floor(deltas.length * 0.95)]}ms max=${deltas[deltas.length - 1]}ms`
    );
  }

  // Expected-recommendation hit rate for each ingestion path.
  const hits = (rows: typeof image.run.rowStatuses) =>
    rows.filter((r) => r.expectedRecommendation && r.status === 'pass' && r.expectedRecommendation === 'approve').length;
  console.log('');
  const approveExpected = image.run.rowStatuses.filter((r) => r.expectedRecommendation === 'approve').length;
  console.log(
    `Approve-hit rate: image=${hits(image.run.rowStatuses)}/${approveExpected} pdf=${hits(pdf.run.rowStatuses)}/${approveExpected}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
