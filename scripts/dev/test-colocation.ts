/**
 * Manual harness for the spirits same-field-of-vision VLM check.
 * Runs `checkSpiritsColocation` against every distilled-spirits
 * sample under evals/labels/assets and prints a summary so we can
 * spot false-negative patterns at a glance.
 *
 *   npx tsx scripts/test-colocation.ts
 *
 * Loads `.env` from the repo root (we symlink it into the worktree
 * for convenience) so GEMINI_API_KEY is available without manual
 * export.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Tiny inline .env loader so we don't depend on dotenv being
// installed in this worktree. Reads `KEY=value` lines, ignores
// comments and blanks. Existing process.env values win.
async function loadEnv(file: string): Promise<void> {
  try {
    const text = await fs.readFile(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // Silent: if .env is missing the harness will report
    // "GEMINI_API_KEY not set" below.
  }
}

import { checkSpiritsColocation } from '../../src/server/spirits-colocation-check';
import type { NormalizedUploadedLabel } from '../../src/server/review-intake';

const LABELS = [
  // Approved spirits labels — should all colocate cleanly.
  'evals/labels/assets/perfect-spirit-label.png',
  'evals/labels/assets/cola-cloud/crafty-elk-mango-honey-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/persian-empire-black-widow-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/the-wine-trust-rum-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/persian-empire-arak-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/flaviar-columbia-creek-tennessee-whiskey-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/crafy-elk-cranberry-blueberry-acai-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/old-station-31-orange-distilled-spirits.webp',
  'evals/labels/assets/cola-cloud/west-peak-tequila-paloma-distilled-spirits.webp',
  // Negative controls — wines / beers where the spirits-rule pieces
  // intentionally aren't all together (or the label isn't a spirits
  // label at all). The check is gated to spirits in production, but
  // here we want to confirm the prompt CAN still flag a miss.
  'evals/labels/assets/cola-cloud/leitz-rottland-wine.webp',
  'evals/labels/assets/cola-cloud/stormwood-wines-semillon-wine.webp'
];

function mimeFor(file: string): string {
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function main() {
  await loadEnv(path.resolve('.env'));
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error('GEMINI_API_KEY not set — aborting.');
    process.exit(1);
  }
  let ok = 0;
  for (const rel of LABELS) {
    const buffer = await fs.readFile(path.resolve(rel));
    const label: NormalizedUploadedLabel = {
      originalName: path.basename(rel),
      mimeType: mimeFor(rel),
      bytes: buffer.length,
      buffer
    };
    process.stdout.write(`${path.basename(rel).padEnd(60)} … `);
    const t0 = Date.now();
    const r = await checkSpiritsColocation(label);
    const elapsed = Date.now() - t0;
    if (!r) {
      console.log(`NULL (${elapsed}ms)`);
      continue;
    }
    const verdict = r.colocated ? 'COLOCATED' : 'MISSING';
    console.log(
      `${verdict.padEnd(11)} (${elapsed}ms, conf=${r.confidence.toFixed(2)})`
    );
    if (!r.colocated) {
      console.log(
        `    missing: ${r.missingFromPrimary.join(', ') || '(none listed)'}`
      );
      console.log(`    panel:   ${r.primaryPanelDescription}`);
      console.log(`    reason:  ${r.reason}`);
    }
    if (r.colocated) ok += 1;
  }
  console.log(`\n=== ${ok}/${LABELS.length} colocated ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
