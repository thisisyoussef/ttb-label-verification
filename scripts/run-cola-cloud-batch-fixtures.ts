import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  batchDashboardResponseSchema,
  batchExportPayloadSchema,
  batchPreflightResponseSchema,
  batchStreamFrameSchema
} from '../src/shared/contracts/review';
import type {
  ExtractionQualityState,
  VerificationReport
} from '../src/shared/contracts/review';
import {
  emptyFieldMetric,
  emptyRuleMetric,
  incrementFieldMetric,
  incrementRuleMetric
} from './eval-batch-metrics';
import {
  defaultNetContents,
  formatAlcoholContent
} from './eval-corpus-types';
import type {
  ColaCloudManifest,
  SupplementalNegativeManifest
} from './eval-corpus-types';
import type { FieldMetric, RuleMetric } from './eval-batch-metrics';

type BatchFixtureManifest = {
  version: number;
  sourceManifests: string[];
  description: string;
  sets: Array<{
    id: string;
    title: string;
    description: string;
    csvFile: string;
    imageCases: Array<{
      id: string;
      assetPath: string;
      beverageType: string;
      expectedRecommendation: string;
      source: string;
    }>;
  }>;
};
type ExpectedCase = {
  id: string;
  filename: string;
  title: string;
  beverageType: string;
  expectedRecommendation: string;
  source: string;
  expectedFields: {
    brandName: string;
    fancifulName: string;
    classType: string;
    alcoholContent: string;
    netContents: string;
    appellation: string;
    vintage: string;
  };
};
const FIELD_CHECK_IDS = [
  'brand-name',
  'class-type',
  'alcohol-content',
  'net-contents',
  // TTB requires bottler/producer name & address (27 CFR 5.66/4.35/7.25)
  // and country of origin for imports — added as field checks so the
  // eval runner captures them in rowStatuses for analysis.
  'applicant-address',
  'country-of-origin'
] as const;
const RULE_CHECK_IDS = [
  'government-warning',
  'abv-format-permitted',
  'vintage-requires-appellation',
  'same-field-of-vision'
] as const;
function makeFile(buffer: Buffer, filename: string, type: string) {
  return new File([new Uint8Array(buffer)], filename, { type });
}
function mimeTypeFor(filePath: string) {
  if (filePath.endsWith('.webp')) {
    return 'image/webp';
  }
  if (filePath.endsWith('.png')) {
    return 'image/png';
  }
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (filePath.endsWith('.pdf')) {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}
function findCheck(report: VerificationReport, id: string) {
  return [...report.checks, ...report.crossFieldChecks].find((check) => check.id === id) ?? null;
}
async function _collectNdjsonFrames(response: Response) {
  const body = await response.text();
  return body
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => batchStreamFrameSchema.parse(JSON.parse(line)));
}

/**
 * Stream NDJSON frames and record per-item arrival timestamps.
 * Returns both the parsed frames and a map of itemId/imageId -> latencyMs
 * measured from request start to the frame's arrival.
 */
