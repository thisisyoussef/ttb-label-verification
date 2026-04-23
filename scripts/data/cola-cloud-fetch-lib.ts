import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isBlockedColaCloudTtbId } from '../../src/shared/cola-cloud-exclusions';

export type ColaSummary = {
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

export type ColaImage = {
  ttb_image_id: string;
  image_index: number;
  container_position: string;
  extension_type: string;
  file_size_mb: number;
  height_pixels: number;
  width_pixels: number;
  image_url: string;
};

export type ColaDetail = ColaSummary & {
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

export type GoldenCase = {
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

export type GoldenManifest = {
  version: number;
  source: string;
  slices: Record<string, { description: string; caseIds: string[] }>;
  cases: GoldenCase[];
};

export type LiveLabelCase = {
  id: string;
  goldenCaseId: string;
  title: string;
  assetPath: string;
  secondaryAssetPath?: string | null;
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
    secondaryImageUrl?: string | null;
  };
};

export type LiveLabelsManifest = {
  version: number;
  sourceManifest: string;
  sliceId: string;
  description: string;
  cases: LiveLabelCase[];
};

export type FetchedLabel = {
  detail: ColaDetail;
  slug: string;
  selectedImages: Array<{
    imageUrl: string;
    localAssetFilename: string;
  }>;
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function resolveRetryAfterSeconds(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      error?: { details?: { retry_after?: number } };
    };
    return Math.max(1, parsed.error?.details?.retry_after ?? 60);
  } catch {
    return 60;
  }
}

export async function apiGet<T>(options: {
  apiBase: string;
  apiKey: string;
  endpoint: string;
}): Promise<T> {
  const url = `${options.apiBase}${options.endpoint}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      headers: { 'X-API-Key': options.apiKey },
    });
    if (res.ok) {
      return res.json() as Promise<T>;
    }

    const body = await res.text();
    if (res.status === 429 && attempt < 3) {
      const retryAfterSeconds = resolveRetryAfterSeconds(body);
      console.warn(
        `[cola-cloud] rate limited on ${options.endpoint}; waiting ${retryAfterSeconds}s before retry ${attempt + 2}/4`
      );
      await sleep(retryAfterSeconds * 1000);
      continue;
    }

    throw new Error(`COLA Cloud API ${res.status}: ${body}`);
  }

  throw new Error(`COLA Cloud API retry budget exhausted for ${options.endpoint}`);
}

export async function searchColas(options: {
  apiBase: string;
  apiKey: string;
  params: Record<string, string>;
}) {
  const qs = new URLSearchParams(options.params).toString();
  const res = await apiGet<SearchResponse>({
    apiBase: options.apiBase,
    apiKey: options.apiKey,
    endpoint: `/colas?${qs}`,
  });
  return res.data;
}

export async function getColaDetail(options: {
  apiBase: string;
  apiKey: string;
  ttbId: string;
}) {
  const res = await apiGet<DetailResponse>({
    apiBase: options.apiBase,
    apiKey: options.apiKey,
    endpoint: `/colas/${options.ttbId}`,
  });
  return res.data;
}

export async function downloadImage(imageUrl: string, destPath: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}

export async function readJsonIfExists<T>(filePath: string) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function mergeGoldenManifest(input: {
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

export function slugify(brand: string, product: string, type: string) {
  return `${brand}-${product}-${type}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export function nextGoldenCaseId(golden: GoldenManifest) {
  const currentMax = golden.cases.reduce((max, testCase) => {
    const match = /^G-(\d+)$/.exec(testCase.id);
    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);

  return currentMax + 1;
}

export function selectDiverseColas(results: ColaSummary[], pick: number) {
  const withImages = results.filter(
    (cola) => cola.image_count > 0 && !isBlockedColaCloudTtbId(cola.ttb_id)
  );
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

export function mapBeverageType(
  apiType: string
): 'distilled-spirits' | 'malt-beverage' | 'wine' {
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

function colaCloudImagePriority(image: ColaImage) {
  const position = image.container_position?.trim().toLowerCase();
  if (position === 'front') {
    return 0;
  }
  if (position === 'back') {
    return 1;
  }
  return 2;
}

export function selectPreferredImages(images: ColaImage[]) {
  const ordered = [...images].sort((left, right) => {
    const priorityDiff = colaCloudImagePriority(left) - colaCloudImagePriority(right);
    return priorityDiff !== 0
      ? priorityDiff
      : left.image_index - right.image_index;
  });

  const seen = new Set<string>();
  return ordered
    .filter((image) => {
      if (seen.has(image.ttb_image_id)) {
        return false;
      }
      seen.add(image.ttb_image_id);
      return true;
    })
    .slice(0, 2);
}

function extensionForImage(image: ColaImage) {
  const urlMatch = image.image_url.match(/\.(webp|png|jpe?g)(?:$|[?#])/i);
  if (urlMatch?.[1]) {
    const ext = urlMatch[1].toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  const fallback = image.extension_type?.trim().toLowerCase() || 'jpg';
  return fallback === 'jpeg' ? 'jpg' : fallback;
}

function sanitizeImagePosition(position: string | null | undefined, index: number) {
  const normalized =
    position?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';

  if (!normalized) {
    return index === 1 ? 'back' : `image-${index + 1}`;
  }

  if (index === 0) {
    return normalized;
  }

  return normalized === 'front' ? 'secondary' : normalized;
}

export function buildSelectedImageFilename(
  slug: string,
  image: ColaImage,
  index: number,
  seenNames: Set<string>
) {
  const ext = extensionForImage(image);
  const suffix = index === 0 ? '' : `-${sanitizeImagePosition(image.container_position, index)}`;
  let candidate = `${slug}${suffix}.${ext}`;
  let collisionIndex = 2;

  while (seenNames.has(candidate)) {
    candidate = `${slug}${suffix}-${collisionIndex}.${ext}`;
    collisionIndex += 1;
  }

  seenNames.add(candidate);
  return candidate;
}
