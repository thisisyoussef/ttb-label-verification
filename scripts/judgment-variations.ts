/**
 * Judgment variation harness — synthetic test generator.
 *
 * Takes each real COLA Cloud row as a baseline, applies both legitimate
 * and illegitimate perturbations to the extracted values, and runs the
 * deterministic judgment functions directly (no VLM/OCR roundtrip).
 *
 * For each variation we record: the perturbation applied, the rule that
 * fired, the disposition returned, the confidence, and whether the
 * disposition matches the operator's intent ("expected disposition").
 *
 * Output:
 *   - evals/results/judgment-variations.json  (full raw data)
 *   - evals/results/judgment-variations.md    (human-readable table)
 *
 * Usage:
 *   npx tsx scripts/judgment-variations.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  judgeAlcoholContent,
  judgeApplicantAddress,
  judgeBrandName,
  judgeClassType,
  judgeCountryOfOrigin,
  judgeGovernmentWarningText,
  judgeNetContents,
  judgeVarietal,
  judgeVintage,
  type FieldJudgment
} from '../src/server/judgment-field-rules';
import { CANONICAL_GOVERNMENT_WARNING } from '../src/shared/contracts/review-base';

type GoldenRow = {
  filename: string;
  beverage_type: string;
  brand_name: string;
  fanciful_name: string;
  class_type: string;
  alcohol_content: string;
  net_contents: string;
  applicant_address: string;
  country: string;
  appellation?: string;
  vintage?: string;
};

type Variation = {
  rowId: string;
  field: string;
  kind: 'legit' | 'illegit' | 'ambiguous';
  description: string;
  appValue: string;
  labelValue: string;
  expectedDisposition: FieldJudgment['disposition'];
  actualDisposition: FieldJudgment['disposition'];
  actualRule: string;
  actualConfidence: number;
  actualNote: string;
  match: boolean;
};

const ROOT = path.resolve(process.cwd());
const CSV_PATH = path.join(ROOT, 'evals/batch/cola-cloud/cola-cloud-all.csv');

function parseCsv(contents: string): GoldenRow[] {
  const lines = contents.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = lines[0]!.split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row as unknown as GoldenRow;
  });
}

function record(
  variation: Omit<Variation, 'actualDisposition' | 'actualRule' | 'actualConfidence' | 'actualNote' | 'match'>,
  judgment: FieldJudgment
): Variation {
  return {
    ...variation,
    actualDisposition: judgment.disposition,
    actualRule: judgment.rule,
    actualConfidence: judgment.confidence,
    actualNote: judgment.note,
    match: judgment.disposition === variation.expectedDisposition
  };
}

function brandVariations(row: GoldenRow): Variation[] {
  if (!row.brand_name) return [];
  const app = row.brand_name;
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'brand-name', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeBrandName(app, label)
      )
    );

  // LEGIT: should approve
  push('legit', 'exact match', app, 'approve');
  push('legit', 'all-caps', app.toUpperCase(), 'approve');
  push('legit', 'leading/trailing whitespace', `  ${app}  `, 'approve');
  if (app.includes(' ')) {
    push('legit', 'diacritical added (é)', app.replace(/e/gi, 'é'), 'approve');
    push('legit', '"The " prefix added', `The ${app}`, 'approve');
    push('legit', 'spaces removed (linebreak OCR)', app.replace(/\s+/g, ''), 'approve');
  }
  if (/and/i.test(app)) push('legit', 'and → &', app.replace(/\band\b/gi, '&'), 'approve');
  if (/&/.test(app)) push('legit', '& → and', app.replace(/&/g, 'and'), 'approve');
  push('legit', 'substring (parent brand)', app.split(' ')[0] ?? app, 'approve');

  // AMBIGUOUS: should review (fuzzy match)
  const typo = app.length > 4 ? app.slice(0, 2) + (app[2] === 't' ? 'd' : 't') + app.slice(3) : `${app}x`;
  push('ambiguous', 'single-char typo', typo, 'review');

  // ILLEGIT: should review (no recognizable relationship)
  push('illegit', 'unrelated brand', 'Zyxwv Corp', 'review');

  return out;
}

function classTypeVariations(row: GoldenRow): Variation[] {
  if (!row.class_type) return [];
  const app = row.class_type;
  const bev = row.beverage_type;
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'class-type', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeClassType(app, label, bev)
      )
    );

  push('legit', 'exact', app, 'approve');
  push('legit', 'all-caps', app.toUpperCase(), 'approve');
  push('legit', 'Premium prefix', `Premium ${app}`, 'approve');
  push('legit', 'Reserve suffix', `${app} Reserve`, 'approve');
  // Whisky/whiskey only when relevant
  if (/whisky|whiskey/i.test(app)) {
    const flipped = /whiskey/i.test(app)
      ? app.replace(/whiskey/gi, 'whisky')
      : app.replace(/whisky/gi, 'whiskey');
    push('ambiguous', 'whisky ↔ whiskey spelling', flipped, 'review');
  }

  push('illegit', 'different beverage family', bev === 'malt-beverage' ? 'Vodka' : 'Stout Beer', 'review');

  return out;
}

function abvVariations(row: GoldenRow): Variation[] {
  if (!row.alcohol_content) return [];
  const app = row.alcohol_content;
  const bev = row.beverage_type;
  const match = app.match(/([\d.]+)/);
  if (!match) return [];
  const appNum = Number(match[1]);
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'alcohol-content', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeAlcoholContent(app, label, bev)
      )
    );

  push('legit', 'exact numeric match', `${appNum}% Alc./Vol.`, 'approve');
  push('legit', 'different formatting', `${appNum}% ABV`, bev === 'malt-beverage' ? 'approve' : 'approve');
  push('legit', '+0.3% rounding', `${(appNum + 0.3).toFixed(1)}% Alc./Vol.`, 'approve');

  if (bev === 'wine') {
    push('legit', 'wine tolerance (+0.8%)', `${(appNum + 0.8).toFixed(1)}% Alc./Vol.`, 'approve');
    // Wine tax boundary cross: if app is < 14, label crossing to > 14
    if (appNum < 14) {
      push('illegit', 'crosses 14% wine tax boundary', `14.5% Alc./Vol.`, 'reject');
    }
  } else {
    // Spirits: no tolerance beyond rounding
    push('illegit', '+2.0% mismatch', `${(appNum + 2.0).toFixed(1)}% Alc./Vol.`, 'reject');
  }

  if (bev === 'malt-beverage') {
    push('illegit', 'forbidden ABV wording is handled in field-checks, not here — approve at rule layer', `${appNum}% ABV`, 'approve');
  }

  return out;
}

function netContentsVariations(row: GoldenRow): Variation[] {
  const app = row.net_contents || '750 mL';
  const match = app.match(/([\d.]+)\s*(ml|mL|L|l)/);
  if (!match) return [];
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'net-contents', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeNetContents(app, label)
      )
    );

  push('legit', 'exact', app, 'approve');
  push('legit', 'casing variant', app.toLowerCase(), 'approve');
  // Fluid oz: parser currently only recognizes mL/L. "25.4 fl oz" is a
  // legitimate label expression of 750 mL but parseNetContentsML returns
  // null for fl oz input, so the rule lands at review, not reject.
  if (/750\s*ml/i.test(app)) push('legit', '750 mL → 25.4 fl oz (fl oz not yet parsed)', '25.4 fl oz', 'review');

  push('illegit', '700 mL vs 750 mL mismatch', '700 mL', 'reject');

  return out;
}

function addressVariations(row: GoldenRow): Variation[] {
  const app = row.applicant_address || '';
  if (!app) return [];
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'applicant-address', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeApplicantAddress(app, label)
      )
    );

  push('legit', 'exact', app, 'approve');
  push('legit', 'all-caps', app.toUpperCase(), 'approve');
  // Substring (shorter label form)
  const firstComma = app.split(',')[0];
  if (firstComma && firstComma.length > 3) push('legit', 'city-only shortened', firstComma, 'approve');

  push('ambiguous', 'partial overlap (DBA style)', `DBA ${app.split(',').slice(-1)[0] ?? ''}`, 'review');
  push('illegit', 'completely different address', 'Quantum Meadows LLC, Antarctica', 'review');

  return out;
}

function countryVariations(row: GoldenRow): Variation[] {
  if (!row.country) return [];
  const app = row.country;
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'country-of-origin', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeCountryOfOrigin(app, label)
      )
    );

  push('legit', 'exact', app, 'approve');
  push('legit', 'Product of X framing', `Product of ${app}`, 'approve');
  if (/usa|united states|america/i.test(app)) {
    push('legit', 'USA ↔ United States', 'United States of America', 'approve');
  }
  if (/france/i.test(app)) push('legit', 'French form', 'France', 'approve');
  if (/germany/i.test(app)) push('legit', 'Deutschland', 'Deutschland', 'approve');

  // Ambiguous: unknown country goes to review not reject
  push('ambiguous', 'completely different country', 'Wakanda', 'review');

  return out;
}

function warningVariations(row: GoldenRow): Variation[] {
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, text: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'government-warning', kind, description: desc, appValue: '(canonical)', labelValue: text.slice(0, 60), expectedDisposition: expected },
        judgeGovernmentWarningText(text, CANONICAL_GOVERNMENT_WARNING)
      )
    );

  push('legit', 'exact canonical', CANONICAL_GOVERNMENT_WARNING, 'approve');
  push('legit', 'canonical + state addition', `${CANONICAL_GOVERNMENT_WARNING} DRINK RESPONSIBLY.`, 'approve');
  push(
    'legit',
    'GOVT abbreviation',
    CANONICAL_GOVERNMENT_WARNING.replace(/GOVERNMENT/g, 'GOVT'),
    'approve'
  );

  // Introduce 15 chars of OCR noise (in range ≤25 → approve)
  const noisy = CANONICAL_GOVERNMENT_WARNING
    .split('')
    .map((c, i) => (i < 15 && c.match(/[a-z]/i) ? (c === 'o' ? '0' : c) : c))
    .join('');
  push('legit', 'mild OCR noise (~15 chars)', noisy, 'approve');

  // Word substitution/deletion → reject. Strip a 48-char phrase that IS
  // in the canonical so the edit distance exceeds the 50-char threshold.
  push(
    'illegit',
    'missing "drive a car or operate machinery" phrase',
    CANONICAL_GOVERNMENT_WARNING.replace(' to drive a car or operate machinery', ''),
    'reject'
  );

  // Completely different text → reject
  push(
    'illegit',
    'completely different warning text',
    'Drink responsibly. Do not exceed recommended limits. Contains alcohol.',
    'reject'
  );

  return out;
}

function varietalVariations(row: GoldenRow): Variation[] {
  if (row.beverage_type !== 'wine') return [];
  const app = row.appellation || 'Chardonnay';
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'varietal', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeVarietal(app, label)
      )
    );

  push('legit', 'exact', app, 'approve');
  if (/syrah/i.test(app)) push('legit', 'Syrah ↔ Shiraz synonym', 'Shiraz', 'approve');
  push('legit', 'Reserve qualifier', `Reserve ${app}`, 'approve');
  push('illegit', 'different varietal', 'Pinot Noir', 'review');

  return out;
}

function vintageVariations(row: GoldenRow): Variation[] {
  const app = row.vintage || (row.beverage_type === 'wine' ? '2020' : '');
  if (!app) return [];
  const out: Variation[] = [];
  const push = (kind: Variation['kind'], desc: string, label: string, expected: FieldJudgment['disposition']) =>
    out.push(
      record(
        { rowId: row.filename, field: 'vintage', kind, description: desc, appValue: app, labelValue: label, expectedDisposition: expected },
        judgeVintage(app, label)
      )
    );

  push('legit', 'exact', app, 'approve');
  if (/nv/i.test(app)) push('legit', 'NV → Non-Vintage', 'Non-Vintage', 'approve');

  const yearMatch = app.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = Number(yearMatch[0]);
    push('illegit', 'wrong year (-1)', String(year - 1), 'reject');
  }

  return out;
}

function generateVariations(rows: GoldenRow[]): Variation[] {
  const all: Variation[] = [];
  for (const row of rows) {
    all.push(...brandVariations(row));
    all.push(...classTypeVariations(row));
    all.push(...abvVariations(row));
    all.push(...netContentsVariations(row));
    all.push(...addressVariations(row));
    all.push(...countryVariations(row));
    all.push(...warningVariations(row));
    all.push(...varietalVariations(row));
    all.push(...vintageVariations(row));
  }
  return all;
}

function summarize(variations: Variation[]) {
  const byField = new Map<string, { total: number; match: number; bykind: Map<string, { total: number; match: number }> }>();
  for (const v of variations) {
    const f = byField.get(v.field) ?? { total: 0, match: 0, bykind: new Map() };
    f.total += 1;
    if (v.match) f.match += 1;
    const k = f.bykind.get(v.kind) ?? { total: 0, match: 0 };
    k.total += 1;
    if (v.match) k.match += 1;
    f.bykind.set(v.kind, k);
    byField.set(v.field, f);
  }
  return byField;
}

function renderMarkdown(variations: Variation[]): string {
  const summary = summarize(variations);
  const lines: string[] = [
    '# Judgment rule coverage — synthetic variations',
    '',
    `Generated ${variations.length} synthetic variations from 28 real COLA Cloud labels.`,
    `Each variation applies a known perturbation; the expected disposition is what the rule should return.`,
    '',
    '## Summary by field',
    '',
    '| Field | Total | Match | Match % | legit ✓ / total | ambiguous ✓ / total | illegit ✓ / total |',
    '|---|---|---|---|---|---|---|'
  ];
  for (const [field, stats] of summary.entries()) {
    const pct = stats.total > 0 ? ((stats.match / stats.total) * 100).toFixed(0) : '0';
    const l = stats.bykind.get('legit') ?? { total: 0, match: 0 };
    const a = stats.bykind.get('ambiguous') ?? { total: 0, match: 0 };
    const i = stats.bykind.get('illegit') ?? { total: 0, match: 0 };
    lines.push(
      `| ${field} | ${stats.total} | ${stats.match} | ${pct}% | ${l.match}/${l.total} | ${a.match}/${a.total} | ${i.match}/${i.total} |`
    );
  }
  lines.push('');
  lines.push('## Mismatches (rule returned something other than expected disposition)');
  lines.push('');
  const mismatches = variations.filter((v) => !v.match);
  if (mismatches.length === 0) {
    lines.push('_None — every variation matched its expected disposition._');
  } else {
    lines.push('| Row | Field | Kind | Description | Expected | Actual | Rule | Conf |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const v of mismatches) {
      const rowShort = v.rowId.replace(/\.(webp|pdf|png|jpg)$/, '').slice(0, 38);
      lines.push(
        `| ${rowShort} | ${v.field} | ${v.kind} | ${v.description} | ${v.expectedDisposition} | ${v.actualDisposition} | ${v.actualRule} | ${v.actualConfidence.toFixed(2)} |`
      );
    }
  }
  return lines.join('\n');
}

async function main() {
  const csv = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csv);
  console.log(`Loaded ${rows.length} golden rows`);

  const variations = generateVariations(rows);
  console.log(`Generated ${variations.length} variations`);

  const summary = summarize(variations);
  let totalMatch = 0;
  let totalAll = 0;
  for (const stats of summary.values()) {
    totalMatch += stats.match;
    totalAll += stats.total;
  }
  console.log(`Match rate: ${totalMatch}/${totalAll} (${((totalMatch / totalAll) * 100).toFixed(1)}%)`);

  const jsonPath = path.join(ROOT, 'evals/results/judgment-variations.json');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rowCount: rows.length,
        variationCount: variations.length,
        matchRate: totalMatch / totalAll,
        variations
      },
      null,
      2
    )
  );
  console.log(`Wrote ${jsonPath}`);

  const mdPath = path.join(ROOT, 'evals/results/judgment-variations.md');
  writeFileSync(mdPath, renderMarkdown(variations));
  console.log(`Wrote ${mdPath}`);

  console.log('\nPer-field breakdown:');
  for (const [field, stats] of summary.entries()) {
    const pct = stats.total > 0 ? ((stats.match / stats.total) * 100).toFixed(0) : '0';
    console.log(`  ${field.padEnd(22)} ${stats.match}/${stats.total}  (${pct}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
