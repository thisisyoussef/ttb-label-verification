/**
 * Produce a one-pack variant of evals/batch/cola-cloud-pdf/manifest.json
 * containing only the `cola-cloud-all` pack. Keeps PDF-vs-image eval cost
 * low while still giving 28 labels of head-to-head comparison coverage.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const repoRoot = process.cwd();
  const srcPath = path.join(repoRoot, 'evals/batch/cola-cloud-pdf/manifest.json');
  const destPath = path.join(repoRoot, 'evals/batch/cola-cloud-pdf/manifest.cola-cloud-all.json');

  const manifest = JSON.parse(await readFile(srcPath, 'utf8'));
  manifest.sets = manifest.sets.filter((set: { id: string }) => set.id === 'cola-cloud-all');

  await writeFile(destPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${destPath} with ${manifest.sets.length} packs`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
