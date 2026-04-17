/**
 * Per-label X-Stage-Timings dump for a small slice of cola-cloud-all.
 *
 * Posts each label to /api/review and prints the server's internal stage
 * breakdown from the X-Stage-Timings response header.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

const LABELS = [
  {
    id: 'simply-elegant-bourbon',
    path: 'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp',
    fields: {
      beverageType: 'distilled-spirits',
      brandName: 'Simply Elegant',
      fancifulName: 'Simply Elegant Spirits',
      classType: 'Whiskey',
      alcoholContent: '40% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: '',
      origin: 'domestic',
      country: 'USA',
      formulaId: '',
      appellation: '',
      vintage: '',
      varietals: []
    }
  },
  {
    id: 'harpoon-ale',
    path: 'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp',
    fields: {
      beverageType: 'malt-beverage',
      brandName: 'Harpoon',
      fancifulName: '',
      classType: 'Ale',
      alcoholContent: '5.9% Alc./Vol.',
      netContents: '12 fl oz',
      applicantAddress: '306 Northern Ave, Boston, MA 02210',
      origin: 'domestic',
      country: 'USA',
      formulaId: '',
      appellation: '',
      vintage: '',
      varietals: []
    }
  },
  {
    id: 'leitz-rottland-wine',
    path: 'evals/labels/assets/cola-cloud/leitz-rottland-wine.webp',
    fields: {
      beverageType: 'wine',
      brandName: 'Leitz',
      fancifulName: 'Rottland',
      classType: 'Riesling',
      alcoholContent: '12.5% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: '',
      origin: 'imported',
      country: 'Germany',
      formulaId: '',
      appellation: 'Rheingau',
      vintage: '2020',
      varietals: []
    }
  },
  {
    id: 'manzone-barolo-wine',
    path: 'evals/labels/assets/cola-cloud/manzone-giovanni-barolo-perno-wine.webp',
    fields: {
      beverageType: 'wine',
      brandName: 'Manzone Giovanni',
      fancifulName: 'Barolo Perno',
      classType: 'Barolo',
      alcoholContent: '14.5% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: '',
      origin: 'imported',
      country: 'Italy',
      formulaId: '',
      appellation: 'Barolo DOCG',
      vintage: '2019',
      varietals: []
    }
  },
  {
    id: 'persian-empire-arak',
    path: 'evals/labels/assets/cola-cloud/persian-empire-arak-distilled-spirits.webp',
    fields: {
      beverageType: 'distilled-spirits',
      brandName: 'Persian Empire',
      fancifulName: 'Arak',
      classType: 'Arak',
      alcoholContent: '40% Alc./Vol.',
      netContents: '',
      applicantAddress: '',
      origin: 'imported',
      country: 'Canada',
      formulaId: '',
      appellation: '',
      vintage: '',
      varietals: []
    }
  }
];

async function runOne(label: typeof LABELS[number]) {
  const root = process.cwd();
  const img = readFileSync(path.join(root, label.path));
  const form = new FormData();
  form.append('label', new Blob([img], { type: 'image/webp' }), path.basename(label.path));
  form.append('fields', JSON.stringify(label.fields));

  const started = performance.now();
  const res = await fetch(`${BASE_URL}/api/review`, { method: 'POST', body: form });
  const wall = Math.round(performance.now() - started);

  if (!res.ok) {
    console.log(`[${label.id}] HTTP ${res.status}`);
    return;
  }

  const stages = res.headers.get('x-stage-timings') ?? '(no x-stage-timings header)';
  const body = await res.json();
  console.log(`\n=== ${label.id} — verdict=${body.verdict}, wall=${wall}ms ===`);
  console.log(`  stages: ${stages}`);
}

async function main() {
  console.log(`Probing ${LABELS.length} labels at ${BASE_URL} for per-stage timings`);
  for (const label of LABELS) {
    try {
      await runOne(label);
    } catch (err) {
      console.error(`[${label.id}] error:`, (err as Error).message);
    }
  }
}

main();
