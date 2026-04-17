/**
 * LLM uncertainty resolver — one-directional review→pass upgrader.
 *
 * Runs AFTER deterministic field judgments, BEFORE verdict rollup.
 *
 * Core constraints (designed to avoid the judgment-layer regression
 * we saw on 2026-04-16):
 *
 *   1. The LLM only sees fields that the deterministic cascade left
 *      at `status: 'review'` with `confidence < threshold`. Fields
 *      that already resolved to pass or fail are never forwarded.
 *
 *   2. The LLM can ONLY output `equivalent | uncertain`. The prompt
 *      and parsing layer both refuse any other token. It has no
 *      `reject` / `non-compliant` / `downgrade` capability.
 *
 *   3. On `equivalent`, we upgrade the check to `pass` but cap its
 *      confidence at `LLM_RESOLVER_CONFIDENCE_CAP` (default 0.82).
 *      This keeps the check below the 0.90 auto-approve gate that
 *      `deriveWeightedVerdict` uses for standalone reviews, so the
 *      overall label verdict remains "assisted" rather than a silent
 *      auto-approve. The human reviewer sees the LLM-tagged detail.
 *
 *   4. One batched call per label, not one per field. Zero ambiguous
 *      fields means zero LLM calls and zero added latency.
 *
 *   5. The resolver is NEVER invoked on fields whose domain is
 *      arithmetic or regulatory-exact: ABV, net contents, government
 *      warning text, vintage year. Those must stay fully deterministic.
 *
 * Feature flag: `LLM_RESOLVER=enabled`. Default is off so the existing
 * pipeline is unchanged.
 */

import type { CheckReview } from '../shared/contracts/review';

type JudgmentLlmClient = {
  complete: (system: string, user: string) => Promise<string>;
};

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
const LLM_CONFIDENCE_CAP = 0.82;
// 2s cap: the resolver is strictly additive (can only upgrade review→pass),
// so bailing out on timeout is safe — we keep the deterministic reviews
// as-is rather than blowing the latency budget. Prior value was 3000ms,
// which let a single slow resolver call add ~3.4s to harpoon-ale wall.
const RESOLVER_TIMEOUT_MS = 2000;

// Field IDs that MAY be forwarded to the LLM when ambiguous. These are
// the fields where taxonomies and alias tables leave a long tail that
// a language model can meaningfully resolve (see judgment-guidance.md).
const ELIGIBLE_FIELD_IDS = new Set<string>([
  'brand-name',
  'class-type',
  'applicant-address',
  'country-of-origin',
  'varietal'
]);

// Field IDs that MUST remain deterministic. Listed here only as
// documentation — any field not in ELIGIBLE_FIELD_IDS is already
// excluded by the positive allowlist above. Kept for readers.
//
//   - alcohol-content      (arithmetic, tax-boundary logic)
//   - net-contents         (unit conversion + tolerance)
//   - government-warning   (27 CFR 16.21 canonical text)
//   - vintage              (year exact match)

export type ResolverConfig = {
  enabled: boolean;
  threshold: number;
  client: JudgmentLlmClient | null;
};

export function readResolverConfig(
  env: Record<string, string | undefined> = process.env
): Omit<ResolverConfig, 'client'> {
  const enabled = env.LLM_RESOLVER?.trim().toLowerCase() === 'enabled';
  const raw = env.LLM_RESOLVER_THRESHOLD?.trim();
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  const threshold =
    Number.isFinite(parsed) && parsed > 0 && parsed <= 1
      ? parsed
      : DEFAULT_CONFIDENCE_THRESHOLD;
  return { enabled, threshold };
}

type AmbiguousCandidate = {
  index: number;
  fieldId: string;
  label: string;
  applicationValue: string;
  extractedValue: string;
};

