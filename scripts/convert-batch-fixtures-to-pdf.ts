/**
 * Generate a parallel batch fixture pack that references the PDF versions of
 * the golden labels instead of the original WebP/PNG files.
 *
 * Reads from: evals/batch/cola-cloud/{manifest.json, *.csv}
 * Writes to:  evals/batch/cola-cloud-pdf/{manifest.json, *.csv}
 *
 * - `manifest.json` gets every `assetPath` rewritten to the `-pdf/` mirror
 *   with a `.pdf` extension.
 * - CSV files get every filename column rewritten so rows still match the
 *   PDF images by filename hint.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC_DIR = 'evals/batch/cola-cloud';
const DEST_DIR = 'evals/batch/cola-cloud-pdf';

const ASSET_PATH_REWRITES: Array<[string, string]> = [
  ['evals/labels/assets/cola-cloud/', 'evals/labels/assets/cola-cloud-pdf/'],
  [
    'evals/labels/assets/supplemental-generated/',
    'evals/labels/assets/supplemental-generated-pdf/'
  ]
];

function rewriteAssetPath(originalAssetPath: string): string {
  let rewritten = originalAssetPath;
  for (const [from, to] of ASSET_PATH_REWRITES) {
    if (rewritten.startsWith(from)) {
      rewritten = to + rewritten.slice(from.length);
      break;
    }
  }
  // Swap the trailing image extension for .pdf.
  return rewritten.replace(/\.(webp|png|jpe?g)$/i, '.pdf');
}

function rewriteFilename(originalFilename: string): string {
  return originalFilename.replace(/\.(webp|png|jpe?g)$/i, '.pdf');
}

async function processManifest(repoRoot: string) {
  const manifestPath = path.join(repoRoot, SRC_DIR, 'manifest.json');
  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  manifest.description =
    (manifest.description ?? '') +
    ' PDF-converted parallel pack for PDF-ingestion eval coverage.';

  for (const set of manifest.sets) {
    for (const imageCase of set.imageCases) {
      imageCase.assetPath = rewriteAssetPath(imageCase.assetPath);
    }
  }

  const destPath = path.join(repoRoot, DEST_DIR, 'manifest.json');
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`manifest -> ${destPath}`);
}

async function processCsvs(repoRoot: string) {
  const srcAbs = path.join(repoRoot, SRC_DIR);
  const destAbs = path.join(repoRoot, DEST_DIR);
  await mkdir(destAbs, { recursive: true });

  const entries = await readdir(srcAbs);
  for (const name of entries) {
    if (!name.endsWith('.csv')) continue;
    const raw = await readFile(path.join(srcAbs, name), 'utf8');
    const rewritten = raw
      .split('\n')
      .map((line, idx) => {
        // Header line — preserve verbatim.
        if (idx === 0) return line;
        // Each body line starts with `filename,...` — rewrite the first cell.
        const comma = line.indexOf(',');
        if (comma < 0) return line;
        const filename = line.slice(0, comma);
        const rest = line.slice(comma);
        return rewriteFilename(filename) + rest;
      })
      .join('\n');
    const destPath = path.join(destAbs, name);
    await writeFile(destPath, rewritten);
    console.log(`csv      -> ${destPath}`);
  }
}

async function main() {
  const repoRoot = process.cwd();
  await processManifest(repoRoot);
  await processCsvs(repoRoot);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
