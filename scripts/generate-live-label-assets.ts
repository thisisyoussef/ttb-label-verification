import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { GoogleGenAI } from '@google/genai';

type LabelManifest = {
  cases: Array<{
    id: string;
    title: string;
    assetPath: string;
  }>;
};

const DEFAULT_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image-preview';

const PROMPTS: Record<string, string> = {
  'perfect-spirit-label': [
    'Create a synthetic internal QA fixture: a flat front-facing 2D printed distilled spirits label only.',
    'Do not show a bottle, hands, shelf, or background scene.',
    'Center one rectangular paper label on a plain white background with crisp readable black text.',
    "Brand name: STONE'S THROW.",
    'Class/type line: Kentucky Straight Bourbon Whiskey.',
    'Net contents line: 750 mL.',
    'Alcohol line: 45% Alc./Vol. (90 Proof).',
    "Bottled by line: Stone's Throw Distilling, Louisville, KY.",
    'Include the full exact U.S. government warning as one readable paragraph with an all-caps heading:',
    'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    'Use a clean internal-tool compliance-demo style. No logos, seals, or decorative illustrations.'
  ].join(' '),
  'spirit-warning-errors': [
    'Create a synthetic internal QA fixture: a flat front-facing 2D printed distilled spirits label only.',
    'No bottle or scene; just one centered rectangular paper label on white.',
    "Brand name: STONE'S THROW.",
    'Class/type line: Kentucky Straight Bourbon Whiskey.',
    'Net contents line: 750 mL.',
    'Alcohol line: 45% Alc./Vol. (90 Proof).',
    "Bottled by line: Stone's Throw Distilling, Louisville, KY.",
    'Include a deliberately defective warning paragraph for testing.',
    'The heading must be title case, not all caps: Government Warning:',
    'The body must omit the comma after "Surgeon General" in clause (1).',
    'Keep the rest of the warning readable as printed label text.',
    'No decorative graphics.'
  ].join(' '),
  'spirit-brand-case-mismatch': [
    'Create a synthetic internal QA fixture: a flat front-facing 2D printed distilled spirits label only.',
    'One centered rectangular label on white with crisp readable text.',
    "Brand name on the label must be lower case: stone's throw.",
    'Class/type line: Kentucky Straight Bourbon Whiskey.',
    'Net contents line: 750 mL.',
    'Alcohol line: 45% Alc./Vol. (90 Proof).',
    "Bottled by line: Stone's Throw Distilling, Louisville, KY.",
    'Include the full exact U.S. government warning with the all-caps heading:',
    'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    'Keep everything else compliant-looking and readable.'
  ].join(' '),
  'wine-missing-appellation': [
    'Create a synthetic internal QA fixture: a flat front-facing 2D printed wine label only.',
    'One centered paper label on white, crisp readable text, no bottle or scene.',
    'Brand name: NORTH RIDGE CELLARS.',
    'Vintage year: 2021.',
    'Varietal: Pinot Noir.',
    'Alcohol line: 13.5% Alc. by Vol.',
    'Net contents line: 750 mL.',
    'Bottled by line: North Ridge Cellars, Napa, CA.',
    'Intentionally omit any appellation or AVA text.',
    'Include the full exact U.S. government warning as readable printed text with the all-caps heading.',
    'No medals, vineyard art, or decorative borders.'
  ].join(' '),
  'beer-forbidden-abv-format': [
    'Create a synthetic internal QA fixture: a flat front-facing 2D printed malt beverage label only.',
    'One centered paper label on white, crisp readable text, no bottle or can mockup.',
    'Brand name: HARBOR LIGHT.',
    'Style line: Lager Beer.',
    'Net contents line: 12 FL OZ.',
    'Use the intentionally forbidden alcohol format exactly: 5.2% ABV.',
    'Brewed by line: Harbor Light Brewing Co., Milwaukee, WI.',
    'Include the full exact U.S. government warning as readable printed text with the all-caps heading.',
    'No extra graphics beyond very simple typographic hierarchy.'
  ].join(' '),
  'low-quality-image': [
    'Create a synthetic internal QA fixture: a low-quality cellphone photo of a printed alcohol label.',
    'The image should be front-facing enough to see a label, but noticeably blurry, low-contrast, slightly noisy, and a little motion-smeared.',
    "Show a simple spirits label with partial readable text such as STONE'S THROW, 750 mL, and a government warning block, but make the overall image hard to read.",
    'Plain neutral background, no people, no bottle glamour shot, internal QA style.',
    'The goal is a realistic poor-quality capture that should trigger low-confidence extraction.'
  ].join(' ')
};

function parseArgs(argv: string[]) {
  const selectedCaseIds = new Set<string>();
  let force = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg === '--case') {
      const caseId = argv[index + 1]?.trim();
      if (!caseId) {
        throw new Error('Expected a case id after --case.');
      }
      selectedCaseIds.add(caseId);
      index += 1;
      continue;
    }
  }

  return { force, selectedCaseIds };
}

async function fileExists(filePath: string) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractImageBytes(
  response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>
) {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }
  }

  return null;
}

async function generateImage(ai: GoogleGenAI, prompt: string, model: string) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  });

  const imageBytes = extractImageBytes(response);
  if (!imageBytes) {
    throw new Error('Gemini returned no image bytes for this prompt.');
  }

  return imageBytes;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required to generate label assets.');
  }

  const { force, selectedCaseIds } = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const manifestPath = path.join(repoRoot, 'evals/labels/manifest.json');
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8')
  ) as LabelManifest;

  const ai = new GoogleGenAI({ apiKey });
  const model = DEFAULT_MODEL;
  const generated: Array<{ id: string; assetPath: string }> = [];

  for (const caseItem of manifest.cases) {
    if (selectedCaseIds.size > 0 && !selectedCaseIds.has(caseItem.id)) {
      continue;
    }

    const prompt = PROMPTS[caseItem.id];
    if (!prompt) {
      throw new Error(`No Gemini prompt is defined for ${caseItem.id}.`);
    }

    const assetPath = path.join(repoRoot, 'evals/labels', caseItem.assetPath);
    await mkdir(path.dirname(assetPath), { recursive: true });

    if (!force && (await fileExists(assetPath))) {
      console.log(`skip ${caseItem.id} (${caseItem.title})`);
      continue;
    }

    console.log(`generate ${caseItem.id} (${caseItem.title})`);
    const imageBytes = await generateImage(ai, prompt, model);
    await writeFile(assetPath, imageBytes);
    generated.push({
      id: caseItem.id,
      assetPath
    });
  }

  console.log(
    JSON.stringify(
      {
        model,
        generated
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Failed to generate label assets.'
  );
  process.exitCode = 1;
});
