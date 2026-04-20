/**
 * Dual-image integration bench.
 *
 * Hits a running /api/review instance with:
 *   A. primary image only (baseline, pre-multi-label behavior)
 *   B. two distinct images (the second is a real different label)
 *   C. same image uploaded twice (degenerate dual — checks that the
 *      new per-image fanout doesn't double wall-clock on identical
 *      inputs)
 *
 * For each run we record:
 *   - overall wall clock
 *   - X-Stage-Timings header (vlm, ocr-prepass, warning-ocv,
 *     anchor-track, region-detection, spirits-colocation)
 *   - verdict
 *
 * Used to verify that after Option A+B wiring:
 *   - wall-clock for B is bounded by max(single-image VLM calls) + a
 *     small overhead, not 2× the baseline
 *   - C matches A closely (no extra stage work on redundant input)
 *
 * Requires BASE_URL (defaults to http://127.0.0.1:8787) pointing at a
 * server instance with working provider credentials.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const ROOT = process.cwd();

type StageTimings = Record<string, number>;

type Sample = {
  id: string;
  variant: 'primary-only' | 'dual-distinct' | 'dual-duplicate';
  wallMs: number;
  verdict: string;
  stages: StageTimings;
};

const PAIRS: Array<{ id: string; primary: string; secondary: string; fields: unknown }> = [
  {
    id: 'lager-x-wine',
    primary: 'evals/labels/assets/cola-cloud/1840-original-lager-1840-original-lager-malt-beverage.webp',
    secondary: 'evals/labels/assets/cola-cloud/ana-luisa-gran-reserva-parcelas-blend-wine.webp',
    fields: {
      beverageType: 'malt-beverage',
      brandName: '1840',
      fancifulName: 'Original Lager',
      classType: 'Lager',
      alcoholContent: '5% Alc./Vol.',
      netContents: '12 fl oz',
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
    id: 'arak-x-barolo',
    primary: 'evals/labels/assets/cola-cloud/persian-empire-arak-distilled-spirits.webp',
    secondary: 'evals/labels/assets/cola-cloud/manzone-giovanni-barolo-perno-wine.webp',
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

function parseStageTimings(header: string | null): StageTimings {
  if (!header) return {};
  const parts = header.split(';');
  const out: StageTimings = {};
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) out[key] = parsed;
  }
  return out;
}

async function runSample(input: {
  id: string;
  variant: Sample['variant'];
  primaryPath: string;
  secondaryPath?: string;
  fields: unknown;
}): Promise<Sample> {
  const formData = new FormData();
  const primary = readFileSync(path.join(ROOT, input.primaryPath));
  formData.append(
    'label',
    new Blob([primary], { type: 'image/webp' }),
    path.basename(input.primaryPath)
  );
  if (input.secondaryPath) {
    const secondary = readFileSync(path.join(ROOT, input.secondaryPath));
    formData.append(
      'label',
      new Blob([secondary], { type: 'image/webp' }),
      path.basename(input.secondaryPath)
    );
  }
  formData.append('fields', JSON.stringify(input.fields));

  const started = performance.now();
  const res = await fetch(`${BASE_URL}/api/review`, { method: 'POST', body: formData });
  const wallMs = Math.round(performance.now() - started);

  if (!res.ok) {
    throw new Error(`[${input.id}/${input.variant}] HTTP ${res.status}`);
  }
  const stages = parseStageTimings(res.headers.get('x-stage-timings'));
  const body = (await res.json()) as { verdict?: string };
  return {
    id: input.id,
    variant: input.variant,
    wallMs,
    verdict: body.verdict ?? 'unknown',
    stages
  };
}

function fmt(n: number | undefined) {
  return (n ?? 0).toString().padStart(6);
}

function printRow(sample: Sample) {
  const {
    total = 0,
    'ocr-prepass': ocr = 0,
    'warning-ocv': ocv = 0,
    'anchor-track': anchor = 0,
    'region-detection': region = 0,
    'spirits-colocation': coloc = 0,
    'llm-judgment': judge = 0,
    'provider-wait': provider = 0
  } = sample.stages;
  console.log(
    `  ${sample.variant.padEnd(16)}  wall=${fmt(sample.wallMs)}ms  verdict=${sample.verdict.padEnd(8)}  total=${fmt(total)}ms  ocr=${fmt(ocr)}  ocv=${fmt(ocv)}  anchor=${fmt(anchor)}  region=${fmt(region)}  coloc=${fmt(coloc)}  vlm=${fmt(provider)}  judge=${fmt(judge)}`
  );
}

async function main() {
  console.log(`\nDual-image integration bench — target ${BASE_URL}\n`);
  for (const pair of PAIRS) {
    console.log(`=== ${pair.id} ===`);
    try {
      const primaryOnly = await runSample({
        id: pair.id,
        variant: 'primary-only',
        primaryPath: pair.primary,
        fields: pair.fields
      });
      printRow(primaryOnly);
    } catch (err) {
      console.error(`  primary-only error: ${(err as Error).message}`);
    }
    try {
      const dualDistinct = await runSample({
        id: pair.id,
        variant: 'dual-distinct',
        primaryPath: pair.primary,
        secondaryPath: pair.secondary,
        fields: pair.fields
      });
      printRow(dualDistinct);
    } catch (err) {
      console.error(`  dual-distinct error: ${(err as Error).message}`);
    }
    try {
      const dualDuplicate = await runSample({
        id: pair.id,
        variant: 'dual-duplicate',
        primaryPath: pair.primary,
        secondaryPath: pair.primary,
        fields: pair.fields
      });
      printRow(dualDuplicate);
    } catch (err) {
      console.error(`  dual-duplicate error: ${(err as Error).message}`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
