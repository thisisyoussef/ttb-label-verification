import {
  BUILTIN_SAMPLES,
  BUILTIN_SAMPLE_BY_ID
} from './builtin-sample-packs';

export type SampleFields = {
  brandName: string;
  fancifulName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  applicantAddress: string;
  origin: string;
  country: string;
  formulaId: string;
  appellation: string;
  vintage: string;
};

export type SamplePreview = {
  id: string;
  beverageType: string;
  filename: string;
};

export type SampleImagePayload = {
  id: string;
  url: string;
  filename: string;
};

export function guessMimeFromFilename(
  filename: string
): string | undefined {
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext) return undefined;
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'pdf') return 'application/pdf';
  return undefined;
}

export function deriveImageMime(blobType: string, filename: string): string {
  if (blobType && blobType.startsWith('image/')) return blobType;
  if (blobType === 'application/pdf') return blobType;

  const lower = filename.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export async function fetchSampleFiles(
  images: SampleImagePayload[]
): Promise<File[]> {
  const files: File[] = [];

  for (const image of images.slice(0, 2)) {
    const imgRes = await fetch(image.url);
    if (!imgRes.ok) {
      throw new Error(`image HTTP ${imgRes.status}`);
    }

    const blob = await imgRes.blob();
    files.push(
      new File([blob], image.filename, {
        type: deriveImageMime(blob.type, image.filename)
      })
    );
  }

  return files;
}

export function prettifyLabel(id: string): string {
  const stripped = id
    .replace(/-distilled-spirits$/i, '')
    .replace(/-malt-beverage$/i, '')
    .replace(/-wine$/i, '');

  return stripped
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function resolveBuiltinSample(id?: string) {
  if (id) {
    return BUILTIN_SAMPLE_BY_ID.get(id) ?? null;
  }

  return BUILTIN_SAMPLES[Math.floor(Math.random() * BUILTIN_SAMPLES.length)] ?? null;
}
