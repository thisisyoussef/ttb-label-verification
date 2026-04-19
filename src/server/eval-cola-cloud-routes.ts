import express from 'express';

const COLA_CLOUD_API_BASE = 'https://app.colacloud.us/api/v1';
const COLA_CLOUD_CACHE_TTL_MS = 10 * 60 * 1000;

let colaCloudCache: {
  fetchedAt: number;
  summaries: ColaCloudSummary[];
} | null = null;

type ColaCloudSummary = {
  ttb_id: string;
  brand_name: string;
  product_name: string;
  product_type: string;
  class_name: string;
  origin_name: string;
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
    const search = await fetchColaCloudJson<SearchResponse>('/colas?per_page=30', apiKey);
    colaCloudCache = {
      fetchedAt: Date.now(),
      summaries: search.data
    };
  }

  const summaries = colaCloudCache?.summaries ?? [];
  if (summaries.length === 0) {
    throw new Error('COLA Cloud returned no records.');
  }

  type DetailResponse = { data: ColaCloudDetail };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = summaries[Math.floor(Math.random() * summaries.length)]!;
    try {
      const res = await fetchColaCloudJson<DetailResponse>(
        `/colas/${encodeURIComponent(candidate.ttb_id)}`,
        apiKey
      );
      if (res.data.images?.length) {
        return res.data;
      }
    } catch {}
  }

  return null;
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
