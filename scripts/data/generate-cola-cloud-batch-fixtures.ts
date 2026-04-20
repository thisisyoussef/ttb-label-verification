import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type ColaCloudCase = {
  id: string;
  goldenCaseId: string;
  title: string;
  assetPath: string;
  secondaryAssetPath?: string | null;
  beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage';
  expectedRecommendation: 'approve' | 'review' | 'reject';
  colaCloudMeta: {
    ttbId: string;
    abv: number | null;
    className: string;
    originName: string;
    domesticOrImported: string;
    approvalDate: string | null;
    brandName: string;
    productName: string;
    grapeVarietals: string[] | null;
    wineAppellation: string | null;
    wineVintageYear: number | null;
  };
};

type ColaCloudManifest = {
  version: number;
  sourceManifest: string;
  sliceId: string;
  description: string;
  cases: ColaCloudCase[];
};

type SupplementalNegativeCase = {
  id: string;
  goldenCaseId: string;
  title: string;
  assetPath: string;
  beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage';
  scenario: string;
  expectedRecommendation: 'review' | 'reject';
  sourceCaseId: string;
  mutation: {
    kind: string;
    note: string;
  };
  batchCsv: {
    brandName: string;
    fancifulName: string;
    classType: string;
    alcoholContent: string;
    netContents: string;
    origin: string;
    country: string;
    formulaId: string;
    appellation: string;
    vintage: string;
  };
};

type SupplementalNegativeManifest = {
  version: number;
  sourceManifest: string;
  sliceId: string;
  description: string;
  cases: SupplementalNegativeCase[];
};

type BatchFixtureSet = {
  id: string;
  title: string;
  description: string;
  csvFile: string;
  imageCases: Array<{
    id: string;
    sampleId?: string;
    isSecondary?: boolean;
    assetPath: string;
    beverageType: string;
    expectedRecommendation: string;
    source: 'cola-cloud' | 'supplemental-generated';
  }>;
};

type BatchFixtureManifest = {
  version: number;
  sourceManifests: string[];
  description: string;
  sets: BatchFixtureSet[];
};

const CSV_HEADERS = [
  'filename',
  'secondary_filename',
  'beverage_type',
  'brand_name',
  'fanciful_name',
  'class_type',
  'alcohol_content',
  'net_contents',
  'applicant_address',
  'origin',
  'country',
  'formula_id',
  'appellation',
  'vintage'
] as const;

function csvEscape(value: string | null | undefined) {
  const normalized = value ?? '';
  if (
    normalized.includes('"') ||
    normalized.includes(',') ||
    normalized.includes('\n')
  ) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
}

function formatAlcoholContent(abv: number | null) {
  if (abv === null) {
    return '';
  }

  const rendered = Number.isInteger(abv) ? String(abv) : String(abv);
  return `${rendered}% Alc./Vol.`;
}

function _defaultNetContents(beverageType: ColaCloudCase['beverageType']) {
  switch (beverageType) {
    case 'wine':
    case 'distilled-spirits':
      return '750 mL';
    case 'malt-beverage':
      return '12 FL OZ';
  }
}

function buildCsvRow(testCase: ColaCloudCase) {
  const meta = testCase.colaCloudMeta;

  return [
    path.basename(testCase.assetPath),
    path.basename(testCase.secondaryAssetPath ?? ''),
    testCase.beverageType,
    meta.brandName,
    meta.productName,
    meta.className,
    formatAlcoholContent(meta.abv),
    // COLA Cloud applications don't carry net contents — leave blank so the
    // judgment layer treats this field as "not applicable" rather than
    // comparing against a synthetic default (which false-fails real labels
    // that are 355mL, 385mL, 1 PINT, etc.).
    '',
    '',
    meta.domesticOrImported === 'imported' ? 'imported' : 'domestic',
    meta.domesticOrImported === 'imported' ? meta.originName : '',
    '',
    meta.wineAppellation ?? '',
    meta.wineVintageYear === null ? '' : String(meta.wineVintageYear)
  ].map(csvEscape);
}

function expandColaCloudImageCases(testCase: ColaCloudCase) {
  return [
    {
      id: testCase.id,
      sampleId: testCase.id,
      isSecondary: false,
      assetPath: path.posix.join('evals/labels', testCase.assetPath),
      beverageType: testCase.beverageType,
      expectedRecommendation: testCase.expectedRecommendation,
      source: 'cola-cloud' as const
    },
    ...(testCase.secondaryAssetPath
      ? [
          {
            id: `${testCase.id}--secondary`,
            sampleId: testCase.id,
            isSecondary: true,
            assetPath: path.posix.join('evals/labels', testCase.secondaryAssetPath),
            beverageType: testCase.beverageType,
            expectedRecommendation: testCase.expectedRecommendation,
            source: 'cola-cloud' as const
          }
        ]
      : [])
  ];
}