export async function resolveAmbiguousFieldChecks(input: {
  checks: CheckReview[];
  config: ResolverConfig;
}): Promise<{
  checks: CheckReview[];
  resolved: number;
  skipped: 'disabled' | 'no-client' | 'nothing-ambiguous' | 'llm-error' | null;
}> {
  const { checks, config } = input;

  if (!config.enabled) {
    return { checks, resolved: 0, skipped: 'disabled' };
  }
  if (!config.client) {
    return { checks, resolved: 0, skipped: 'no-client' };
  }

  const candidates: AmbiguousCandidate[] = [];
  checks.forEach((check, index) => {
    if (!ELIGIBLE_FIELD_IDS.has(check.id)) return;
    if (check.status !== 'review') return;
    if (check.confidence >= config.threshold) return;
    if (!check.applicationValue || !check.extractedValue) return;
    candidates.push({
      index,
      fieldId: check.id,
      label: check.label,
      applicationValue: check.applicationValue,
      extractedValue: check.extractedValue
    });
  });

  if (candidates.length === 0) {
    return { checks, resolved: 0, skipped: 'nothing-ambiguous' };
  }

  let decisions: ReadonlyArray<'equivalent' | 'uncertain'>;
  try {
    decisions = await queryResolver(config.client, candidates);
  } catch {
    // LLM unavailable / timeout / malformed response — the deterministic
    // review state is the safe default.
    return { checks, resolved: 0, skipped: 'llm-error' };
  }

  if (decisions.length !== candidates.length) {
    return { checks, resolved: 0, skipped: 'llm-error' };
  }

  const patched = [...checks];
  let resolved = 0;
  candidates.forEach((candidate, i) => {
    if (decisions[i] !== 'equivalent') return;
    const original = patched[candidate.index];
    if (!original) return;
    patched[candidate.index] = {
      ...original,
      status: 'pass',
      severity: 'note',
      confidence: Math.min(original.confidence, LLM_CONFIDENCE_CAP),
      summary: 'Label matches the approved record (LLM-assisted).',
      details: `${original.details}\n\n[LLM-assisted] The language model confirmed the application and label values refer to the same thing despite formatting differences. Confidence capped at ${LLM_CONFIDENCE_CAP} so a human can still verify if desired.`
    };
    resolved += 1;
  });

  return { checks: patched, resolved, skipped: null };
}

async function queryResolver(
  client: JudgmentLlmClient,
  candidates: readonly AmbiguousCandidate[]
): Promise<ReadonlyArray<'equivalent' | 'uncertain'>> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(candidates);
  const raceTimeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('resolver timeout')),
      RESOLVER_TIMEOUT_MS
    )
  );
  const rawText = await Promise.race([client.complete(system, user), raceTimeout]);
  return parseResolverResponse(rawText, candidates.length);
}

function buildSystemPrompt(): string {
  return [
    'You are a comparison assistant for TTB alcohol label review.',
    '',
    'Your ONLY job: decide whether each (application value, label value) pair',
    'refers to the same thing despite differences in formatting, language,',
    'punctuation, legal vs trade naming, or regional convention.',
    '',
    'You DO NOT assess regulatory compliance. You DO NOT cite 27 CFR.',
    'You DO NOT decide whether a value is acceptable on a label.',
    'You DO NOT flag anything as wrong. If you are unsure, say "uncertain".',
    '',
    'Allowed outputs per item: "equivalent" or "uncertain". Nothing else.',
    '',
    'Examples of EQUIVALENT:',
    '  - class/type: "Table White Wine" vs "SEMILLON" (varietal is a valid',
    '    label designation for a table white wine)',
    '  - brand: "The Wine Trust" vs "Wine Trust" (definite article)',
    '  - country: "USA" vs "United States of America"',
    '  - address: "100 First St, Portland, OR 97209" vs "Portland, OR"',
    '',
    'Examples of UNCERTAIN (when truly ambiguous):',
    '  - brand: "Lake Placid" vs "Adirondack Brewing Co" with no other signal',
    '  - class/type: "Vodka" vs "Tequila"',
    '',
    'Respond with JSON ONLY. Shape:',
    '{ "results": [{ "index": 0, "decision": "equivalent" }, ...] }',
    'One entry per item, in order. Do not wrap in markdown.'
  ].join('\n');
}

function buildUserPrompt(candidates: readonly AmbiguousCandidate[]): string {
  const lines: string[] = [
    'Compare these field pairs. For each, output "equivalent" or "uncertain".',
    ''
  ];
  candidates.forEach((c, i) => {
    lines.push(
      `${i}. ${c.label} — application: ${JSON.stringify(
        c.applicationValue
      )} | label: ${JSON.stringify(c.extractedValue)}`
    );
  });
  lines.push('');
  lines.push('Return JSON only.');
  return lines.join('\n');
}

function parseResolverResponse(
  raw: string,
  expected: number
): ReadonlyArray<'equivalent' | 'uncertain'> {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as unknown;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { results?: unknown }).results)
  ) {
    throw new Error('resolver response missing results array');
  }
  const results = (parsed as { results: Array<unknown> }).results;
  const ordered: Array<'equivalent' | 'uncertain'> = new Array(expected).fill(
    'uncertain'
  );
  for (const entry of results) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { index?: unknown }).index !== 'number'
    ) {
      continue;
    }
    const idx = (entry as { index: number }).index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= expected) continue;
    const decision = (entry as { decision?: unknown }).decision;
    if (decision === 'equivalent') {
      ordered[idx] = 'equivalent';
    }
    // Any other value (including "uncertain", "reject", "non-compliant",
    // garbage) stays as "uncertain". The LLM physically cannot downgrade
    // a check.
  }
  return ordered;
}