async function collectNdjsonFramesWithLatency(response: Response, startTime: number) {
  const frames: Array<import('../src/shared/contracts/review').BatchStreamFrame> = [];
  const itemLatencyMs = new Map<string, number>();

  if (!response.body) {
    const body = await response.text();
    body
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .forEach((line) => {
        const frame = batchStreamFrameSchema.parse(JSON.parse(line));
        frames.push(frame);
      });
    return { frames, itemLatencyMs };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastFrameTime = startTime;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length === 0) continue;

      const frameReceivedAt = performance.now();
      const frame = batchStreamFrameSchema.parse(JSON.parse(line));
      frames.push(frame);

      if (frame.type === 'item') {
        // Latency for this item = time from last item (or start) to now
        const latencyMs = Math.round(frameReceivedAt - lastFrameTime);
        itemLatencyMs.set(frame.imageId, latencyMs);
        lastFrameTime = frameReceivedAt;
      }
    }
  }

  // Handle any trailing content
  if (buffer.trim().length > 0) {
    const frame = batchStreamFrameSchema.parse(JSON.parse(buffer.trim()));
    frames.push(frame);
  }

  return { frames, itemLatencyMs };
}
async function main() {
  const repoRoot = process.cwd();
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_STORE = 'false';
  const { loadLocalEnv } = await import('../src/server/load-local-env');
  loadLocalEnv(repoRoot);
  const { createApp } = await import('../src/server/index');

  // Allow the batch manifest to be overridden with --manifest <path> so we
  // can re-use this runner for the PDF fixture pack (or any future variant)
  // without cloning the whole script.
  const cliArgs = process.argv.slice(2);
  let manifestOverride: string | null = null;
  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];
    if (arg === '--manifest' && i + 1 < cliArgs.length) {
      manifestOverride = cliArgs[i + 1] ?? null;
      break;
    }
    if (arg?.startsWith('--manifest=')) {
      manifestOverride = arg.slice('--manifest='.length);
      break;
    }
  }
  const batchManifestPath = manifestOverride
    ? path.isAbsolute(manifestOverride)
      ? manifestOverride
      : path.join(repoRoot, manifestOverride)
    : path.join(repoRoot, 'evals/batch/cola-cloud/manifest.json');
  const batchManifestDir = path.dirname(batchManifestPath);
  const batchManifest = JSON.parse(
    await readFile(batchManifestPath, 'utf8')
  ) as BatchFixtureManifest;
  const colaManifest = JSON.parse(
    await readFile(path.join(repoRoot, 'evals/labels/cola-cloud.manifest.json'), 'utf8')
  ) as ColaCloudManifest;
  const supplementalManifest = JSON.parse(
    await readFile(
      path.join(repoRoot, 'evals/labels/supplemental-negative.manifest.json'),
      'utf8'
    )
  ) as SupplementalNegativeManifest;
  const expectedById = new Map<string, ExpectedCase>();
  for (const testCase of colaManifest.cases) {
    expectedById.set(testCase.id, {
      id: testCase.id,
      filename: path.basename(testCase.assetPath),
      title: testCase.title,
      beverageType: testCase.beverageType,
      expectedRecommendation: testCase.expectedRecommendation ?? 'approve',
      source: 'cola-cloud',
      expectedFields: {
        brandName: testCase.colaCloudMeta.brandName,
        fancifulName: testCase.colaCloudMeta.productName ?? '',
        classType: testCase.colaCloudMeta.className,
        alcoholContent: formatAlcoholContent(testCase.colaCloudMeta.abv),
        netContents: defaultNetContents(testCase.beverageType),
        appellation: testCase.colaCloudMeta.wineAppellation ?? '',
        vintage:
          testCase.colaCloudMeta.wineVintageYear === null
            ? ''
            : String(testCase.colaCloudMeta.wineVintageYear)
      }
    });
  }
  for (const testCase of supplementalManifest.cases) {
    expectedById.set(testCase.id, {
      id: testCase.id,
      filename: path.basename(testCase.assetPath),
      title: testCase.title,
      beverageType: testCase.beverageType,
      expectedRecommendation: testCase.expectedRecommendation,
      source: 'supplemental-generated',
      expectedFields: {
        brandName: testCase.batchCsv.brandName,
        fancifulName: testCase.batchCsv.fancifulName,
        classType: testCase.batchCsv.classType,
        alcoholContent: testCase.batchCsv.alcoholContent,
        netContents: testCase.batchCsv.netContents,
        appellation: testCase.batchCsv.appellation,
        vintage: testCase.batchCsv.vintage
      }
    });
  }
  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not determine batch fixture server address.');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const runResults: Array<{
      id: string;
      title: string;
      preflight: {
        matched: number;
        ambiguous: number;
        unmatchedImages: number;
        unmatchedRows: number;
        csvError: string | null;
        fileErrors: string[];
        durationMs: number;
      };
      run: {
        summary: {
          pass: number;
          review: number;
          fail: number;
          error: number;
        };
        latency: {
          runDurationMs: number;
          exportDurationMs: number;
          totalDurationMs: number;
          itemCount: number;
          avgPerItemMs: number;
          minPerItemMs: number;
          maxPerItemMs: number;
          p50PerItemMs: number;
          p95PerItemMs: number;
        };
        fieldMetrics: Record<string, FieldMetric>;
        ruleMetrics: Record<string, RuleMetric>;
        rowStatuses: Array<{
          imageId: string;
          filename: string;
          status: string;
          expectedRecommendation: string | null;
          fixtureTitle: string | null;
          fixtureSource: string | null;
          expectedFields: ExpectedCase['expectedFields'] | null;
          brandName: string;
          classType: string;
          reportId: string | null;
          extractionQualityState: ExtractionQualityState | null;
          verdictSecondary: string | null;
          summary: string | null;
          latencyMs: number | null;
          issues: {
            blocker: number;
            major: number;
            minor: number;
            note: number;
          };
          errorMessage: string | null;
          fieldChecks: Record<
            string,
            {
              status: string;
              summary: string;
              confidence: number;
              applicationValue: string | null;
              extractedValue: string | null;
              comparisonStatus: string | null;
            } | null
          >;
          ruleChecks: Record<
            string,
            {
              status: string;
              summary: string;
              confidence: number;
            } | null
          >;
        }>;
      };
    }> = [];
    for (const set of batchManifest.sets) {
      const form = new FormData();
      const images: Array<{ id: string; filename: string }> = [];
      for (const imageCase of set.imageCases) {
        const absPath = path.join(repoRoot, imageCase.assetPath);
        const buffer = await readFile(absPath);
        const filename = path.basename(absPath);
        const file = makeFile(buffer, filename, mimeTypeFor(absPath));
        images.push({ id: imageCase.id, filename });
        form.append('labels', file);
      }
      // CSVs live alongside the manifest (so the PDF variant can ship its
      // own cola-cloud-pdf/<pack>.csv without cloning the runner).
      const csvPath = path.join(batchManifestDir, set.csvFile);
      const csvBuffer = await readFile(csvPath);
      form.append(
        'manifest',
        JSON.stringify({
          batchClientId: `batch-fixture-${set.id}`,
          images: images.map((image) => ({
            clientId: image.id,
            filename: image.filename,
            sizeBytes: 0,
            mimeType: mimeTypeFor(image.filename)
          })),
          csv: {
            filename: path.basename(csvPath),
            sizeBytes: csvBuffer.byteLength
          }
        })
      );
      form.append('csv', makeFile(csvBuffer, path.basename(csvPath), 'text/csv'));
      const preflightStart = performance.now();
      const preflightResponse = await fetch(`${baseUrl}/api/batch/preflight`, {
        method: 'POST',
        body: form
      });
      const preflight = batchPreflightResponseSchema.parse(await preflightResponse.json());
      const preflightDurationMs = Math.round(performance.now() - preflightStart);
      const rowByFilename = new Map(
        preflight.csvRows.map((row) => [row.filenameHint, row.id] as const)
      );
      const resolutions = [
        ...preflight.matching.ambiguous.map((entry) => ({
          imageId: entry.imageId,
          action: {
            kind: 'matched' as const,
            rowId:
              rowByFilename.get(
                images.find((image) => image.id === entry.imageId)?.filename ?? ''
              ) ?? entry.candidates[0]!.id
          }
        })),
        ...preflight.matching.unmatchedImageIds.map((imageId) => {
          const filename = images.find((image) => image.id === imageId)?.filename ?? '';
          const rowId = rowByFilename.get(filename);
          if (!rowId) {
            return {
              imageId,
              action: { kind: 'dropped' as const }
            };
          }
          return {
            imageId,
            action: {
              kind: 'matched' as const,
              rowId
            }
          };
        })
      ];
      const runStart = performance.now();
      const runResponse = await fetch(`${baseUrl}/api/batch/run`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          batchSessionId: preflight.batchSessionId,
          resolutions
        })
      });
      const { itemLatencyMs } = await collectNdjsonFramesWithLatency(runResponse, runStart);
      const runDurationMs = Math.round(performance.now() - runStart);
      const exportStart = performance.now();
      const exportResponse = await fetch(
        `${baseUrl}/api/batch/${preflight.batchSessionId}/export`
      );
      const exportPayload = batchExportPayloadSchema.parse(await exportResponse.json());
      const exportDurationMs = Math.round(performance.now() - exportStart);

      // Compute latency stats
      const latencies = Array.from(itemLatencyMs.values())
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      const latencyStats = {
        runDurationMs,
        exportDurationMs,
        totalDurationMs: runDurationMs + exportDurationMs,
        itemCount: latencies.length,
        avgPerItemMs:
          latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0,
        minPerItemMs: latencies[0] ?? 0,
        maxPerItemMs: latencies[latencies.length - 1] ?? 0,
        p50PerItemMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
        p95PerItemMs: latencies[Math.floor(latencies.length * 0.95)] ?? 0
      };
      const summary = batchDashboardResponseSchema.parse({
        batchSessionId: preflight.batchSessionId,
        phase: exportPayload.phase,
        totals: exportPayload.totals,
        summary: exportPayload.summary,
        rows: exportPayload.rows
      });
      const fieldMetrics = Object.fromEntries(
        FIELD_CHECK_IDS.map((id) => [id, emptyFieldMetric()])
      ) as Record<string, FieldMetric>;
      const ruleMetrics = Object.fromEntries(
        RULE_CHECK_IDS.map((id) => [id, emptyRuleMetric()])
      ) as Record<string, RuleMetric>;
      runResults.push({
        id: set.id,
        title: set.title,
        preflight: {
          matched: preflight.matching.matched.length,
          ambiguous: preflight.matching.ambiguous.length,
          unmatchedImages: preflight.matching.unmatchedImageIds.length,
          unmatchedRows: preflight.matching.unmatchedRowIds.length,
          csvError: preflight.csvError?.message ?? null,
          fileErrors: preflight.fileErrors.map((entry) => entry.message),
          durationMs: preflightDurationMs
        },
        run: {
          summary: summary.summary,
          latency: latencyStats,
          fieldMetrics,
          ruleMetrics,
          rowStatuses: summary.rows.map((row) => {
            const expected = expectedById.get(row.imageId) ?? null;
            const report = row.reportId ? exportPayload.reports[row.reportId] : null;
            const fieldChecks = Object.fromEntries(
              FIELD_CHECK_IDS.map((id) => {
                const check = report ? findCheck(report, id) : null;
                if (check) {
                  incrementFieldMetric(fieldMetrics[id], check);
                }
                return [
                  id,
                  check
                    ? {
                        status: check.status,
                        summary: check.summary,
                        confidence: check.confidence,
                        applicationValue: check.applicationValue ?? null,
                        extractedValue: check.extractedValue ?? null,
                        comparisonStatus: check.comparison?.status ?? null
                      }
                    : null
                ];
              })
            ) as Record<
              string,
              {
                status: string;
                summary: string;
                confidence: number;
                applicationValue: string | null;
                extractedValue: string | null;
                comparisonStatus: string | null;
              } | null
            >;
            const ruleChecks = Object.fromEntries(
              RULE_CHECK_IDS.map((id) => {
                const check = report ? findCheck(report, id) : null;
                if (check) {
                  incrementRuleMetric(ruleMetrics[id], check);
                }
                return [
                  id,
                  check
                    ? {
                        status: check.status,
                        summary: check.summary,
                        confidence: check.confidence
                      }
                    : null
                ];
              })
            ) as Record<
              string,
              {
                status: string;
                summary: string;
                confidence: number;
              } | null
            >;
            return {
              imageId: row.imageId,
              filename: row.filename,
              status: row.status,
              expectedRecommendation: expected?.expectedRecommendation ?? null,
              fixtureTitle: expected?.title ?? null,
              fixtureSource: expected?.source ?? null,
              expectedFields: expected?.expectedFields ?? null,
              brandName: row.brandName,
              classType: row.classType,
              reportId: row.reportId,
              extractionQualityState: report?.extractionQuality.state ?? null,
              verdictSecondary: report?.verdictSecondary ?? null,
              summary: report?.summary ?? null,
              latencyMs: itemLatencyMs.get(row.imageId) ?? null,
              issues: row.issues,
              errorMessage: row.errorMessage,
              fieldChecks,
              ruleChecks
            };
          })
        }
      });
    }
    const timestamp = new Date().toISOString();
    const output = {
      generatedAt: timestamp,
      manifest: path.relative(repoRoot, batchManifestPath),
      results: runResults
    };
    // Allow overriding the output path via --output <path> or OUTPUT_PATH env.
    // Falls back to the canonical file to preserve existing callers.
    const argv = process.argv.slice(2);
    let outputOverride: string | null = null;
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--output' && i + 1 < argv.length) {
        outputOverride = argv[i + 1] ?? null;
        break;
      }
      if (argv[i]?.startsWith('--output=')) {
        outputOverride = argv[i]!.slice('--output='.length);
        break;
      }
    }
    if (!outputOverride && process.env.OUTPUT_PATH?.trim()) {
      outputOverride = process.env.OUTPUT_PATH.trim();
    }
    const outputPath = outputOverride
      ? path.isAbsolute(outputOverride)
        ? outputOverride
        : path.join(repoRoot, outputOverride)
      : path.join(
          repoRoot,
          'evals/results/2026-04-15-TTB-EVAL-001-batch-real-corpus.json'
        );
    await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
    console.log(`[batch-fixtures] wrote ${outputPath}`);

    // Aggregate latency across all packs
    const allItemLatencies: number[] = [];
    let totalPass = 0;
    let totalReview = 0;
    let totalFail = 0;
    let totalError = 0;
    for (const pack of runResults) {
      totalPass += pack.run.summary.pass;
      totalReview += pack.run.summary.review;
      totalFail += pack.run.summary.fail;
      totalError += pack.run.summary.error;
      for (const row of pack.run.rowStatuses) {
        if (row.latencyMs !== null && row.latencyMs > 0) {
          allItemLatencies.push(row.latencyMs);
        }
      }
    }
    allItemLatencies.sort((a, b) => a - b);
    const n = allItemLatencies.length;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('AGGREGATE RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Verdicts: pass=${totalPass} review=${totalReview} fail=${totalFail} error=${totalError}`);
    console.log(`Total items with latency: ${n}`);
    if (n > 0) {
      const avg = Math.round(allItemLatencies.reduce((a, b) => a + b, 0) / n);
      console.log(
        `Per-item latency (ms): avg=${avg} min=${allItemLatencies[0]} p50=${allItemLatencies[Math.floor(n / 2)]} p95=${allItemLatencies[Math.floor(n * 0.95)]} max=${allItemLatencies[n - 1]}`
      );
    }
    console.log('');
    console.log('Per-pack latency:');
    for (const pack of runResults) {
      console.log(
        `  ${pack.id.padEnd(35)} run=${pack.run.latency.runDurationMs}ms avg=${pack.run.latency.avgPerItemMs}ms p95=${pack.run.latency.p95PerItemMs}ms`
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export const _unused_ndjson = _collectNdjsonFrames;
