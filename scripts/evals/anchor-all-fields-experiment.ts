/**
 * Experiment: "parallel anchoring" across ALL fields for refinement.
 *
 * Application data tells us what each field SHOULD say. Instead of
 * asking the VLM to re-read every field (which is slow + hallucinates),
 * use the application value as a known target and look for it
 * deterministically via Tesseract TSV on the full label. For each
 * field in parallel:
 *   - Normalize the known value (lowercase, strip punctuation)
 *   - Tokenize into distinctive content words
 *   - Search the full-image TSV for those tokens
 *   - Report: found (with bbox), partial match, or missing
 *
 * This is the "ground-truth verification" strategy applied broadly.
 * It's complementary to the VLM — VLM can assess things like bold,
 * positioning, and bevergae type, but for exact-value verification
 * OCR-with-known-target is more reliable.
 *
 * Runs on 5 labels from cola-cloud-all and reports per-field findings
 * + wall clock.
 */

import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import sharp from 'sharp';

const execAsync = promisify(exec);

// 5 labels pulled from the cola-cloud-all CSV. Hard-coded application
// values so the experiment doesn't have to parse the CSV.
const LABELS: Array<{
  path: string;
  fields: {
    brandName: string;
    fancifulName?: string;
    classType: string;
    alcoholContent: string;
    netContents?: string;
    country?: string;
  };
}> = [
  {
    path: 'evals/labels/assets/cola-cloud/persian-empire-black-widow-distilled-spirits.webp',
    fields: {
      brandName: 'Persian Empire',
      fancifulName: 'Black Widow',
      classType: 'other specialties & proprietaries',
      alcoholContent: '40% Alc./Vol.',
      country: 'canada'
    }
  },
  {
    path: 'evals/labels/assets/cola-cloud/leitz-rottland-wine.webp',
    fields: {
      brandName: 'Leitz',
      fancifulName: 'Rottland',
      classType: 'table white wine',
      alcoholContent: '12.5% Alc./Vol.',
      country: 'germany'
    }
  },
  {
    path: 'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp',
    fields: {
      brandName: 'Simply Elegant',
      fancifulName: 'Simply Elegant Spirits',
      classType: 'straight bourbon whisky',
      alcoholContent: '67% Alc./Vol.'
    }
  },
  {
    path: 'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp',
    fields: {
      brandName: 'Harpoon',
      classType: 'india pale ale',
      alcoholContent: '5.9% Alc./Vol.',
      netContents: '12 fl oz'
    }
  },
  {
    path: 'evals/labels/assets/cola-cloud/lake-placid-shredder-malt-beverage.webp',
    fields: {
      brandName: 'Lake Placid',
      fancifulName: 'Shredder',
      classType: 'india pale ale',
      alcoholContent: '7% Alc./Vol.'
    }
  }
];

interface TsvWord {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
}

interface FieldAnchorResult {
  field: string;
  expected: string;
  tokens: string[];
  tokensFound: number;
  tokensExpected: number;
  foundPercent: number;
  boundingBoxes: Array<{ token: string; left: number; top: number }>;
  status: 'found' | 'partial' | 'missing';
}

