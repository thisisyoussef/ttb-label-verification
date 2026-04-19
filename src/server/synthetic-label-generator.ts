import { GoogleGenAI } from '@google/genai';

import {
  CANONICAL_GOVERNMENT_WARNING,
  type BeverageType,
  type SyntheticLabelDefectKind,
  type SyntheticLabelExpected,
  type SyntheticLabelFields,
  type SyntheticLabelGenerateResponse,
  type SyntheticLabelImage,
  type Verdict
} from '../shared/contracts/review';
import { putSyntheticImage } from './synthetic-label-cache';

/**
 * Server-side synthesizer for the toolbench "Generate sample with
 * Gemini" button.
 *
 * Each call:
 *   1. Picks a beverage type at random (wine / malt / spirits)
 *   2. Picks a defect kind at random — 40% none (clean approve), 60%
 *      spread evenly across five defect kinds
 *   3. Builds a fake-name brand profile (no real TTB COLA names)
 *   4. Builds an Imagen prompt that names the visual elements and
 *      bakes the defect in (e.g. for `warning-missing`: omit warning)
 *   5. Calls Imagen 4, caches the bytes, returns a descriptor that
 *      mirrors the existing /api/eval/sample shape
 *
 * Cost: ~$0.04 per call (Imagen 4 generate). The route layer
 * rate-limits to 1 call / 5s / IP so a button-mash can't run up the
 * bill.
 */

const IMAGEN_MODEL = 'imagen-4.0-generate-001';
const IMAGEN_TIMEOUT_MS = 30_000;
const NONE_PROBABILITY = 0.4;
/**
 * Odds that a generation includes a companion back label alongside the
 * front. Kept under 50% so button-mashing the toolbench doesn't double
 * the Imagen bill in aggregate — the user asked for two images
 * "sometimes", not always.
 */
const BACK_LABEL_PROBABILITY = 0.35;

type FakeBrand = {
  brand: string;
  fanciful: string;
  city: string;
  state: string;
};

const SPIRITS_BRANDS: FakeBrand[] = [
  { brand: 'Mill River', fanciful: 'Old Quartermaster', city: 'Louisville', state: 'KY' },
  { brand: 'Stone Creek', fanciful: 'Single Barrel Reserve', city: 'Bardstown', state: 'KY' },
  { brand: 'Ironwood Hollow', fanciful: 'Small Batch No. 7', city: 'Frankfort', state: 'KY' },
  { brand: 'North Cove', fanciful: 'Coastal Botanical', city: 'Portland', state: 'OR' },
  { brand: 'Red Stag Distillers', fanciful: 'Heritage Cut', city: 'Asheville', state: 'NC' }
];

const WINE_BRANDS: FakeBrand[] = [
  { brand: 'Tessera Vineyards', fanciful: 'Estate Reserve', city: 'Napa', state: 'CA' },
  { brand: 'Holloway Cellars', fanciful: 'Single Vineyard', city: 'Sonoma', state: 'CA' },
  { brand: 'Pine Ridge Estate', fanciful: 'Old Vine Reserve', city: 'Healdsburg', state: 'CA' },
  { brand: 'Crestwood Winery', fanciful: 'Block 12', city: 'Walla Walla', state: 'WA' }
];

const MALT_BRANDS: FakeBrand[] = [
  { brand: 'Foundry & Forge Brewing', fanciful: 'River Bend IPA', city: 'Burlington', state: 'VT' },
  { brand: 'North Pier Brewing', fanciful: 'Harbor Stout', city: 'Portland', state: 'ME' },
  { brand: 'Switchback Brewing Co.', fanciful: 'Crooked Mile Lager', city: 'Asheville', state: 'NC' },
  { brand: 'Ridgeline Brewworks', fanciful: 'Summit Pale Ale', city: 'Bend', state: 'OR' }
];

const CLASS_BY_BEVERAGE: Record<BeverageType, string[]> = {
  'distilled-spirits': [
    'Kentucky Straight Bourbon Whiskey',
    'Single Malt Whisky',
    'London Dry Gin',
    'Vodka',
    'Aged Rum'
  ],
  wine: ['Cabernet Sauvignon', 'Chardonnay', 'Pinot Noir', 'Sauvignon Blanc'],
  'malt-beverage': [
    'India Pale Ale',
    'American Lager',
    'Stout',
    'Pilsner',
    'Hefeweizen'
  ],
  unknown: ['Beverage']
};

