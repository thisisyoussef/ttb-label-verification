/**
 * Fetch real TTB COLA labels from COLA Cloud API and integrate them
 * into the golden eval set.
 *
 * Usage:
 *   COLACLOUD_API_KEY=cola_xxx npx tsx scripts/fetch-cola-cloud-labels.ts
 *
 * What it does:
 *   1. Searches for a diverse set of COLAs across all three beverage types
 *   2. Fetches detail views (with images) for selected COLAs
 *   3. Downloads front label images to evals/labels/assets/cola-cloud/
 *   4. Generates evals/labels/cola-cloud.manifest.json
 *   5. Outputs golden manifest case entries to stdout for manual integration
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API_BASE = 'https://app.colacloud.us/api/v1';
const API_KEY = process.env.COLACLOUD_API_KEY ?? '';
const CASES_PER_TYPE = Number(process.env.COLA_CLOUD_CASES_PER_TYPE ?? '8');
const SEARCH_PER_PAGE = Number(
  process.env.COLA_CLOUD_PER_PAGE ?? String(Math.max(CASES_PER_TYPE * 3, 24))
);
const REQUEST_DELAY_MS = Number(process.env.COLA_CLOUD_DELAY_MS ?? '7000');

if (!API_KEY) {
  console.error('Missing COLACLOUD_API_KEY environment variable');
  process.exit(1);
}

type ColaSummary = {
  ttb_id: string;
  brand_name: string;
  product_name: string;
  product_type: 'wine' | 'malt beverage' | 'distilled spirits';
  class_name: string;
  origin_name: string;
  permit_number: string;
  approval_date: string | null;
  image_count: number;
  has_barcode: boolean;
};

type ColaImage = {
  ttb_image_id: string;
  image_index: number;
  container_position: string;
  extension_type: string;
  file_size_mb: number;
  height_pixels: number;
  width_pixels: number;
  image_url: string;
};

type ColaDetail = ColaSummary & {
  abv: number | null;
  class_id: string;
  origin_id: string;
  domestic_or_imported: string;
  grape_varietals: string[] | null;
  wine_vintage_year: number | null;
  wine_appellation: string | null;
  images: ColaImage[];
  barcodes: unknown[];
  llm_category: string | null;
  llm_category_path: string | null;
  address_recipient: string | null;
  address_state: string | null;
};

type SearchResponse = {
  data: ColaSummary[];
  pagination: { has_more: boolean; page: number; per_page: number };
};

type DetailResponse = {
  data: ColaDetail;
};

type GoldenCase = {
  id: string;
  slug: string;
  title: string;
  suiteIds: string[];
  mode: string;
  beverageType: string;
  requiresLiveAsset: boolean;
  requiresApplicationData: boolean;
  assetPath?: string;
  applicableTo?: string[];
  expectedPrimaryResult?: string;
  expectedSummary?: string | null;
  focus?: string[];
  notes?: string;
};

type GoldenManifest = {
  version: number;
  source: string;
  slices: Record<string, { description: string; caseIds: string[] }>;
  cases: GoldenCase[];
};

type LiveLabelCase = {
  id: string;
  goldenCaseId: string;
  title: string;
  assetPath: string;
  beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage';
  scenario: string;
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
    llmCategory?: string | null;
    llmCategoryPath?: string | null;
    hasBarcodes?: boolean;
    imageUrl?: string;
  };
};

type LiveLabelsManifest = {
  version: number;
  sourceManifest: string;
  sliceId: string;
  description: string;
  cases: LiveLabelCase[];
};

async function apiGet<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`COLA Cloud API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function searchColas(params: Record<string, string>): Promise<ColaSummary[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await apiGet<SearchResponse>(`/colas?${qs}`);
  return res.data;
}

async function getColaDetail(ttbId: string): Promise<ColaDetail> {
  const res = await apiGet<DetailResponse>(`/colas/${ttbId}`);
  return res.data;
}

async function downloadImage(imageUrl: string, destPath: string): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function mergeGoldenManifest(input: {
  repoRoot: string;
  sliceId: string;
  slice: { description: string; caseIds: string[] };
  cases: GoldenCase[];
}) {
  const goldenManifestPath = path.join(input.repoRoot, 'evals/golden/manifest.json');
  const golden = JSON.parse(
    await readFile(goldenManifestPath, 'utf8')
  ) as GoldenManifest;
  const caseIds = new Set(golden.cases.map((testCase) => testCase.id));

  golden.slices[input.sliceId] = input.slice;

  for (const testCase of input.cases) {
    if (caseIds.has(testCase.id)) {
      continue;
    }

    golden.cases.push(testCase);
    caseIds.add(testCase.id);
  }

  await writeFile(goldenManifestPath, JSON.stringify(golden, null, 2) + '\n');
}

function slugify(brand: string, product: string, type: string): string {
  const raw = `${brand}-${product}-${type}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
  return raw;
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

function selectDiverseColas(results: ColaSummary[], pick: number) {
  const withImages = results.filter((cola) => cola.image_count > 0);
  const selected: ColaSummary[] = [];
  const seenBrands = new Set<string>();

  for (const cola of withImages) {
    const normalizedBrand = cola.brand_name.trim().toLowerCase();
    if (seenBrands.has(normalizedBrand)) {
      continue;
    }

    selected.push(cola);
    seenBrands.add(normalizedBrand);
    if (selected.length === pick) {
      return selected;
    }
  }

  for (const cola of withImages) {
    if (selected.some((candidate) => candidate.ttb_id === cola.ttb_id)) {
      continue;
    }

    selected.push(cola);
    if (selected.length === pick) {
      break;
    }
  }

  return selected;
}

function mapBeverageType(apiType: string): 'distilled-spirits' | 'malt-beverage' | 'wine' {
  switch (apiType) {
    case 'distilled spirits':
      return 'distilled-spirits';
    case 'malt beverage':
      return 'malt-beverage';
    case 'wine':
      return 'wine';
    default:
      throw new Error(`Unsupported COLA Cloud product type: ${apiType}`);
  }
}

type FetchedLabel = {
  detail: ColaDetail;
  slug: string;
  frontImageUrl: string;
  localAssetFilename: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const repoRoot = process.cwd();
  const assetsDir = path.join(repoRoot, 'evals/labels/assets/cola-cloud');
  await mkdir(assetsDir, { recursive: true });
  const goldenManifestPath = path.join(repoRoot, 'evals/golden/manifest.json');
  const liveManifestPath = path.join(repoRoot, 'evals/labels/cola-cloud.manifest.json');
  const golden = JSON.parse(
    await readFile(goldenManifestPath, 'utf8')
  ) as GoldenManifest;
  const existingLiveManifest =
    (await readJsonIfExists<LiveLabelsManifest>(liveManifestPath)) ?? null;
  const existingLiveBySlug = new Map(
    (existingLiveManifest?.cases ?? []).map((testCase) => [testCase.id, testCase] as const)
  );
  const existingGoldenBySlug = new Map(
    golden.cases.map((testCase) => [testCase.slug, testCase] as const)
  );
  let nextId = nextGoldenCaseId(golden);

  console.log('[cola-cloud] Searching for diverse COLAs...\n');

  // Fetch a larger diverse set across all three beverage types.
  const queries: Array<{ params: Record<string, string>; pick: number }> = [
    {
      params: {
        product_type: 'distilled spirits',
        approval_date_from: '2015-01-01',
        per_page: String(SEARCH_PER_PAGE)
      },
      pick: CASES_PER_TYPE
    },
    {
      params: {
        product_type: 'wine',
        approval_date_from: '2015-01-01',
        per_page: String(SEARCH_PER_PAGE)
      },
      pick: CASES_PER_TYPE
    },
    {
      params: {
        product_type: 'malt beverage',
        approval_date_from: '2015-01-01',
        per_page: String(SEARCH_PER_PAGE)
      },
      pick: CASES_PER_TYPE
    }
  ];

  const selectedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const { params, pick } of queries) {
    const results = await searchColas(params);
    const picked = selectDiverseColas(results, pick);
    for (const cola of picked) {
      if (seenIds.has(cola.ttb_id)) {
        continue;
      }

      selectedIds.push(cola.ttb_id);
      seenIds.add(cola.ttb_id);
    }
    console.log(
      `[cola-cloud] ${params.product_type}: found ${results.length}, picked ${picked.length} diverse labels with images`
    );
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n[cola-cloud] Fetching detail views for ${selectedIds.length} COLAs...\n`);

  const fetched: FetchedLabel[] = [];

  for (let idx = 0; idx < selectedIds.length; idx++) {
    const ttbId = selectedIds[idx];
    if (idx > 0) await sleep(REQUEST_DELAY_MS);
    const detail = await getColaDetail(ttbId);
    const frontImage =
      detail.images.find(
        (img) => img.container_position.toLowerCase() === 'front'
      ) ?? detail.images[0];

    if (!frontImage) {
      console.warn(`[cola-cloud] SKIP ${ttbId} — no images`);
      continue;
    }

    const slug = slugify(detail.brand_name, detail.product_name, detail.product_type);
    const ext = frontImage.image_url.endsWith('.webp') ? 'webp' : 'png';
    const localFilename = `${slug}.${ext}`;

    fetched.push({
      detail,
      slug,
      frontImageUrl: frontImage.image_url,
      localAssetFilename: localFilename,
    });

    console.log(
      `  ${detail.ttb_id} | ${detail.brand_name} — ${detail.product_name} (${detail.product_type}) → ${localFilename}`
    );
  }

  console.log(`\n[cola-cloud] Downloading ${fetched.length} label images...\n`);

  for (const label of fetched) {
    const destPath = path.join(assetsDir, label.localAssetFilename);
    await downloadImage(label.frontImageUrl, destPath);
    console.log(`  ✓ ${label.localAssetFilename}`);
  }

  const combinedCases = new Map<string, LiveLabelCase>();

  for (const existingCase of existingLiveManifest?.cases ?? []) {
    combinedCases.set(existingCase.id, existingCase);
  }

  for (const label of fetched) {
    const existingLiveCase = existingLiveBySlug.get(label.slug);
    const existingGoldenCase = existingGoldenBySlug.get(label.slug);
    const goldenCaseId =
      existingLiveCase?.goldenCaseId ??
      existingGoldenCase?.id ??
      `G-${String(nextId++).padStart(2, '0')}`;

    combinedCases.set(label.slug, {
      id: label.slug,
      goldenCaseId,
      title: `${label.detail.brand_name} — ${label.detail.product_name}`,
      assetPath: `assets/cola-cloud/${label.localAssetFilename}`,
      beverageType: mapBeverageType(label.detail.product_type),
      scenario: `Real TTB-approved ${label.detail.product_type} label (${label.detail.class_name}, ${label.detail.origin_name})`,
      expectedRecommendation: 'approve',
      colaCloudMeta: {
        ttbId: label.detail.ttb_id,
        abv: label.detail.abv,
        className: label.detail.class_name,
        originName: label.detail.origin_name,
        domesticOrImported: label.detail.domestic_or_imported,
        approvalDate: label.detail.approval_date,
        brandName: label.detail.brand_name,
        productName: label.detail.product_name,
        grapeVarietals: label.detail.grape_varietals,
        wineAppellation: label.detail.wine_appellation,
        wineVintageYear: label.detail.wine_vintage_year,
        llmCategory: label.detail.llm_category,
        llmCategoryPath: label.detail.llm_category_path,
        hasBarcodes: label.detail.barcodes.length > 0,
        imageUrl: label.frontImageUrl
      }
    });
  }

  const orderedLiveCases = Array.from(combinedCases.values()).sort((left, right) =>
    left.goldenCaseId.localeCompare(right.goldenCaseId, undefined, { numeric: true })
  );

  const liveManifest: LiveLabelsManifest = {
    version: 3,
    sourceManifest: '../golden/manifest.json',
    sliceId: 'cola-cloud-real',
    description:
      'Real TTB-approved label images fetched from COLA Cloud API. Covers distilled spirits, wine, and malt beverages with genuine product metadata.',
    cases: orderedLiveCases
  };

  await writeFile(liveManifestPath, JSON.stringify(liveManifest, null, 2) + '\n');
  console.log(`\n[cola-cloud] Wrote ${liveManifestPath}`);

  const goldenCases = orderedLiveCases.map((label) => ({
    id: label.goldenCaseId,
    slug: label.id,
    title: label.title,
    suiteIds: ['cola-cloud-real'],
    mode: 'comparison',
    beverageType: label.beverageType,
    requiresLiveAsset: true,
    requiresApplicationData: false,
    assetPath: `../labels/${label.assetPath}`,
    applicableTo: ['live-extraction', 'qa', 'cola-cloud-regression'],
    expectedPrimaryResult: 'approve',
    expectedSummary: null,
    focus: ['real-label-extraction'],
    notes: `Real TTB COLA ${label.colaCloudMeta.ttbId} — ${label.colaCloudMeta.className} from ${label.colaCloudMeta.originName}. Approved ${label.colaCloudMeta.approvalDate}.`,
  }));

  const goldenSlice = {
    description:
      'Real TTB-approved labels from COLA Cloud API covering spirits, wine, and malt beverages.',
    caseIds: goldenCases.map((c) => c.id),
  };
  await mergeGoldenManifest({
    repoRoot,
    sliceId: 'cola-cloud-real',
    slice: goldenSlice,
    cases: goldenCases,
  });
  console.log('[cola-cloud] Merged slice into evals/golden/manifest.json');
  const goldenAdditionsPath = path.join(
    repoRoot,
    'evals/golden/cola-cloud-additions.json'
  );
  await writeFile(
    goldenAdditionsPath,
    JSON.stringify({ slice: { 'cola-cloud-real': goldenSlice }, cases: goldenCases }, null, 2) +
      '\n'
  );
  console.log(`[cola-cloud] Wrote golden additions → ${goldenAdditionsPath}`);
  console.log(
    `\n[cola-cloud] Done! fetched ${fetched.length} labels this run, corpus now has ${orderedLiveCases.length} real COLA labels.`
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
