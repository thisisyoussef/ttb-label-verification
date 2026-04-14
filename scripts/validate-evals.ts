import { readFileSync } from 'node:fs';
import path from 'node:path';

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

function main() {
  const repoRoot = process.cwd();
  const goldenManifestPath = path.join(repoRoot, 'evals/golden/manifest.json');
  const liveLabelsManifestPath = path.join(repoRoot, 'evals/labels/manifest.json');

  const golden = readJson<GoldenManifest>(goldenManifestPath);
  const liveLabels = readJson<LiveLabelsManifest>(liveLabelsManifestPath);

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

  if (!Array.isArray(liveLabels.cases) || liveLabels.cases.length === 0) {
    fail('Live label manifest has no cases.');
  }

  assertUnique(
    liveLabels.cases.map((testCase) => testCase.id),
    'live label case id'
  );
  assertUnique(
    liveLabels.cases.map((testCase) => testCase.goldenCaseId),
    'live label golden case id'
  );

  for (const liveCase of liveLabels.cases) {
    const goldenCase = goldenById.get(liveCase.goldenCaseId);
    if (!goldenCase) {
      fail(
        `Live label case '${liveCase.id}' references unknown golden case '${liveCase.goldenCaseId}'.`
      );
    }

    if (goldenCase.slug !== liveCase.id) {
      fail(
        `Live label case '${liveCase.id}' does not match golden slug '${goldenCase.slug}'.`
      );
    }

    if (!goldenCase.requiresLiveAsset) {
      fail(
        `Live label case '${liveCase.id}' points at golden case '${liveCase.goldenCaseId}' which is not marked requiresLiveAsset.`
      );
    }

    if (goldenCase.assetPath && basename(goldenCase.assetPath) !== basename(liveCase.assetPath)) {
      fail(
        `Asset mismatch for live label case '${liveCase.id}': '${liveCase.assetPath}' vs '${goldenCase.assetPath}'.`
      );
    }
  }

  const coreSixIds = new Set(golden.slices['core-six'].caseIds);
  for (const liveCase of liveLabels.cases) {
    if (!coreSixIds.has(liveCase.goldenCaseId)) {
      fail(
        `Live label case '${liveCase.id}' is not part of the golden 'core-six' slice.`
      );
    }
  }

  console.log('[evals:validate] OK');
  console.log(
    `- golden cases: ${golden.cases.length} across ${Object.keys(golden.slices).length} slices`
  );
  console.log(`- live label subset: ${liveLabels.cases.length}`);
  console.log(`- live label slice: ${liveLabels.sliceId}`);
}

main();
