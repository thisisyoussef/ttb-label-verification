import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  defaultNetContents,
  formatAlcoholContent
} from './eval-corpus-types';
import type {
  ColaCloudCase,
  ColaCloudManifest,
  GoldenCase,
  GoldenManifest,
  SupplementalNegativeCase,
  SupplementalNegativeManifest
} from './eval-corpus-types';

const execFileAsync = promisify(execFile);
type NegativeTemplate = {
  id: string;
  sourceCaseId: string;
  titleSuffix: string;
  expectedRecommendation: 'review' | 'reject';
  mutation: SupplementalNegativeCase['mutation'];
  render: (input: {
    width: number;
    height: number;
    source: ColaCloudCase;
  }) => string[];
  batchCsv: (source: ColaCloudCase) => SupplementalNegativeCase['batchCsv'];
};
async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}
function nextGoldenCaseId(golden: GoldenManifest) {
  const currentMax = golden.cases.reduce((max, testCase) => {
    const match = /^G-(\d+)$/.exec(testCase.id);
    if (!match) {
      return max;
    }
    return Math.max(max, Number(match[1]));
  }, 0);
  return currentMax + 1;
}
function defaultOrigin(source: ColaCloudCase) {
  return source.colaCloudMeta.domesticOrImported === 'imported' ? 'imported' : 'domestic';
}
function defaultCountry(source: ColaCloudCase) {
  return source.colaCloudMeta.domesticOrImported === 'imported'
    ? source.colaCloudMeta.originName ?? ''
    : '';
}
async function identifyImageSize(sourcePath: string) {
  const { stdout } = await execFileAsync('magick', [
    'identify',
    '-format',
    '%w %h',
    sourcePath
  ]);
  const [width, height] = stdout
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));
  if (!width || !height) {
    throw new Error(`Could not identify image size for ${sourcePath}`);
  }
  return { width, height };
}
async function renderVariant(input: {
  sourcePath: string;
  outputPath: string;
  args: string[];
}) {
  await execFileAsync('magick', [input.sourcePath, ...input.args, input.outputPath]);
}
async function main() {
  const repoRoot = process.cwd();
  const goldenManifestPath = path.join(repoRoot, 'evals/golden/manifest.json');
  const colaManifestPath = path.join(repoRoot, 'evals/labels/cola-cloud.manifest.json');
  const outputDir = path.join(repoRoot, 'evals/labels/assets/supplemental-generated');
  const manifestPath = path.join(repoRoot, 'evals/labels/supplemental-negative.manifest.json');
  await mkdir(outputDir, { recursive: true });
  const golden = await readJson<GoldenManifest>(goldenManifestPath);
  const colaManifest = await readJson<ColaCloudManifest>(colaManifestPath);
  const existingManifest =
    (await (async () => {
      try {
        return await readJson<SupplementalNegativeManifest>(manifestPath);
      } catch {
        return null;
      }
    })()) ?? null;
  const colaById = new Map(colaManifest.cases.map((testCase) => [testCase.id, testCase] as const));
  const existingById = new Map(
    (existingManifest?.cases ?? []).map((testCase) => [testCase.id, testCase] as const)
  );
  const existingGoldenBySlug = new Map(golden.cases.map((testCase) => [testCase.slug, testCase] as const));
  let nextId = nextGoldenCaseId(golden);
  const templates: NegativeTemplate[] = [
    {
      id: 'lake-placid-shredder-abv-negative',
      sourceCaseId: 'lake-placid-shredder-malt-beverage',
      titleSuffix: 'ABV Overlay',
      expectedRecommendation: 'reject',
      mutation: {
        kind: 'abv-overlay',
        note: 'Injects a false 5% ABV overlay into a real approved label.'
      },
      render: ({ height }) => [
        '-gravity',
        'south',
        '-fill',
        '#111111',
        '-undercolor',
        '#f8f5f0dd',
        '-pointsize',
        '48',
        '-annotate',
        `+0+${Math.max(36, Math.round(height * 0.06))}`,
        '5% ABV'
      ],
      batchCsv: (source) => ({
        brandName: source.colaCloudMeta.brandName,
        fancifulName: source.colaCloudMeta.productName ?? '',
        classType: 'IPA',
        alcoholContent: '5% Alc./Vol.',
        netContents: defaultNetContents(source.beverageType),
        origin: defaultOrigin(source),
        country: defaultCountry(source),
        formulaId: '',
        appellation: '',
        vintage: ''
      })
    },
    {
      id: 'simply-elegant-warning-occluded-negative',
      sourceCaseId: 'simply-elegant-simply-elegant-spirits-distilled-spirits',
      titleSuffix: 'Warning Occluded',
      expectedRecommendation: 'reject',
      mutation: {
        kind: 'warning-occlusion',
        note: 'Covers the lower warning region with a light sticker block.'
      },
      render: ({ width, height }) => [
        '-fill',
        '#f4f1ea',
        '-draw',
        `roundrectangle ${Math.round(width * 0.08)},${Math.round(height * 0.73)} ${Math.round(
          width * 0.92
        )},${Math.round(height * 0.91)} 18,18`,
        '-stroke',
        '#8f8a82',
        '-strokewidth',
        '2',
        '-draw',
        `roundrectangle ${Math.round(width * 0.08)},${Math.round(height * 0.73)} ${Math.round(
          width * 0.92
        )},${Math.round(height * 0.91)} 18,18`
      ],
      batchCsv: (source) => ({
        brandName: source.colaCloudMeta.brandName,
        fancifulName: source.colaCloudMeta.productName ?? '',
        classType: source.colaCloudMeta.className,
        alcoholContent: formatAlcoholContent(source.colaCloudMeta.abv),
        netContents: defaultNetContents(source.beverageType),
        origin: defaultOrigin(source),
        country: defaultCountry(source),
        formulaId: '',
        appellation: '',
        vintage: ''
      })
    },
    {
      id: 'leitz-rottland-warning-crop-negative',
      sourceCaseId: 'leitz-rottland-wine',
      titleSuffix: 'Warning Crop',
      expectedRecommendation: 'reject',
      mutation: {
        kind: 'warning-crop',
        note: 'Trims the lower section and pads with blank space to remove label evidence.'
      },
      render: ({ width, height }) => [
        '-gravity',
        'north',
        '-crop',
        `${width}x${Math.round(height * 0.82)}+0+0`,
        '+repage',
        '-background',
        'white',
        '-gravity',
        'south',
        '-extent',
        `${width}x${height}`
      ],
      batchCsv: (source) => ({
        brandName: source.colaCloudMeta.brandName,
        fancifulName: source.colaCloudMeta.productName ?? '',
        classType: source.colaCloudMeta.className,
        alcoholContent: formatAlcoholContent(source.colaCloudMeta.abv),
        netContents: defaultNetContents(source.beverageType),
        origin: defaultOrigin(source),
        country: defaultCountry(source),
        formulaId: '',
        appellation: source.colaCloudMeta.wineAppellation ?? '',
        vintage:
          source.colaCloudMeta.wineVintageYear === null
            ? ''
            : String(source.colaCloudMeta.wineVintageYear)
      })
    },
    {
      id: 'lake-placid-ridge-runner-warning-occluded-negative',
      sourceCaseId: 'lake-placid-ridge-runner-malt-beverage',
      titleSuffix: 'Warning Occluded',
      expectedRecommendation: 'reject',
      mutation: {
        kind: 'warning-occlusion',
        note: 'Blocks the lower third of the label with an opaque shape.'
      },
      render: ({ width, height }) => [
        '-fill',
        '#fffaf0',
        '-draw',
        `rectangle 0,${Math.round(height * 0.7)} ${width},${height}`,
        '-stroke',
        'none'
      ],
      batchCsv: (source) => ({
        brandName: source.colaCloudMeta.brandName,
        fancifulName: source.colaCloudMeta.productName ?? '',
        classType: source.colaCloudMeta.className,
        alcoholContent: '',
        netContents: defaultNetContents(source.beverageType),
        origin: defaultOrigin(source),
        country: defaultCountry(source),
        formulaId: '',
        appellation: '',
        vintage: ''
      })
    },
    {
      id: 'persian-empire-black-widow-blur-review',
      sourceCaseId: 'persian-empire-black-widow-distilled-spirits',
      titleSuffix: 'Global Blur',
      expectedRecommendation: 'review',
      mutation: {
        kind: 'global-blur',
        note: 'Applies heavy global blur to simulate unreadable label capture.'
      },
      render: () => ['-blur', '0x7'],
      batchCsv: (source) => ({
        brandName: source.colaCloudMeta.brandName,
        fancifulName: source.colaCloudMeta.productName ?? '',
        classType: source.colaCloudMeta.className,
        alcoholContent: formatAlcoholContent(source.colaCloudMeta.abv),
        netContents: defaultNetContents(source.beverageType),
        origin: defaultOrigin(source),
        country: defaultCountry(source),
        formulaId: '',
        appellation: '',
        vintage: ''
      })
    },
    {
      id: 'uncorked-in-mayberry-low-contrast-review',
      sourceCaseId: 'uncorked-in-mayberry-otis-own-wine',
      titleSuffix: 'Low Contrast',
      expectedRecommendation: 'review',
      mutation: {
        kind: 'low-contrast',
        note: 'Reduces saturation and contrast to create a borderline legibility case.'
      },
      render: () => ['-modulate', '100,45,100', '-brightness-contrast', '-10x-25'],
      batchCsv: (source) => ({
        brandName: source.colaCloudMeta.brandName,
        fancifulName: source.colaCloudMeta.productName ?? '',
        classType: source.colaCloudMeta.className,
        alcoholContent: formatAlcoholContent(source.colaCloudMeta.abv),
        netContents: defaultNetContents(source.beverageType),
        origin: defaultOrigin(source),
        country: defaultCountry(source),
        formulaId: '',
        appellation: source.colaCloudMeta.wineAppellation ?? '',
        vintage:
          source.colaCloudMeta.wineVintageYear === null
            ? ''
            : String(source.colaCloudMeta.wineVintageYear)
      })
    },
    {
      id: 'recluse-brew-works-shy-guy-overprint-negative',
      sourceCaseId: 'recluse-brew-works-shy-guy-malt-beverage',
      titleSuffix: 'Overprint Sticker',
      expectedRecommendation: 'reject',
      mutation: {
        kind: 'label-overprint',
        note: 'Adds a synthetic sticker over label text to mimic an illegitimate post-approval edit.'
      },
      render: ({ width, height }) => [
        '-fill',
        '#f8e6b8',
        '-stroke',
        '#5a4d2c',
        '-strokewidth',
        '2',
        '-draw',
        `roundrectangle ${Math.round(width * 0.16)},${Math.round(height * 0.18)} ${Math.round(
          width * 0.86
        )},${Math.round(height * 0.36)} 14,14`,
        '-fill',
        '#3d2f16',
        '-gravity',
        'north',
        '-pointsize',
        '34',
        '-annotate',
        `+0+${Math.round(height * 0.23)}`,
        'SPECIAL RELEASE'
      ],
      batchCsv: (source) => ({
        brandName: source.colaCloudMeta.brandName,
        fancifulName: source.colaCloudMeta.productName ?? '',
        classType: source.colaCloudMeta.className,
        alcoholContent: formatAlcoholContent(source.colaCloudMeta.abv),
        netContents: defaultNetContents(source.beverageType),
        origin: defaultOrigin(source),
        country: defaultCountry(source),
        formulaId: '',
        appellation: '',
        vintage: ''
      })
    }
  ];
  const cases: SupplementalNegativeCase[] = [];
  for (const template of templates) {
    const source = colaById.get(template.sourceCaseId);
    if (!source) {
      throw new Error(`Missing source case '${template.sourceCaseId}' for '${template.id}'`);
    }
    const sourcePath = path.join(repoRoot, 'evals/labels', source.assetPath);
    const outputPath = path.join(outputDir, `${template.id}.webp`);
    const { width, height } = await identifyImageSize(sourcePath);
    const args = template.render({ width, height, source });
    await renderVariant({ sourcePath, outputPath, args });
    const existingCase = existingById.get(template.id);
    const existingGoldenCase = existingGoldenBySlug.get(template.id);
    const goldenCaseId =
      existingCase?.goldenCaseId ??
      existingGoldenCase?.id ??
      `G-${String(nextId++).padStart(2, '0')}`;
    cases.push({
      id: template.id,
      goldenCaseId,
      title: `${source.title} — ${template.titleSuffix}`,
      assetPath: `assets/supplemental-generated/${template.id}.webp`,
      beverageType: source.beverageType,
      scenario: `${template.mutation.note} Source: ${source.title}.`,
      expectedRecommendation: template.expectedRecommendation,
      sourceCaseId: source.id,
      mutation: template.mutation,
      batchCsv: template.batchCsv(source)
    });
  }
  cases.sort((left, right) =>
    left.goldenCaseId.localeCompare(right.goldenCaseId, undefined, { numeric: true })
  );
  const manifest: SupplementalNegativeManifest = {
    version: 1,
    sourceManifest: '../golden/manifest.json',
    sliceId: 'supplemental-negative',
    description:
      'Deterministic negative and low-confidence fixtures derived from real COLA Cloud labels.',
    cases
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const slice = {
    description:
      'Deterministic negative and low-confidence fixtures derived from real COLA Cloud labels.',
    caseIds: cases.map((testCase) => testCase.goldenCaseId)
  };
  const goldenCases: GoldenCase[] = cases.map((testCase) => ({
    id: testCase.goldenCaseId,
    slug: testCase.id,
    title: testCase.title,
    suiteIds: ['supplemental-negative'],
    mode: 'comparison',
    beverageType: testCase.beverageType,
    requiresLiveAsset: true,
    requiresApplicationData: false,
    assetPath: `../labels/${testCase.assetPath}`,
    applicableTo: ['live-extraction', 'qa', 'cola-cloud-regression', 'negative-regression'],
    expectedPrimaryResult: testCase.expectedRecommendation,
    expectedSummary: null,
    focus: ['real-label-negative', testCase.mutation.kind],
    notes: `Derived from ${testCase.sourceCaseId}. ${testCase.mutation.note}`
  }));
  golden.slices['supplemental-negative'] = slice;
  const seenGoldenIds = new Set(golden.cases.map((testCase) => testCase.id));
  for (const goldenCase of goldenCases) {
    if (seenGoldenIds.has(goldenCase.id)) {
      continue;
    }
    golden.cases.push(goldenCase);
    seenGoldenIds.add(goldenCase.id);
  }
  await writeFile(goldenManifestPath, JSON.stringify(golden, null, 2) + '\n');
  console.log(`[supplemental-negative] wrote ${manifestPath}`);
  console.log(
    `[supplemental-negative] generated ${cases.length} derived fixtures in ${outputDir}`
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
