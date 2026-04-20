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

import {
  buildSelectedImageFilename,
  downloadImage,
  getColaDetail,
  mapBeverageType,
  mergeGoldenManifest,
  nextGoldenCaseId,
  readJsonIfExists,
  searchColas,
  selectDiverseColas,
  selectPreferredImages,
  slugify,
  sleep,
  type FetchedLabel,
  type GoldenManifest,
  type LiveLabelCase,
  type LiveLabelsManifest,
} from './cola-cloud-fetch-lib';

const API_BASE = 'https://app.colacloud.us/api/v1';
const API_KEY = process.env.COLACLOUD_API_KEY ?? '';
const CASES_PER_TYPE = Number(process.env.COLA_CLOUD_CASES_PER_TYPE ?? '8');
const SEARCH_PER_PAGE = Number(
  process.env.COLA_CLOUD_PER_PAGE ?? String(Math.max(CASES_PER_TYPE * 3, 24))
);
const REQUEST_DELAY_MS = Number(process.env.COLA_CLOUD_DELAY_MS ?? '7000');
const REFRESH_EXISTING_ONLY =
  process.env.COLA_CLOUD_REFRESH_EXISTING_ONLY === 'true';

if (!API_KEY) {
  console.error('Missing COLACLOUD_API_KEY environment variable');
  process.exit(1);
}

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

  const selectedIds: string[] = [];
  const seenIds = new Set<string>();

  if (REFRESH_EXISTING_ONLY && existingLiveManifest?.cases.length) {
    console.log('[cola-cloud] Refreshing existing stored COLA IDs only...\n');
    for (const existingCase of existingLiveManifest.cases) {
      const ttbId = existingCase.colaCloudMeta.ttbId;
      if (seenIds.has(ttbId)) {
        continue;
      }
      selectedIds.push(ttbId);
      seenIds.add(ttbId);
    }
  } else {
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

    for (const { params, pick } of queries) {
      const results = await searchColas({
        apiBase: API_BASE,
        apiKey: API_KEY,
        params,
      });
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
  }

  console.log(`\n[cola-cloud] Fetching detail views for ${selectedIds.length} COLAs...\n`);

  const fetched: FetchedLabel[] = [];

  for (let idx = 0; idx < selectedIds.length; idx++) {
    const ttbId = selectedIds[idx];
    if (idx > 0) await sleep(REQUEST_DELAY_MS);
    const detail = await getColaDetail({
      apiBase: API_BASE,
      apiKey: API_KEY,
      ttbId,
    });
    const selectedImages = selectPreferredImages(detail.images);

    if (selectedImages.length === 0) {
      console.warn(`[cola-cloud] SKIP ${ttbId} — no images`);
      continue;
    }

    const slug = slugify(detail.brand_name, detail.product_name, detail.product_type);
    const seenNames = new Set<string>();

    fetched.push({
      detail,
      slug,
      selectedImages: selectedImages.map((image, index) => ({
        imageUrl: image.image_url,
        localAssetFilename: buildSelectedImageFilename(slug, image, index, seenNames)
      }))
    });

    console.log(
      `  ${detail.ttb_id} | ${detail.brand_name} — ${detail.product_name} (${detail.product_type}) → ${fetched[fetched.length - 1]!.selectedImages
        .map((image) => image.localAssetFilename)
        .join(', ')}`
    );
  }

  const totalImages = fetched.reduce(
    (sum, label) => sum + label.selectedImages.length,
    0
  );
  console.log(`\n[cola-cloud] Downloading ${totalImages} label images...\n`);

  for (const label of fetched) {
    for (const image of label.selectedImages) {
      const destPath = path.join(assetsDir, image.localAssetFilename);
      await downloadImage(image.imageUrl, destPath);
      console.log(`  ✓ ${image.localAssetFilename}`);
    }
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
      assetPath: `assets/cola-cloud/${label.selectedImages[0]!.localAssetFilename}`,
      secondaryAssetPath:
        label.selectedImages[1]
          ? `assets/cola-cloud/${label.selectedImages[1].localAssetFilename}`
          : null,
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
        imageUrl: label.selectedImages[0]!.imageUrl,
        secondaryImageUrl: label.selectedImages[1]?.imageUrl ?? null
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
    `\n[cola-cloud] Done! fetched ${fetched.length} labels and ${totalImages} images this run, corpus now has ${orderedLiveCases.length} real COLA labels.`
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
