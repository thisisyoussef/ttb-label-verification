/**
 * Fast eval runner — tests a representative slice of 6 labels (2 per beverage type)
 * through the full pipeline in ~2-3 minutes instead of 13+ for the full batch.
 *
 * Usage: OCR_PREPASS=enabled npx tsx scripts/fast-eval.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
process.env.NODE_ENV = 'test';
process.env.OPENAI_STORE = 'false';

async function main() {
  const { loadLocalEnv } = await import('../src/server/load-local-env');
  loadLocalEnv(repoRoot);
  const { createApp } = await import('../src/server/index');

  // Representative slice: 2 spirits, 2 wine, 2 malt + 1 negative
  const cases = [
    { id: 'simply-elegant', path: 'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp', expected: 'approve', brand: 'Simply Elegant', classType: 'straight bourbon whisky', abv: '67% Alc./Vol.', net: '750 mL' },
    { id: 'persian-empire', path: 'evals/labels/assets/cola-cloud/persian-empire-black-widow-distilled-spirits.webp', expected: 'approve', brand: 'Persian Empire', classType: 'other specialties & proprietaries', abv: '40% Alc./Vol.', net: '750 mL' },
    { id: 'leitz-rottland', path: 'evals/labels/assets/cola-cloud/leitz-rottland-wine.webp', expected: 'approve', brand: 'Leitz', classType: 'table white wine', abv: '12.5% Alc./Vol.', net: '750 mL' },
    { id: 'stormwood', path: 'evals/labels/assets/cola-cloud/stormwood-wines-semillon-wine.webp', expected: 'approve', brand: 'Stormwood Wines', classType: 'table white wine', abv: '13% Alc./Vol.', net: '750 mL' },
    { id: 'lake-placid', path: 'evals/labels/assets/cola-cloud/lake-placid-shredder-malt-beverage.webp', expected: 'approve', brand: 'Lake Placid', classType: 'ale', abv: '4% Alc./Vol.', net: '12 FL OZ' },
    { id: 'harpoon', path: 'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp', expected: 'approve', brand: 'Harpoon', classType: 'ale', abv: '5% Alc./Vol.', net: '1 PINT' },
    { id: 'negative-abv', path: 'evals/labels/assets/supplemental-generated/lake-placid-shredder-abv-negative.webp', expected: 'reject', brand: 'Lake Placid', classType: 'IPA', abv: '5% Alc./Vol.', net: '12 FL OZ' },
  ];

  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Could not get server address');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  console.log(`Fast eval: ${cases.length} labels against ${baseUrl}`);
  console.log('─'.repeat(80));

  const results: Array<{ id: string; expected: string; actual: string; match: boolean; checks: string }> = [];

  for (const c of cases) {
    const imgPath = path.join(repoRoot, c.path);
    const imgBuffer = readFileSync(imgPath);
    const ext = path.extname(c.path).slice(1);
    const mime = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg';

    const form = new FormData();
    form.append('label', new Blob([imgBuffer], { type: mime }), path.basename(c.path));
    form.append('fields', JSON.stringify({
      beverageType: 'auto',
      brandName: c.brand,
      fancifulName: '',
      classType: c.classType,
      alcoholContent: c.abv,
      netContents: c.net,
      applicantAddress: '',
      origin: 'domestic',
      country: '',
      formulaId: '',
      appellation: '',
      vintage: '',
      varietals: []
    }));

    try {
      const res = await fetch(`${baseUrl}/api/review`, { method: 'POST', body: form });
      const text = await res.text();
      if (!res.ok) {
        console.log(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
        results.push({ id: c.id, expected: c.expected, actual: 'error', match: false, checks: `HTTP ${res.status}` });
        console.log(`✗ ${c.id.padEnd(20)} expected=${c.expected.padEnd(8)} actual=error(${res.status})`);
        continue;
      }
      const data = JSON.parse(text) as { verdict?: string; checks?: Array<{ id: string; status: string }> };
      const verdict = data.verdict ?? 'error';
      const checkSummary = (data.checks ?? []).map((ch: { id: string; status: string; applicationValue?: string; extractedValue?: string; comparison?: { note?: string } }) => {
        const detail = ch.status === 'fail' || ch.status === 'review'
          ? ` [app=${ch.applicationValue ?? '?'} ext=${ch.extractedValue ?? '?'}]`
          : '';
        return `${ch.id}:${ch.status}${detail}`;
      }).join(', ');
      const match = (c.expected === 'approve' && verdict === 'approve') ||
                    (c.expected === 'reject' && verdict === 'reject');
      results.push({ id: c.id, expected: c.expected, actual: verdict, match, checks: checkSummary });
      const icon = match ? '✓' : '✗';
      console.log(`${icon} ${c.id.padEnd(20)} expected=${c.expected.padEnd(8)} actual=${verdict.padEnd(8)} ${match ? '' : '← MISMATCH'}`);
    } catch (e) {
      results.push({ id: c.id, expected: c.expected, actual: 'error', match: false, checks: String(e) });
      console.log(`✗ ${c.id.padEnd(20)} expected=${c.expected.padEnd(8)} actual=error`);
    }
  }

  console.log('─'.repeat(80));
  const correct = results.filter(r => r.match).length;
  console.log(`Result: ${correct}/${results.length} correct (${(correct / results.length * 100).toFixed(0)}%)`);
  console.log(`Approved: ${results.filter(r => r.actual === 'approve').length}/${results.filter(r => r.expected === 'approve').length} expected approvals`);
  console.log(`Rejected: ${results.filter(r => r.actual === 'reject').length}/${results.filter(r => r.expected === 'reject').length} expected rejections`);

  // Print check detail for mismatches
  for (const r of results.filter(r => !r.match)) {
    console.log(`\n  MISMATCH: ${r.id} (expected=${r.expected} actual=${r.actual})`);
    console.log(`  Checks: ${r.checks}`);
  }

  server.close();
  process.exit(correct === results.length ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