const ABV_BY_BEVERAGE: Record<BeverageType, () => string> = {
  'distilled-spirits': () => `${randInt(40, 47)}% Alc./Vol.`,
  wine: () => `${(11 + Math.random() * 3).toFixed(1)}% Alc./Vol.`,
  'malt-beverage': () => `${(4.5 + Math.random() * 3).toFixed(1)}% Alc./Vol.`,
  unknown: () => '5% Alc./Vol.'
};

const NET_BY_BEVERAGE: Record<BeverageType, string[]> = {
  'distilled-spirits': ['750 mL', '700 mL', '1 L'],
  wine: ['750 mL', '375 mL'],
  'malt-beverage': ['12 FL. OZ.', '16 FL. OZ.', '500 mL'],
  unknown: ['12 FL. OZ.']
};

interface DefectPlan {
  kind: SyntheticLabelDefectKind;
  description: string;
  expectedVerdict: Verdict;
  /** Mutate the prompt instructions before calling Imagen. */
  mutateImagePrompt: (lines: string[]) => string[];
  /** Mutate the declared fields the client will fill into the form. */
  mutateDeclared: (fields: SyntheticLabelFields) => SyntheticLabelFields;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

function brandPoolFor(beverage: BeverageType): FakeBrand[] {
  if (beverage === 'wine') return WINE_BRANDS;
  if (beverage === 'malt-beverage') return MALT_BRANDS;
  return SPIRITS_BRANDS;
}

function buildBaselineFields(beverage: BeverageType): {
  fields: SyntheticLabelFields;
  brand: FakeBrand;
  classType: string;
  abv: string;
  netContents: string;
} {
  const brand = pick(brandPoolFor(beverage));
  const classType = pick(CLASS_BY_BEVERAGE[beverage]);
  const abv = ABV_BY_BEVERAGE[beverage]();
  const netContents = pick(NET_BY_BEVERAGE[beverage]);
  const isWine = beverage === 'wine';
  const fields: SyntheticLabelFields = {
    brandName: brand.brand,
    fancifulName: brand.fanciful,
    classType,
    alcoholContent: abv,
    netContents,
    applicantAddress: `${brand.brand}\n${brand.city}, ${brand.state}`,
    origin: 'domestic',
    country: '',
    formulaId: '',
    appellation: isWine ? `${brand.city} Valley` : '',
    vintage: isWine ? String(2018 + randInt(0, 5)) : ''
  };
  return { fields, brand, classType, abv, netContents };
}

function buildBaselineImagePrompt(input: {
  beverage: BeverageType;
  brand: FakeBrand;
  classType: string;
  abv: string;
  netContents: string;
}): string[] {
  // Imagen prompts work best with a clear scene description first,
  // then a bullet list of textual elements that must appear. We name
  // the warning paragraph explicitly so it actually shows up — Imagen
  // is otherwise inconsistent about long block text.
  const beverageLabel =
    input.beverage === 'wine'
      ? 'wine bottle label'
      : input.beverage === 'malt-beverage'
        ? 'beer / malt beverage label'
        : 'distilled-spirits bottle label';

  return [
    `Photorealistic flat front-facing scan of a US TTB-style ${beverageLabel}, no bottle, no shadows. White background. Clean printed typography, looks like a production label.`,
    `BRAND NAME (largest text): "${input.brand.brand}"`,
    `Fanciful name (medium text): "${input.brand.fanciful}"`,
    `Class / type statement: "${input.classType}"`,
    `Alcohol content: "${input.abv}"`,
    `Net contents: "${input.netContents}"`,
    `Bottler / applicant address: "${input.brand.brand}, ${input.brand.city}, ${input.brand.state}"`,
    `Government warning paragraph in small print at the bottom, exactly: "${CANONICAL_GOVERNMENT_WARNING}"`,
    'No images of people, no realistic logos, no copyrighted brand artwork. Make the brand name read clearly and large.'
  ];
}

function buildBackImagePrompt(input: {
  beverage: BeverageType;
  brand: FakeBrand;
  classType: string;
  netContents: string;
  includeWarning: boolean;
}): string[] {
  // Back labels are typically calmer than fronts: smaller brand mark,
  // marketing blurb, barcode placeholder, bottler address, and often
  // the government warning (which on real products frequently lives on
  // the back). We keep the warning text canonical when present so the
  // extractor doesn't flag a malformed warning.
  const beverageLabel =
    input.beverage === 'wine'
      ? 'wine back label'
      : input.beverage === 'malt-beverage'
        ? 'beer / malt beverage back label'
        : 'distilled-spirits back label';

  const lines = [
    `Photorealistic flat back-facing scan of a US TTB-style ${beverageLabel}, no bottle, no shadows. White background. Clean printed typography, looks like a production label. Portrait 3:4 aspect.`,
    `Small brand mark (top, smaller than the front): "${input.brand.brand}"`,
    `Short marketing paragraph about the ${input.classType}, 2-3 sentences.`,
    `Bottler / applicant address (small print): "${input.brand.brand}, ${input.brand.city}, ${input.brand.state}"`,
    `Net contents restated: "${input.netContents}"`,
    'Barcode placeholder rectangle bottom-left (black parallel lines + 12-digit number below).',
    'No images of people, no realistic logos, no copyrighted brand artwork.'
  ];
  if (input.includeWarning) {
    lines.splice(
      4,
      0,
      `Government warning paragraph in small print: "${CANONICAL_GOVERNMENT_WARNING}"`
    );
  }
  return lines;
}

function pickDefectPlan(beverage: BeverageType): DefectPlan {
  const usingNone = Math.random() < NONE_PROBABILITY;
  if (usingNone) {
    return {
      kind: 'none',
      description: 'Clean label — declared fields match the image.',
      expectedVerdict: 'approve',
      mutateImagePrompt: (lines) => lines,
      mutateDeclared: (fields) => fields
    };
  }
  const defects: DefectPlan[] = [
    {
      kind: 'abv-mismatch',
      description: 'Image ABV differs from declared by ~2% — should reject.',
      expectedVerdict: 'reject',
      mutateImagePrompt: (lines) => lines, // image keeps the truthful ABV
      mutateDeclared: (fields) => {
        // Bump the declared ABV by 2% so it disagrees with what's
        // printed on the synthetic label.
        const match = fields.alcoholContent.match(/(\d+(?:\.\d+)?)/);
        if (!match) return fields;
        const current = Number(match[1]);
        const drifted = (current + (Math.random() < 0.5 ? 2 : -2)).toFixed(1);
        return {
          ...fields,
          alcoholContent: fields.alcoholContent.replace(
            /(\d+(?:\.\d+)?)/,
            drifted
          )
        };
      }
    },
    {
      kind: 'warning-missing',
      description:
        'Image does NOT include the government warning — should reject.',
      expectedVerdict: 'reject',
      mutateImagePrompt: (lines) =>
        lines.filter((l) => !l.includes('Government warning')),
      mutateDeclared: (fields) => fields
    },
    {
      kind: 'brand-different',
      description:
        'Image shows a different brand than declared — should review.',
      expectedVerdict: 'review',
      mutateImagePrompt: (lines) => lines, // image keeps its real brand
      mutateDeclared: (fields) => ({
        ...fields,
        brandName: pick(SPIRITS_BRANDS).brand // declared something else
      })
    },
    {
      kind: 'country-wrong-import',
      description:
        'Image says made in Canada, declared origin is USA — should review.',
      expectedVerdict: 'review',
      mutateImagePrompt: (lines) => [
        ...lines,
        'Add a small line near the address: "Made in Canada"'
      ],
      mutateDeclared: (fields) => ({
        ...fields,
        origin: 'imported',
        country: 'United States'
      })
    },
    {
      kind: 'class-totally-different',
      description:
        'Image class differs significantly from declared — should review.',
      expectedVerdict: 'review',
      mutateImagePrompt: (lines) => lines,
      mutateDeclared: (fields) => ({
        ...fields,
        classType:
          beverage === 'distilled-spirits'
            ? 'Vodka'
            : beverage === 'wine'
              ? 'Sparkling Wine'
              : 'Stout'
      })
    }
  ];
  return pick(defects);
}

export interface GenerateSyntheticLabelDeps {
  /** Override for tests — defaults to constructing GoogleGenAI from env. */
  generateImage?: (prompt: string) => Promise<{ bytes: Buffer; mime: string }>;
}

async function defaultGenerateImage(
  prompt: string
): Promise<{ bytes: Buffer; mime: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGEN_TIMEOUT_MS);

