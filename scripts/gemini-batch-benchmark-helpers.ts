import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { LoadedGeminiBatchCase } from './gemini-batch-extraction';
import {
  defaultNetContents,
  formatAlcoholContent,
  type ColaCloudManifest,
  type SupplementalNegativeManifest
} from './eval-corpus-types';

export const GEMINI_BATCH_BENCHMARK_STORY_ID = 'TTB-EVAL-002';
export const DEFAULT_GEMINI_BATCH_POLL_MS = 5_000;
export const DEFAULT_GEMINI_BATCH_TIMEOUT_MS = 24 * 60 * 60 * 1_000;

export type GeminiBatchBenchmarkOptions = {
  dryRun: boolean;
  keepJob: boolean;
  outputPath?: string;
  pollMs: number;
  timeoutMs: number;
};

export function parseGeminiBatchBenchmarkArgs(
  argv: string[]
): GeminiBatchBenchmarkOptions {
  let dryRun = false;
  let keepJob = false;
  let outputPath: string | undefined;
  let pollMs = readPositiveInteger(
    process.env.GEMINI_BATCH_POLL_MS,
    DEFAULT_GEMINI_BATCH_POLL_MS
  );
  let timeoutMs = readPositiveInteger(
    process.env.GEMINI_BATCH_TIMEOUT_MS,
    DEFAULT_GEMINI_BATCH_TIMEOUT_MS
  );

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--keep-job') {
      keepJob = true;
      continue;
    }

    if (arg === '--output' && argv[index + 1]) {
      outputPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg?.startsWith('--output=')) {
      outputPath = arg.slice('--output='.length);
      continue;
    }

    if (arg === '--poll-ms' && argv[index + 1]) {
      pollMs = readPositiveInteger(argv[index + 1], pollMs);
      index += 1;
      continue;
    }

    if (arg?.startsWith('--poll-ms=')) {
      pollMs = readPositiveInteger(arg.slice('--poll-ms='.length), pollMs);
      continue;
    }

    if (arg === '--timeout-ms' && argv[index + 1]) {
      timeoutMs = readPositiveInteger(argv[index + 1], timeoutMs);
      index += 1;
      continue;
    }

    if (arg?.startsWith('--timeout-ms=')) {
      timeoutMs = readPositiveInteger(arg.slice('--timeout-ms='.length), timeoutMs);
      continue;
    }
  }

  return {
    dryRun,
    keepJob,
    outputPath,
    pollMs,
    timeoutMs
  };
}

