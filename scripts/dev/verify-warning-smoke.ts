import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyWarningPresenceByOcr } from '../../src/server/government-warning-verification';

async function main() {
  const labels = [
    'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp',
    'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp',
    'evals/labels/assets/cola-cloud/leitz-rottland-wine.webp'
  ];
  for (const rel of labels) {
    const abs = path.join(process.cwd(), rel);
    const img = readFileSync(abs);
    const r = await verifyWarningPresenceByOcr({
      originalName: path.basename(rel),
      mimeType: 'image/webp',
      bytes: img.length,
      buffer: img
    });
    const snippet = r.extractedText.slice(0, 120).replace(/\n/g, ' ');
    console.log(`\n${path.basename(rel)}`);
    console.log(`  region=${r.regionUsed ? `(${r.regionUsed.left},${r.regionUsed.top} ${r.regionUsed.width}x${r.regionUsed.height})` : 'null (fell back to full image)'}`);
    console.log(`  similarity=${(r.similarity * 100).toFixed(0)}%  missing=[${r.missingCriticalWords.join(', ')}]  wall=${r.durationMs}ms`);
    console.log(`  text: ${snippet}${r.extractedText.length > 120 ? '…' : ''}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
