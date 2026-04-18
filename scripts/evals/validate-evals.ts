import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type GoldenCase = {
  id: string;
  slug: string;
  suiteIds: string[];
  requiresLiveAsset: boolean;
  assetPath?: string;
};

type GoldenManifest = {
  version: number;
  slices: Record<string, { caseIds: string[] }>;
  cases: GoldenCase[];
};

type LiveLabelCase = {
  id: string;
  goldenCaseId: string;
  assetPath: string;
  expectedRecommendation: string;
};

type LiveLabelsManifest = {
  version: number;
  sliceId: string;
  cases: LiveLabelCase[];
};

export type LiveLabelManifestReport = {
  fileName: string;
  sliceId: string;
  caseCount: number;
};

export type EvalManifestValidationReport = {
  goldenCaseCount: number;
  goldenSliceCount: number;
  liveLabelManifests: LiveLabelManifestReport[];
};

function fail(message: string): never {
  console.error(`[evals:validate] ${message}`);
  process.exit(1);
}

function readJson<T>(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      fail(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function basename(filePath: string) {
  return path.basename(filePath);
}

function getLiveLabelManifestPaths(repoRoot: string) {
  const liveLabelsDir = path.join(repoRoot, 'evals/labels');

  return readdirSync(liveLabelsDir)
    .filter((fileName) => fileName.endsWith('manifest.json'))
    .map((fileName) => path.join(liveLabelsDir, fileName))
    .sort((left, right) => basename(left).localeCompare(basename(right)));
}

function validateLiveLabelManifest(input: {
  manifestPath: string;
  manifest: LiveLabelsManifest;
  goldenById: Map<string, GoldenCase>;
  goldenSlices: GoldenManifest['slices'];
}) {
  const fileName = basename(input.manifestPath);
  const liveLabels = input.manifest;
  const goldenSlice = input.goldenSlices[liveLabels.sliceId];
  if (!goldenSlice) {
    fail(
      `Live label manifest '${fileName}' references unknown golden slice '${liveLabels.sliceId}'.`
    );
  }

  if (!Array.isArray(liveLabels.cases) || liveLabels.cases.length === 0) {
    fail(`Live label manifest '${fileName}' has no cases.`);
  }

  assertUnique(
    liveLabels.cases.map((testCase) => testCase.id),
    `live label case id in '${fileName}'`
  );
  assertUnique(
    liveLabels.cases.map((testCase) => testCase.goldenCaseId),
    `live label golden case id in '${fileName}'`
  );

  const manifestGoldenIds = new Set<string>();
  const goldenSliceIds = new Set(goldenSlice.caseIds);

  for (const liveCase of liveLabels.cases) {
    const goldenCase = input.goldenById.get(liveCase.goldenCaseId);
    if (!goldenCase) {
      fail(
        `Live label case '${liveCase.id}' in '${fileName}' references unknown golden case '${liveCase.goldenCaseId}'.`
      );
    }

    if (goldenCase.slug !== liveCase.id) {
      fail(
        `Live label case '${liveCase.id}' in '${fileName}' does not match golden slug '${goldenCase.slug}'.`
      );
    }

    if (!goldenCase.requiresLiveAsset) {
      fail(
        `Live label case '${liveCase.id}' in '${fileName}' points at golden case '${liveCase.goldenCaseId}' which is not marked requiresLiveAsset.`
      );
    }

    if (goldenCase.assetPath && basename(goldenCase.assetPath) !== basename(liveCase.assetPath)) {
      fail(
        `Asset mismatch for live label case '${liveCase.id}' in '${fileName}': '${liveCase.assetPath}' vs '${goldenCase.assetPath}'.`
      );
    }

    if (!goldenSliceIds.has(liveCase.goldenCaseId)) {
      fail(
        `Live label case '${liveCase.id}' in '${fileName}' is not part of the golden '${liveLabels.sliceId}' slice.`
      );
    }

    manifestGoldenIds.add(liveCase.goldenCaseId);
  }

  for (const caseId of goldenSlice.caseIds) {
    if (!manifestGoldenIds.has(caseId)) {
      fail(
        `Live label manifest '${fileName}' is missing golden slice case '${caseId}' for '${liveLabels.sliceId}'.`
      );
    }
  }

  return {
    fileName,
    sliceId: liveLabels.sliceId,
    caseCount: liveLabels.cases.length
  } satisfies LiveLabelManifestReport;
}

export function validateEvalManifests(input: {
  repoRoot: string;
}): EvalManifestValidationReport {
  const repoRoot = input.repoRoot;
  const goldenManifestPath = path.join(repoRoot, 'evals/golden/manifest.json');

  const golden = readJson<GoldenManifest>(goldenManifestPath);

  if (!Array.isArray(golden.cases) || golden.cases.length === 0) {
    fail('Golden manifest has no cases.');
  }

  if (!golden.slices || typeof golden.slices !== 'object') {
    fail('Golden manifest slices are missing.');
  }

  assertUnique(
    golden.cases.map((testCase) => testCase.id),
    'golden case id'
  );
  assertUnique(
    golden.cases.map((testCase) => testCase.slug),
    'golden case slug'
  );

  const goldenIds = new Set(golden.cases.map((testCase) => testCase.id));
  const goldenSliceIds = new Set(Object.keys(golden.slices));
  const goldenById = new Map(
    golden.cases.map((testCase) => [testCase.id, testCase] as const)
  );

  for (const [sliceId, slice] of Object.entries(golden.slices)) {
    if (!Array.isArray(slice.caseIds) || slice.caseIds.length === 0) {
      fail(`Golden slice '${sliceId}' has no case ids.`);
    }

    for (const caseId of slice.caseIds) {
      if (!goldenIds.has(caseId)) {
        fail(`Golden slice '${sliceId}' references unknown case '${caseId}'.`);
      }
    }
  }

  for (const goldenCase of golden.cases) {
    if (!Array.isArray(goldenCase.suiteIds) || goldenCase.suiteIds.length === 0) {
      fail(`Golden case '${goldenCase.id}' has no suiteIds.`);
    }

    for (const suiteId of goldenCase.suiteIds) {
      if (!goldenSliceIds.has(suiteId)) {
        fail(`Golden case '${goldenCase.id}' references unknown suite '${suiteId}'.`);
      }
    }
  }

  if (!golden.slices['core-six']) {
    fail("Golden manifest is missing the 'core-six' slice.");
  }

  const liveLabelManifests = getLiveLabelManifestPaths(repoRoot).map((manifestPath) =>
    validateLiveLabelManifest({
      manifestPath,
      manifest: readJson<LiveLabelsManifest>(manifestPath),
      goldenById,
      goldenSlices: golden.slices
    })
  );

  return {
    goldenCaseCount: golden.cases.length,
    goldenSliceCount: Object.keys(golden.slices).length,
    liveLabelManifests
  };
}

function main() {
  const report = validateEvalManifests({
    repoRoot: process.cwd()
  });

  console.log('[evals:validate] OK');
  console.log(`- golden cases: ${report.goldenCaseCount} across ${report.goldenSliceCount} slices`);
  for (const manifest of report.liveLabelManifests) {
    console.log(
      `- live label subset ${manifest.fileName}: ${manifest.caseCount} (${manifest.sliceId})`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
