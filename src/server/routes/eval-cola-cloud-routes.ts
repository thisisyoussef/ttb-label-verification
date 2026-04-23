import express from 'express';

import { isBlockedColaCloudTtbId } from '../../shared/cola-cloud-exclusions';

const COLA_CLOUD_API_BASE = 'https://app.colacloud.us/api/v1';
// 2 min (was 10 min) so the "Fetch live" button keeps rotating through
// the COLA corpus instead of recycling the same 30 IDs for ten minutes.
const COLA_CLOUD_CACHE_TTL_MS = 2 * 60 * 1000;
const COLA_CLOUD_PER_PAGE = 100;
// Rolling window of recently-shown TTB IDs. Keeps variety high across
// clicks without forcing a summary-cache refresh each time.
const COLA_CLOUD_RECENT_WINDOW = 40;
// Randomizing the search on each cache refresh widens the pool we sample
// from across spirits/wine/malt and different approval-year slices.
const COLA_CLOUD_PRODUCT_TYPES = ['distilled spirits', 'wine', 'malt beverage', ''];
const COLA_CLOUD_APPROVAL_WINDOWS = ['2014-01-01', '2018-01-01', '2021-01-01', '2023-01-01'];
const COLA_CLOUD_MAX_PAGE = 5;
// Most calls prefer 2+ images (front+back reviewer workflow), but ~1 in
// 4 should actively surface single-image records (wraparound cans,
// cylindrical bottles) so they stay represented in the sample rotation.
const COLA_CLOUD_SINGLE_IMAGE_CHANCE = 0.25;

let colaCloudCache: {
  fetchedAt: number;
  summaries: ColaCloudSummary[];
} | null = null;

const recentlyShownTtbIds: string[] = [];

type ColaCloudSummary = {
  ttb_id: string;
  brand_name: string;
  product_name: string;
  product_type: string;
  class_name: string;
  origin_name: string;
  image_count: number;
};

type ColaCloudImage = {
  ttb_image_id: string;
  image_index: number;
  container_position: string;
  extension_type: string;
  image_url: string;
};

type ColaCloudDetail = ColaCloudSummary & {
  abv: number | null;
  domestic_or_imported: string | null;
  grape_varietals: string[] | null;
  wine_vintage_year: number | null;
  wine_appellation: string | null;
  address_recipient: string | null;
  address_state: string | null;
  images: ColaCloudImage[];
};

