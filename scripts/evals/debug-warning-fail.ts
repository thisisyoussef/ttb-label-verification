/**
 * Debug the 5 labels that hit government-warning:fail on Cloud.
 *
 * Posts each to /api/review and prints the warning check detail.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

const CASES = [
  {
    id: 'harpoon-ale',
    path: 'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp',
    beverageType: 'malt-beverage',
    brand: 'Harpoon',
    classType: 'Ale',
    abv: '5.9% Alc./Vol.',
    net: '12 fl oz',
    applicantAddress: 'Harpoon Brewery Boston MA'
  },
  {
    id: '1840-lager',
    path: 'evals/labels/assets/cola-cloud/1840-original-lager-1840-original-lager-malt-beverage.webp',
    beverageType: 'malt-beverage',
    brand: '1840 Original Lager',
    classType: 'Lager',
    abv: '5.2% Alc./Vol.',
    net: '12 fl oz',
    applicantAddress: ''
  },
  {
    id: 'pleasant-prairie',
    path: 'evals/labels/assets/cola-cloud/pleasant-prairie-brewing-peach-sour-ale-malt-beverage.webp',
    beverageType: 'malt-beverage',
    brand: 'Pleasant Prairie',
    classType: 'Sour Ale',
    abv: '5.5% Alc./Vol.',
    net: '12 fl oz',
    applicantAddress: ''
  }
];

async function runOne(c: typeof CASES[number]) {
  const repoRoot = process.cwd();
  const imgBuffer = readFileSync(path.join(repoRoot, c.path));
  const form = new FormData();
  form.append('label', new Blob([imgBuffer], { type: 'image/webp' }), path.basename(c.path));
  form.append(
    'fields',
    JSON.stringify({
      beverageType: c.beverageType,
      brandName: c.brand,
      fancifulName: '',
      classType: c.classType,
      alcoholContent: c.abv,
      netContents: c.net,
      applicantAddress: c.applicantAddress,
      origin: 'domestic',
      country: 'USA',
      formulaId: '',
      appellation: '',
      vintage: '',
      varietals: []
    })
  );
  const res = await fetch(`${BASE_URL}/api/review`, { method: 'POST', body: form });
  const text = await res.text();
  if (!res.ok) {
    console.log(`[${c.id}] HTTP ${res.status}: ${text.slice(0, 200)}`);
    return;
  }
  const data = JSON.parse(text);
  const warning = (data.checks ?? []).find((x: any) => x.id === 'government-warning');
  console.log(`\n=== ${c.id} — verdict: ${data.verdict} ===`);
  if (warning) {
    console.log(`warning.status: ${warning.status}`);
    console.log(`warning.severity: ${warning.severity}`);
    console.log(`warning.summary: ${warning.summary}`);
    console.log(`warning.confidence: ${warning.confidence}`);
    if (warning.warning) {
      console.log(`warning.warning.required (first 150): ${String(warning.warning.required).slice(0, 150)}`);
      console.log(`warning.warning.extracted (first 150): ${String(warning.warning.extracted).slice(0, 150)}`);
      const sub = warning.warning.subChecks ?? [];
      for (const s of sub) {
        console.log(`  subCheck ${s.id}: status=${s.status} summary=${String(s.summary).slice(0, 80)}`);
      }
    }
  }
}

async function main() {
  for (const c of CASES) {
    try {
      await runOne(c);
    } catch (err) {
      console.error(`[${c.id}] error:`, (err as Error).message);
    }
  }
}

main();