  try {
    const response = await ai.models.generateImages({
      model: IMAGEN_MODEL,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '3:4',
        abortSignal: controller.signal
      }
    });

    const generated = response.generatedImages?.[0];
    const imageBytes = generated?.image?.imageBytes;
    if (!imageBytes) {
      throw new Error(
        'Imagen returned no image bytes (possibly filtered by safety settings).'
      );
    }

    // The SDK returns base64-encoded bytes by default.
    const buffer =
      typeof imageBytes === 'string'
        ? Buffer.from(imageBytes, 'base64')
        : Buffer.from(imageBytes as Uint8Array);
    const mime = generated?.image?.mimeType ?? 'image/png';
    return { bytes: buffer, mime };
  } finally {
    clearTimeout(timeout);
  }
}

export function isSyntheticGenerationAvailable(): boolean {
  if (process.env.ENABLE_SYNTHETIC_LABELS === 'false') return false;
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getSyntheticGenerationModel(): string {
  return IMAGEN_MODEL;
}

export async function generateSyntheticLabel(
  deps: GenerateSyntheticLabelDeps = {}
): Promise<SyntheticLabelGenerateResponse> {
  const beverage: BeverageType = pick([
    'distilled-spirits',
    'wine',
    'malt-beverage'
  ] as const);

  const baseline = buildBaselineFields(beverage);
  const defectPlan = pickDefectPlan(beverage);

  const frontPromptLines = defectPlan.mutateImagePrompt(
    buildBaselineImagePrompt({
      beverage,
      brand: baseline.brand,
      classType: baseline.classType,
      abv: baseline.abv,
      netContents: baseline.netContents
    })
  );
  const frontPrompt = frontPromptLines.join('\n');

  const generate = deps.generateImage ?? defaultGenerateImage;
  const stamp = Date.now();

  // Front image is always generated. The optional back image is
  // generated in parallel to keep click-to-load latency close to the
  // single-image baseline. If the back generation fails for any reason
  // we fall back to returning just the front so a transient Imagen
  // hiccup on image 2 doesn't block the whole sample.
  const wantsBack =
    defectPlan.kind !== 'warning-missing' &&
    Math.random() < BACK_LABEL_PROBABILITY;

  // When the defect is "warning missing on the label", omit the warning
  // from BOTH sides so the pipeline has to flag it. Otherwise, a
  // realistic label usually has the warning on exactly one side — if
  // it's on the front today we keep the back without a warning
  // duplicate; if front omitted it (no defect applied), the back can
  // carry it. We already block the back path for `warning-missing` via
  // `wantsBack`, so when we do produce a back label we leave the front
  // prompt's warning alone and keep the back silent on it. Keeping
  // canonical-warning duplication off the table avoids the extractor
  // double-counting.
  const generateFront = async (): Promise<{
    bytes: Buffer;
    mime: string;
  }> => generate(frontPrompt);

  const generateBack = async (): Promise<{
    bytes: Buffer;
    mime: string;
  } | null> => {
    if (!wantsBack) return null;
    try {
      const backPrompt = buildBackImagePrompt({
        beverage,
        brand: baseline.brand,
        classType: baseline.classType,
        netContents: baseline.netContents,
        includeWarning: false
      }).join('\n');
      return await generate(backPrompt);
    } catch {
      return null;
    }
  };

  const [front, back] = await Promise.all([generateFront(), generateBack()]);

  const extFor = (mime: string) =>
    mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

  const frontExt = extFor(front.mime);
  const frontFilename = `synthetic-${beverage}-${defectPlan.kind}-${stamp}-front.${frontExt}`;
  const frontId = putSyntheticImage({
    bytes: front.bytes,
    mime: front.mime,
    filename: frontFilename
  });
  const frontImage: SyntheticLabelImage = {
    id: frontId,
    url: `/api/eval/synthetic/image/${encodeURIComponent(frontId)}`,
    filename: frontFilename,
    beverageType: beverage
  };

  const images: SyntheticLabelImage[] = [frontImage];
  if (back) {
    const backExt = extFor(back.mime);
    const backFilename = `synthetic-${beverage}-${defectPlan.kind}-${stamp}-back.${backExt}`;
    const backId = putSyntheticImage({
      bytes: back.bytes,
      mime: back.mime,
      filename: backFilename
    });
    images.push({
      id: backId,
      url: `/api/eval/synthetic/image/${encodeURIComponent(backId)}`,
      filename: backFilename,
      beverageType: beverage
    });
  }

  const declared = defectPlan.mutateDeclared(baseline.fields);
  const expected: SyntheticLabelExpected = {
    verdict: defectPlan.expectedVerdict,
    defectKind: defectPlan.kind,
    description: defectPlan.description
  };

  return {
    image: frontImage,
    ...(images.length > 1 ? { images } : {}),
    fields: declared,
    expected
  };
}