async function writeCsv(outputPath: string, cases: ColaCloudCase[]) {
  const lines = [CSV_HEADERS.join(',')];
  for (const testCase of cases) {
    lines.push(buildCsvRow(testCase).join(','));
  }

  await writeFile(outputPath, `${lines.join('\n')}\n`);
}

async function writeRawCsvRows(outputPath: string, rows: string[][]) {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }

  await writeFile(outputPath, `${lines.join('\n')}\n`);
}

async function main() {
  const repoRoot = process.cwd();
  const colaManifestPath = path.join(repoRoot, 'evals/labels/cola-cloud.manifest.json');
  const colaManifest = JSON.parse(
    await readFile(colaManifestPath, 'utf8')
  ) as ColaCloudManifest;
  const supplementalManifestPath = path.join(
    repoRoot,
    'evals/labels/supplemental-negative.manifest.json'
  );
  const supplementalManifest = JSON.parse(
    await readFile(supplementalManifestPath, 'utf8')
  ) as SupplementalNegativeManifest;

  const outputDir = path.join(repoRoot, 'evals/batch/cola-cloud');
  await mkdir(outputDir, { recursive: true });

  const byType = {
    'distilled-spirits': colaManifest.cases.filter(
      (testCase) => testCase.beverageType === 'distilled-spirits'
    ),
    wine: colaManifest.cases.filter((testCase) => testCase.beverageType === 'wine'),
    'malt-beverage': colaManifest.cases.filter(
      (testCase) => testCase.beverageType === 'malt-beverage'
    )
  } as const;

  const allCases = colaManifest.cases;
  const mixedCases = [
    colaManifest.cases.find((testCase) =>
      testCase.id === 'simply-elegant-simply-elegant-spirits-distilled-spirits'
    ),
    colaManifest.cases.find((testCase) => testCase.id === 'leitz-rottland-wine'),
    colaManifest.cases.find((testCase) => testCase.id === 'lake-placid-shredder-malt-beverage')
  ].filter((testCase): testCase is ColaCloudCase => testCase !== undefined);

  const allCsv = 'cola-cloud-all.csv';
  const spiritsCsv = 'cola-cloud-spirits.csv';
  const wineCsv = 'cola-cloud-wine.csv';
  const maltCsv = 'cola-cloud-malt.csv';
  const mixedCsv = 'cola-cloud-mixed.csv';
  const negativeCsv = 'supplemental-negative.csv';
  const negativeRejectCsv = 'supplemental-negative-reject.csv';
  const mixedNegativeCsv = 'cola-cloud-mixed-negative.csv';

  await writeCsv(path.join(outputDir, allCsv), allCases);
  await writeCsv(path.join(outputDir, spiritsCsv), byType['distilled-spirits']);
  await writeCsv(path.join(outputDir, wineCsv), byType.wine);
  await writeCsv(path.join(outputDir, maltCsv), byType['malt-beverage']);
  await writeCsv(path.join(outputDir, mixedCsv), mixedCases);

  await writeRawCsvRows(
    path.join(outputDir, negativeCsv),
    supplementalManifest.cases.map((testCase) => [
      path.basename(testCase.assetPath),
      '',
      testCase.beverageType,
      testCase.batchCsv.brandName,
      testCase.batchCsv.fancifulName,
      testCase.batchCsv.classType,
      testCase.batchCsv.alcoholContent,
      testCase.batchCsv.netContents,
      '',
      testCase.batchCsv.origin,
      testCase.batchCsv.country,
      testCase.batchCsv.formulaId,
      testCase.batchCsv.appellation,
      testCase.batchCsv.vintage
    ])
  );
  await writeRawCsvRows(
    path.join(outputDir, negativeRejectCsv),
    supplementalManifest.cases
      .filter((testCase) => testCase.expectedRecommendation === 'reject')
      .map((testCase) => [
        path.basename(testCase.assetPath),
        '',
        testCase.beverageType,
        testCase.batchCsv.brandName,
        testCase.batchCsv.fancifulName,
        testCase.batchCsv.classType,
        testCase.batchCsv.alcoholContent,
        testCase.batchCsv.netContents,
        '',
        testCase.batchCsv.origin,
        testCase.batchCsv.country,
        testCase.batchCsv.formulaId,
        testCase.batchCsv.appellation,
        testCase.batchCsv.vintage
      ])
  );
  await writeRawCsvRows(
    path.join(outputDir, mixedNegativeCsv),
    [
      ...mixedCases.map((testCase) => buildCsvRow(testCase)),
      ...supplementalManifest.cases.slice(0, 3).map((testCase) => [
        path.basename(testCase.assetPath),
        '',
        testCase.beverageType,
        testCase.batchCsv.brandName,
        testCase.batchCsv.fancifulName,
        testCase.batchCsv.classType,
        testCase.batchCsv.alcoholContent,
        testCase.batchCsv.netContents,
        '',
        testCase.batchCsv.origin,
        testCase.batchCsv.country,
        testCase.batchCsv.formulaId,
        testCase.batchCsv.appellation,
        testCase.batchCsv.vintage
      ])
    ]
  );

  const manifest: BatchFixtureManifest = {
    version: 1,
    sourceManifests: [
      'evals/golden/manifest.json',
      'evals/labels/cola-cloud.manifest.json',
      'evals/labels/supplemental-negative.manifest.json'
    ],
    description:
      'Live batch fixture packs built from the real COLA Cloud image subset plus deterministic supplemental negative candidates.',
    sets: [
      {
        id: 'cola-cloud-all',
        title: 'COLA Cloud All',
        description: `All ${allCases.length} real approved labels in one batch.`,
        csvFile: allCsv,
        imageCases: allCases.flatMap(expandColaCloudImageCases)
      },
      {
        id: 'cola-cloud-spirits',
        title: 'COLA Cloud Spirits',
        description: `${byType['distilled-spirits'].length} distilled spirits labels.`,
        csvFile: spiritsCsv,
        imageCases: byType['distilled-spirits'].flatMap(expandColaCloudImageCases)
      },
      {
        id: 'cola-cloud-wine',
        title: 'COLA Cloud Wine',
        description: `${byType.wine.length} wine labels.`,
        csvFile: wineCsv,
        imageCases: byType.wine.flatMap(expandColaCloudImageCases)
      },
      {
        id: 'cola-cloud-malt',
        title: 'COLA Cloud Malt Beverage',
        description: `${byType['malt-beverage'].length} malt beverage labels.`,
        csvFile: maltCsv,
        imageCases: byType['malt-beverage'].flatMap(expandColaCloudImageCases)
      },
      {
        id: 'cola-cloud-mixed',
        title: 'COLA Cloud Mixed',
        description: 'Mixed real-label sample across all three beverage types.',
        csvFile: mixedCsv,
        imageCases: mixedCases.flatMap(expandColaCloudImageCases)
      },
      {
        id: 'supplemental-negative',
        title: 'Supplemental Negative',
        description:
          `${supplementalManifest.cases.length} deterministic negative and low-confidence fixtures derived from real labels.`,
        csvFile: negativeCsv,
        imageCases: supplementalManifest.cases.map((testCase) => ({
          id: testCase.id,
          assetPath: path.posix.join('evals/labels', testCase.assetPath),
          beverageType: testCase.beverageType,
          expectedRecommendation: testCase.expectedRecommendation,
          source: 'supplemental-generated'
        }))
      },
      {
        id: 'supplemental-negative-reject',
        title: 'Supplemental Negative Reject',
        description: 'Only deterministic reject-expected supplemental negatives.',
        csvFile: negativeRejectCsv,
        imageCases: supplementalManifest.cases
          .filter((testCase) => testCase.expectedRecommendation === 'reject')
          .map((testCase) => ({
            id: testCase.id,
            assetPath: path.posix.join('evals/labels', testCase.assetPath),
            beverageType: testCase.beverageType,
            expectedRecommendation: testCase.expectedRecommendation,
            source: 'supplemental-generated'
          }))
      },
      {
        id: 'cola-cloud-mixed-negative',
        title: 'COLA Cloud Mixed Negative',
        description: 'Mixed positive and negative sample for composition sensitivity checks.',
        csvFile: mixedNegativeCsv,
        imageCases: [
          ...mixedCases.map((testCase) => ({
            id: testCase.id,
            assetPath: path.posix.join('evals/labels', testCase.assetPath),
            beverageType: testCase.beverageType,
            expectedRecommendation: testCase.expectedRecommendation,
            source: 'cola-cloud' as const
          })),
          ...supplementalManifest.cases.slice(0, 3).map((testCase) => ({
            id: testCase.id,
            assetPath: path.posix.join('evals/labels', testCase.assetPath),
            beverageType: testCase.beverageType,
            expectedRecommendation: testCase.expectedRecommendation,
            source: 'supplemental-generated' as const
          }))
        ]
      }
    ]
  };

  const manifestPath = path.join(outputDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[batch-fixtures] wrote ${manifestPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export const _unused_defaultNetContents = _defaultNetContents;
