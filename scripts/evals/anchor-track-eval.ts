/**
 * Anchor-track eval: would the parallel anchor track have approved
 * the label deterministically, and would that have been right?
 *
 * Runs the anchor track in isolation across the full cola-cloud-all
 * slice (28 labels) + compares to the expected recommendation. No
 * production wiring — pure research harness. Output:
 *
 *   - per-label: anchor canFastApprove? vs expected verdict
 *   - aggregate: precision of fast-approve on actual "approve"
 *     labels, agreement rate, avg wall clock
 *   - fast-approve safety: false-positive rate on labels expected
 *     to NOT auto-approve (reject, review required)
 *
 * Usage: npx tsx scripts/anchor-track-eval.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { runAnchorTrack } from '../../src/server/anchor-field-track';
import type { NormalizedReviewFields } from '../../src/server/review-intake';

interface Case {
  id: string;
  filename: string;
  beverageType: 'auto' | 'distilled-spirits' | 'wine' | 'malt-beverage';
  brand: string;
  fancifulName?: string;
  classType: string;
  abv: string;
  net: string;
  applicantAddress?: string;
  origin?: 'domestic' | 'imported';
  country?: string;
  formulaId?: string;
  appellation?: string;
  vintage?: string;
  expected: 'approve' | 'review' | 'reject';
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { out.push(cell); cell = ''; continue; }
    cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

function loadCases(): Case[] {
  const csvPath = path.join(process.cwd(), 'evals/batch/cola-cloud/cola-cloud-all.csv');
  const text = readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvRow(lines[0]!);
  const idxOf = (name: string) => header.indexOf(name);
  const cases: Case[] = [];
  const imageRoot = 'evals/labels/assets/cola-cloud';
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvRow(lines[i]!);
    const filename = cols[idxOf('filename')] ?? '';
    if (!filename) continue;
    cases.push({
      id: filename.replace(/\.[a-z0-9]+$/i, ''),
      filename: path.join(imageRoot, filename),
      beverageType: 'auto',
      brand: cols[idxOf('brand_name')] ?? '',
      fancifulName: cols[idxOf('fanciful_name')] ?? '',
      classType: cols[idxOf('class_type')] ?? '',
      abv: cols[idxOf('alcohol_content')] ?? '',
      net: cols[idxOf('net_contents')] ?? '',
      applicantAddress: cols[idxOf('applicant_address')] ?? '',
      origin: (cols[idxOf('origin')] as 'domestic' | 'imported') ?? 'domestic',
      country: cols[idxOf('country')] ?? '',
      appellation: cols[idxOf('appellation')] ?? '',
      vintage: cols[idxOf('vintage')] ?? '',
      expected: 'approve' // cola-cloud-all is 28 approved labels
    });
  }
  return cases;
}

async function runOne(c: Case) {
  const abs = path.join(process.cwd(), c.filename);
  if (!existsSync(abs)) return null;
  const img = readFileSync(abs);
  const fields: NormalizedReviewFields = {
    beverageTypeHint: c.beverageType,
    origin: c.origin ?? 'domestic',
    brandName: c.brand,
    fancifulName: c.fancifulName,
    classType: c.classType,
    alcoholContent: c.abv,
    netContents: c.net,
    applicantAddress: c.applicantAddress,
    country: c.country,
    formulaId: c.formulaId,
    appellation: c.appellation,
    vintage: c.vintage,
    varietals: []
  };
  const t = Date.now();
  const result = await runAnchorTrack(
    {
      originalName: path.basename(c.filename),
      mimeType: 'image/webp',
      bytes: img.length,
      buffer: img
    },
    fields
  );
  const wall = Date.now() - t;
  return { case: c, result, wall };
}

function statusIcon(status: string): string {
  switch (status) {
    case 'found': return '✓';
    case 'partial': return '◐';
    case 'missing': return '✗';
    default: return '—';
  }
}

async function main() {
  console.log('Anchor-track eval — cola-cloud-all (28 labels)');
  console.log('Compares deterministic anchor output against the expected verdict.');
  console.log('═'.repeat(100));

  const cases = loadCases();
  console.log(`Loaded ${cases.length} cases\n`);

  let fastApprove = 0;
  let fastApproveCorrect = 0;
  const wallTimes: number[] = [];
  const statusBucket: Record<string, number> = {
    'fast-approve-correct': 0,
    'fast-approve-wrong': 0,
    'anchor-weak-expected-approve': 0,
    'anchor-weak-expected-review-reject': 0
  };

  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i]!;
    const out = await runOne(c);
    if (!out) {
      console.log(`[${i + 1}/${cases.length}] SKIP ${c.id}`);
      continue;
    }
    wallTimes.push(out.wall);
    const summary = out.result.fields
      .map((a) => `${a.field}:${statusIcon(a.status)}`)
      .join(' ');
    const fastMark = out.result.canFastApprove ? '✓FAST' : '     ';
    const expected = c.expected.padEnd(7);
    console.log(
      `[${String(i + 1).padStart(2)}/${cases.length}] ${c.id.slice(0, 48).padEnd(48)}  ` +
      `${fastMark}  exp=${expected}  ocr=${String(out.result.ocrWordCount).padStart(3)}  ${out.wall}ms  ${summary}`
    );
    if (out.result.canFastApprove) {
      fastApprove += 1;
      if (c.expected === 'approve') {
        fastApproveCorrect += 1;
        statusBucket['fast-approve-correct']! += 1;
      } else {
        statusBucket['fast-approve-wrong']! += 1;
      }
    } else {
      if (c.expected === 'approve') {
        statusBucket['anchor-weak-expected-approve']! += 1;
      } else {
        statusBucket['anchor-weak-expected-review-reject']! += 1;
      }
    }
  }

  const total = wallTimes.length;
  const avgWall = Math.round(wallTimes.reduce((a, b) => a + b, 0) / total);
  const p50 = wallTimes.sort((a, b) => a - b)[Math.floor(total / 2)];
  const p95 = wallTimes.sort((a, b) => a - b)[Math.floor(total * 0.95)];

  console.log('\n' + '═'.repeat(100));
  console.log('Summary:');
  console.log(`  Fast-approve fired:      ${fastApprove}/${total} labels (${((fastApprove / total) * 100).toFixed(0)}%)`);
  console.log(`  Fast-approve correct:    ${fastApproveCorrect}/${fastApprove} (would have matched expected verdict)`);
  if (fastApprove > 0) {
    const safety = fastApproveCorrect / fastApprove;
    console.log(`  Fast-approve precision:  ${(safety * 100).toFixed(1)}%`);
  }
  console.log(`  Latency: avg=${avgWall}ms  p50=${p50}ms  p95=${p95}ms`);
  console.log('\nBucket breakdown:');
  for (const [k, v] of Object.entries(statusBucket)) {
    console.log(`  ${k.padEnd(40)} ${v}`);
  }
  console.log('\nInterpretation:');
  console.log('  - fast-approve-correct = anchor fired AND label actually approves. Safe auto-approves.');
  console.log('  - fast-approve-wrong   = anchor fired BUT label should have been review/reject. FALSE POSITIVE.');
  console.log('  - anchor-weak-expected-approve = anchor didn\'t fire on a label that should approve.');
  console.log('    These would fall through to the VLM pipeline (no regression).');
}

main().catch((e) => { console.error(e); process.exit(1); });