export async function loadGeminiBatchBenchmarkCorpus(
  repoRoot: string
): Promise<LoadedGeminiBatchCase[]> {
  const colaCloudManifest = await readJsonFile<ColaCloudManifest>(
    path.join(repoRoot, 'evals/labels/cola-cloud.manifest.json')
  );
  const supplementalManifest = await readJsonFile<SupplementalNegativeManifest>(
    path.join(repoRoot, 'evals/labels/supplemental-negative.manifest.json')
  );

  const colaCloudCases = await Promise.all(
    colaCloudManifest.cases.map(async (caseItem) => {
      const assetPath = path.join(repoRoot, 'evals/labels', caseItem.assetPath);
      const buffer = await readFile(assetPath);
      const isImported =
        normalizeOptionalText(caseItem.colaCloudMeta.domesticOrImported) === 'imported';

      return {
        id: caseItem.id,
        title: caseItem.title,
        source: 'cola-cloud',
        beverageType: caseItem.beverageType,
        expectedRecommendation: caseItem.expectedRecommendation ?? 'approve',
        label: {
          originalName: path.basename(assetPath),
          mimeType: mimeTypeFor(assetPath),
          bytes: buffer.byteLength,
          buffer
        },
        fields: {
          beverageTypeHint: caseItem.beverageType,
          origin: isImported ? 'imported' : 'domestic',
          brandName: normalizeOptionalText(caseItem.colaCloudMeta.brandName),
          fancifulName: normalizeOptionalText(caseItem.colaCloudMeta.productName),
          classType: normalizeOptionalText(caseItem.colaCloudMeta.className),
          alcoholContent: normalizeOptionalText(
            formatAlcoholContent(caseItem.colaCloudMeta.abv)
          ),
          netContents: defaultNetContents(caseItem.beverageType),
          applicantAddress: undefined,
          country: isImported
            ? normalizeOptionalText(caseItem.colaCloudMeta.originName)
            : undefined,
          formulaId: normalizeOptionalText(caseItem.colaCloudMeta.ttbId),
          appellation: normalizeOptionalText(caseItem.colaCloudMeta.wineAppellation),
          vintage:
            caseItem.colaCloudMeta.wineVintageYear === null
              ? undefined
              : String(caseItem.colaCloudMeta.wineVintageYear),
          varietals: []
        },
        hasApplicationData: true,
        standalone: false,
        expectedFields: {
          brandName: caseItem.colaCloudMeta.brandName.trim(),
          fancifulName: normalizeOptionalText(caseItem.colaCloudMeta.productName) ?? '',
          classType: caseItem.colaCloudMeta.className.trim(),
          alcoholContent: formatAlcoholContent(caseItem.colaCloudMeta.abv),
          netContents: defaultNetContents(caseItem.beverageType),
          appellation: normalizeOptionalText(caseItem.colaCloudMeta.wineAppellation) ?? '',
          vintage:
            caseItem.colaCloudMeta.wineVintageYear === null
              ? ''
              : String(caseItem.colaCloudMeta.wineVintageYear)
        }
      } satisfies LoadedGeminiBatchCase;
    })
  );

  const supplementalCases = await Promise.all(
    supplementalManifest.cases.map(async (caseItem) => {
      const assetPath = path.join(repoRoot, 'evals/labels', caseItem.assetPath);
      const buffer = await readFile(assetPath);

      return {
        id: caseItem.id,
        title: caseItem.title,
        source: 'supplemental-generated',
        beverageType: caseItem.beverageType,
        expectedRecommendation: caseItem.expectedRecommendation,
        label: {
          originalName: path.basename(assetPath),
          mimeType: mimeTypeFor(assetPath),
          bytes: buffer.byteLength,
          buffer
        },
        fields: {
          beverageTypeHint: caseItem.beverageType,
          origin: caseItem.batchCsv.origin === 'imported' ? 'imported' : 'domestic',
          brandName: normalizeOptionalText(caseItem.batchCsv.brandName),
          fancifulName: normalizeOptionalText(caseItem.batchCsv.fancifulName),
          classType: normalizeOptionalText(caseItem.batchCsv.classType),
          alcoholContent: normalizeOptionalText(caseItem.batchCsv.alcoholContent),
          netContents: normalizeOptionalText(caseItem.batchCsv.netContents),
          applicantAddress: undefined,
          country: normalizeOptionalText(caseItem.batchCsv.country),
          formulaId: normalizeOptionalText(caseItem.batchCsv.formulaId),
          appellation: normalizeOptionalText(caseItem.batchCsv.appellation),
          vintage: normalizeOptionalText(caseItem.batchCsv.vintage),
          varietals: []
        },
        hasApplicationData: true,
        standalone: false,
        expectedFields: {
          brandName: caseItem.batchCsv.brandName.trim(),
          fancifulName: caseItem.batchCsv.fancifulName.trim(),
          classType: caseItem.batchCsv.classType.trim(),
          alcoholContent: caseItem.batchCsv.alcoholContent.trim(),
          netContents: caseItem.batchCsv.netContents.trim(),
          appellation: caseItem.batchCsv.appellation.trim(),
          vintage: caseItem.batchCsv.vintage.trim()
        }
      } satisfies LoadedGeminiBatchCase;
    })
  );

  return [...colaCloudCases, ...supplementalCases];
}

export function resolveGeminiBatchBenchmarkOutputPath(input: {
  repoRoot: string;
  generatedAt: string;
  outputPath?: string;
}) {
  if (input.outputPath) {
    return path.isAbsolute(input.outputPath)
      ? input.outputPath
      : path.join(input.repoRoot, input.outputPath);
  }

  return path.join(
    input.repoRoot,
    'evals/results',
    `${sanitizeTimestampForFilename(input.generatedAt)}-${GEMINI_BATCH_BENCHMARK_STORY_ID}-gemini-batch-extraction.json`
  );
}

export function summarizeGeminiBatchBenchmarkSources(
  cases: LoadedGeminiBatchCase[]
) {
  const counts: Record<string, number> = {};
  for (const caseItem of cases) {
    counts[caseItem.source] = (counts[caseItem.source] ?? 0) + 1;
  }
  return counts;
}

export async function writeGeminiBatchBenchmarkArtifact(
  outputPath: string,
  artifact: unknown
) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(artifact, null, 2) + '\n');
}

export function sanitizeTimestampForFilename(value: string) {
  return value.replaceAll(':', '-').replaceAll('.', '-');
}

function readPositiveInteger(rawValue: string | undefined, fallback: number) {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function mimeTypeFor(filePath: string) {
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}