async function runTesseractTsv(imageBuffer: Buffer): Promise<string> {
  const tmp = path.join(tmpdir(), `anchor-exp-${randomBytes(8).toString('hex')}.png`);
  try {
    const prepped = await sharp(imageBuffer)
      .resize({ width: 2400, kernel: 'lanczos3' })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
    writeFileSync(tmp, prepped);
    const { stdout } = await execAsync(
      `tesseract ${tmp} stdout -l eng --psm 3 --oem 1 tsv 2>/dev/null`,
      { timeout: 8000, maxBuffer: 20 * 1024 * 1024 }
    );
    return stdout;
  } catch {
    return '';
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function parseTsv(tsv: string): TsvWord[] {
  const rows = tsv.split('\n').slice(1);
  const words: TsvWord[] = [];
  for (const row of rows) {
    const cols = row.split('\t');
    if (cols.length < 12) continue;
    const text = cols[11]?.trim();
    const conf = Number.parseFloat(cols[10] ?? '-1');
    if (!text || text.length === 0) continue;
    if (!Number.isFinite(conf) || conf < 40) continue; // skip low-confidence
    const left = Number.parseInt(cols[6]!, 10);
    const top = Number.parseInt(cols[7]!, 10);
    const width = Number.parseInt(cols[8]!, 10);
    const height = Number.parseInt(cols[9]!, 10);
    if (Number.isFinite(left) && Number.isFinite(top)) {
      words.push({ text: text.toLowerCase(), left, top, width, height, conf });
    }
  }
  return words;
}

/**
 * Tokenize a known field value into searchable content tokens.
 * Strips stopwords + short tokens that are too common to be
 * discriminating.
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'by', 'for', 'with', 'from',
  'in', 'on', 'at', 'to', 'is', 'was', 'it', 'that', 'this'
]);

function tokenizeFieldValue(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[.,%!?;:()/\\-]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !STOPWORDS.has(tok));
}

function anchorField(field: string, expected: string, words: TsvWord[]): FieldAnchorResult {
  const tokens = tokenizeFieldValue(expected);
  if (tokens.length === 0) {
    return {
      field,
      expected,
      tokens: [],
      tokensFound: 0,
      tokensExpected: 0,
      foundPercent: 0,
      boundingBoxes: [],
      status: 'missing'
    };
  }
  const wordSet = new Set(words.map((w) => w.text));
  const boundingBoxes: FieldAnchorResult['boundingBoxes'] = [];
  let found = 0;
  for (const tok of tokens) {
    // Exact match first; fall back to substring match (OCR may
    // merge or split tokens).
    if (wordSet.has(tok)) {
      found += 1;
      const w = words.find((x) => x.text === tok)!;
      boundingBoxes.push({ token: tok, left: w.left, top: w.top });
      continue;
    }
    const fuzzy = words.find((w) => w.text.includes(tok) || tok.includes(w.text));
    if (fuzzy) {
      found += 1;
      boundingBoxes.push({ token: tok, left: fuzzy.left, top: fuzzy.top });
    }
  }
  const foundPercent = found / tokens.length;
  let status: FieldAnchorResult['status'];
  if (foundPercent >= 0.8) status = 'found';
  else if (foundPercent >= 0.4) status = 'partial';
  else status = 'missing';
  return {
    field,
    expected,
    tokens,
    tokensFound: found,
    tokensExpected: tokens.length,
    foundPercent,
    boundingBoxes,
    status
  };
}

async function runOne(entry: typeof LABELS[number]): Promise<void> {
  const abs = path.join(process.cwd(), entry.path);
  if (!existsSync(abs)) {
    console.log(`SKIP: ${entry.path}`);
    return;
  }
  const img = readFileSync(abs);
  const startedAt = Date.now();
  const tsv = await runTesseractTsv(img);
  const words = parseTsv(tsv);
  const tsvWall = Date.now() - startedAt;

  // Anchor every field IN PARALLEL (it's just a map over the same TSV).
  const fieldKeys: Array<[string, string]> = [
    ['brand', entry.fields.brandName],
    ...(entry.fields.fancifulName ? [['fanciful', entry.fields.fancifulName]] as Array<[string, string]> : []),
    ['class', entry.fields.classType],
    ['abv', entry.fields.alcoholContent],
    ...(entry.fields.netContents ? [['net', entry.fields.netContents]] as Array<[string, string]> : []),
    ...(entry.fields.country ? [['country', entry.fields.country]] as Array<[string, string]> : [])
  ];

  const results = fieldKeys.map(([name, value]) => anchorField(name, value, words));

  const wall = Date.now() - startedAt;
  console.log(`\n▶ ${path.basename(entry.path)}  (tsv=${tsvWall}ms  total=${wall}ms  ${words.length} TSV words)`);
  console.log('─'.repeat(80));
  for (const r of results) {
    const iconMap = { found: '✓', partial: '◐', missing: '✗' };
    const icon = iconMap[r.status];
    const pct = (r.foundPercent * 100).toFixed(0).padStart(3);
    const expected = r.expected.length > 30 ? r.expected.slice(0, 30) + '…' : r.expected;
    console.log(
      `  ${icon} ${r.field.padEnd(8)} ` +
      `${r.tokensFound}/${r.tokensExpected} tokens (${pct}%)  ` +
      `expected: "${expected}"`
    );
  }
}

async function main() {
  console.log('Parallel anchoring experiment — all fields at once');
  console.log('Uses application data as known targets + Tesseract TSV on full label');
  console.log('═'.repeat(80));
  for (const entry of LABELS) {
    await runOne(entry);
  }
  console.log('\n' + '═'.repeat(80));
  console.log('Summary:');
  console.log('  ✓  found    = ≥80% of expected content tokens present on the label');
  console.log('  ◐  partial  = 40-80% of expected content tokens present');
  console.log('  ✗  missing  = <40% of expected content tokens present');
}

main().catch((e) => { console.error(e); process.exit(1); });