export function registerColaCloudRoutes(app: express.Express) {
  app.get('/api/eval/cola-cloud/status', (_request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.json({ available: Boolean(process.env.COLACLOUD_API_KEY?.trim()) });
  });

  app.get('/api/eval/cola-cloud/fresh', async (_request, response) => {
    const apiKey = process.env.COLACLOUD_API_KEY?.trim();
    if (!apiKey) {
      response
        .status(503)
        .json({ kind: 'validation', message: 'Live COLA Cloud key not configured.' });
      return;
    }

    try {
      const detail = await fetchFreshColaCloudDetail(apiKey);
      if (!detail) {
        response.status(502).json({
          kind: 'validation',
          message: 'No COLA records with images available right now.'
        });
        return;
      }

      const fields = mapColaCloudToFields(detail);
      const images = selectPreferredColaCloudImages(detail.images).map((image, index) =>
        buildColaCloudImagePayload(detail, image, index)
      );
      response.setHeader('cache-control', 'no-store');
      response.json({
        image: images[0]!,
        images,
        fields,
        meta: {
          ttbId: detail.ttb_id,
          approvedBrand: detail.brand_name,
          productName: detail.product_name,
          imageCount: detail.images.length,
          selectedImageCount: images.length
        }
      });
    } catch (error) {
      response.status(502).json({
        kind: 'validation',
        message: (error as Error).message.slice(0, 200)
      });
    }
  });

  app.get('/api/eval/cola-cloud/proxy-image', async (request, response) => {
    const apiKey = process.env.COLACLOUD_API_KEY?.trim();
    const upstream = typeof request.query.url === 'string' ? request.query.url : '';
    if (!apiKey) {
      response.status(503).end();
      return;
    }
    if (!upstream || !upstream.startsWith('https://')) {
      response.status(400).end();
      return;
    }

    try {
      const upstreamRes = await fetch(upstream, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!upstreamRes.ok || !upstreamRes.body) {
        response.status(upstreamRes.status).end();
        return;
      }
      const upstreamContentType = upstreamRes.headers.get('content-type') ?? '';
      const urlExtMatch = upstream.match(/\.(webp|jpe?g|png|pdf)(?:$|[?#])/i);
      const sniffedContentType = urlExtMatch
        ? mimeForFilename(`x.${urlExtMatch[1]!.toLowerCase()}`)
        : null;
      const contentType =
        upstreamContentType.startsWith('image/') || upstreamContentType === 'application/pdf'
          ? upstreamContentType
          : sniffedContentType ?? 'image/jpeg';
      response.setHeader('content-type', contentType);
      response.setHeader('cache-control', 'private, max-age=300');
      const reader = upstreamRes.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        response.write(Buffer.from(value));
      }
      response.end();
    } catch {
      response.status(502).end();
    }
  });
}

async function fetchFreshColaCloudDetail(apiKey: string) {
  const cacheValid =
    colaCloudCache !== null &&
    Date.now() - colaCloudCache.fetchedAt < COLA_CLOUD_CACHE_TTL_MS &&
    colaCloudCache.summaries.length > 0;

  if (!cacheValid) {
    type SearchResponse = { data: ColaCloudSummary[] };
    const productType = randomPick(COLA_CLOUD_PRODUCT_TYPES);
    const approvalDateFrom = randomPick(COLA_CLOUD_APPROVAL_WINDOWS);
    const page = 1 + Math.floor(Math.random() * COLA_CLOUD_MAX_PAGE);
    const params = new URLSearchParams({
      per_page: String(COLA_CLOUD_PER_PAGE),
      page: String(page),
      approval_date_from: approvalDateFrom
    });
    if (productType) {
      params.set('product_type', productType);
    }
    let search = await fetchColaCloudJson<SearchResponse>(
      `/colas?${params.toString()}`,
      apiKey
    );
    // Randomized page can land past the end of a narrow slice; fall back
    // to page 1 of the same query so we never cache an empty summary list.
    if (!search.data.length && page > 1) {
      params.set('page', '1');
      search = await fetchColaCloudJson<SearchResponse>(
        `/colas?${params.toString()}`,
        apiKey
      );
    }
    colaCloudCache = {
      fetchedAt: Date.now(),
      summaries: search.data
    };
  }

  const summaries = colaCloudCache?.summaries ?? [];
  const allowedSummaries = summaries.filter(
    (summary) => !isBlockedColaCloudTtbId(summary.ttb_id)
  );

  if (allowedSummaries.length === 0) {
    return null;
  }

  // Most calls prefer 2+ images; a minority actively surface 1-image
  // records so wraparound/can labels show up in rotation. The
  // single-image path biases the pool to image_count === 1 first — a
  // uniform random pick from a 2+-dominant corpus would rarely surface
  // them otherwise. Recently-shown IDs are deprioritized in either mode.
  const allowSingleImage = Math.random() < COLA_CLOUD_SINGLE_IMAGE_CHANCE;
  const recentSet = new Set(recentlyShownTtbIds);
  const pool = allowSingleImage
    ? buildPool(allowedSummaries, (summary) => summary.image_count === 1, recentSet)
    : buildPool(allowedSummaries, (summary) => summary.image_count >= 2, recentSet);

  type DetailResponse = { data: ColaCloudDetail };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = pool[Math.floor(Math.random() * pool.length)]!;
    try {
      const res = await fetchColaCloudJson<DetailResponse>(
        `/colas/${encodeURIComponent(candidate.ttb_id)}`,
        apiKey
      );
      if (isBlockedColaCloudTtbId(res.data.ttb_id)) {
        continue;
      }
      const imageCount = res.data.images?.length ?? 0;
      // Hold the target for the first couple of attempts in case a
      // summary's image_count disagreed with the detail response. After
      // that, accept any record with images so we don't 502 when a
      // narrow slice happens to be lopsided.
      const meetsTarget = allowSingleImage ? imageCount >= 1 : imageCount >= 2;
      if (meetsTarget || (attempt >= 2 && imageCount >= 1)) {
        rememberRecentTtbId(res.data.ttb_id);
        return res.data;
      }
    } catch {}
  }

  return null;
}

function buildPool(
  summaries: ColaCloudSummary[],
  predicate: (summary: ColaCloudSummary) => boolean,
  recentSet: Set<string>
): ColaCloudSummary[] {
  const qualified = summaries.filter(predicate);
  const fresh = qualified.filter((summary) => !recentSet.has(summary.ttb_id));
  if (fresh.length > 0) return fresh;
  if (qualified.length > 0) return qualified;
  const freshAny = summaries.filter((summary) => !recentSet.has(summary.ttb_id));
  return freshAny.length > 0 ? freshAny : summaries;
}

function randomPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function rememberRecentTtbId(ttbId: string) {
  const existingIndex = recentlyShownTtbIds.indexOf(ttbId);
  if (existingIndex !== -1) {
    recentlyShownTtbIds.splice(existingIndex, 1);
  }
  recentlyShownTtbIds.push(ttbId);
  while (recentlyShownTtbIds.length > COLA_CLOUD_RECENT_WINDOW) {
    recentlyShownTtbIds.shift();
  }
}

export function __resetColaCloudRouteCache(): void {
  colaCloudCache = null;
  recentlyShownTtbIds.length = 0;
}

async function fetchColaCloudJson<T>(endpoint: string, apiKey: string): Promise<T> {
  const res = await fetch(`${COLA_CLOUD_API_BASE}${endpoint}`, {
    headers: { 'X-API-Key': apiKey }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`COLA Cloud ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function mapColaCloudToFields(detail: ColaCloudDetail) {
  return {
    brandName: detail.brand_name ?? '',
    fancifulName: detail.product_name ?? '',
    classType: detail.class_name ?? '',
    alcoholContent: detail.abv != null ? `${detail.abv.toFixed(1)}% Alc./Vol.` : '',
    netContents: '',
    applicantAddress: detail.address_recipient ?? '',
    origin: detail.domestic_or_imported === 'Imported' ? 'imported' : 'domestic',
    country: detail.origin_name ?? '',
    formulaId: detail.ttb_id ?? '',
    appellation: detail.wine_appellation ?? '',
    vintage: detail.wine_vintage_year ? String(detail.wine_vintage_year) : ''
  };
}

function selectPreferredColaCloudImages(images: ColaCloudImage[]) {
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

function colaCloudImagePriority(image: ColaCloudImage) {
  const position = image.container_position?.trim().toLowerCase();
  if (position === 'front') {
    return 0;
  }
  if (position === 'back') {
    return 1;
  }
  return 2;
}

function buildColaCloudImagePayload(
  detail: ColaCloudDetail,
  image: ColaCloudImage,
  index: number
) {
  const extension = image.extension_type || 'jpg';
  const position =
    image.container_position?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
    `image-${index + 1}`;

  return {
    id: `colacloud-${detail.ttb_id}-${image.ttb_image_id}`,
    source: 'cola-cloud-live',
    filename: `${detail.ttb_id}-${position}.${extension}`,
    url: `/api/eval/cola-cloud/proxy-image?url=${encodeURIComponent(image.image_url)}&ttb=${encodeURIComponent(detail.ttb_id)}`,
    beverageType: normalizeBeverageType(detail.product_type)
  };
}

function normalizeBeverageType(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes('distilled')) return 'distilled-spirits';
  if (lower.includes('malt') || lower.includes('beer')) return 'malt-beverage';
  if (lower.includes('wine')) return 'wine';
  return 'unknown';
}

function mimeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}
