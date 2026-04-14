import { readFileSync } from 'node:fs';

type GoldenSlice = {
  description: string;
  caseIds: string[];
};

type GoldenCase = {
  id: string;
  slug: string;
  title: string;
};

type GoldenManifest = {
  version: number;
  source: string;
  slices: Record<string, GoldenSlice>;
  cases: GoldenCase[];
};

const manifestUrl = new URL('../../golden/manifest.json', import.meta.url);
const manifest = JSON.parse(
  readFileSync(manifestUrl, 'utf8')
) as GoldenManifest;
const caseLookup = new Map(manifest.cases.map((entry) => [entry.id, entry]));

export function getGoldenCase(caseId: string) {
  const entry = caseLookup.get(caseId);

  if (!entry) {
    throw new Error(`Golden manifest does not include case ${caseId}.`);
  }

  return entry;
}

export function getGoldenSlice(sliceId: string) {
  const slice = manifest.slices[sliceId];

  if (!slice) {
    throw new Error(`Golden manifest does not include slice ${sliceId}.`);
  }

  return slice;
}

export function assertGoldenCasesExist(caseIds: string[]) {
  caseIds.forEach((caseId) => {
    getGoldenCase(caseId);
  });
}

export function goldenCaseTitle(caseId: string) {
  return getGoldenCase(caseId).title;
}

export function goldenSliceCaseIds(sliceId: string) {
  return [...getGoldenSlice(sliceId).caseIds];
}
