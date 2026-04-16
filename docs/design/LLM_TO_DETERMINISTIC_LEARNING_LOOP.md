# LLM → Deterministic Learning Loop (Future Plan)

Status: **Planned, not implemented.** Proposed by user on 2026-04-16.

## Motivation

Every time the LLM judgment layer fires on an ambiguous field comparison, it costs 300-700ms and an API/GPU call. If the LLM keeps being asked the same question ("is 'Czechia' equivalent to 'Czech Republic'?"), that's wasted latency and cost.

The insight: LLM judgment outputs a structured decision with a *rule name* (`ruleApplied`) and *normalized inputs*. That's already a deterministic equivalence: for (fieldId, appValue, extValue) → disposition. We can cache this and upgrade it into the deterministic tier.

## Target architecture

Today's tiers:

```
Tier 1  deterministic normalizers + equivalence tables (instant)
Tier 2  LLM judgment (300-700ms, per-field segmented)
Tier 3  human review queue
```

Future tiers with the learning loop:

```
Tier 1a  deterministic normalizers (static)
Tier 1b  learned-equivalence cache (instant, grows from Tier 2 decisions)
Tier 2   LLM judgment (fires only on cache misses)
Tier 3   human review queue
Tier 4   cache eviction + review by a human when a learned equivalence
         is overridden or starts losing accuracy on newer evals
```

## How it works

### Cache entry shape

```ts
type LearnedEquivalence = {
  fieldId: string;                  // 'country-of-origin', 'applicant-address', etc.
  appNormalized: string;            // lowercased + stripped punctuation
  extNormalized: string;            // lowercased + stripped punctuation
  disposition: 'approve' | 'review' | 'reject';
  confidence: number;               // from the LLM's calibrated output
  ruleApplied: string;              // 'country-alternate-official-name', 'address-city-state-match', ...
  source: 'llm-judgment';
  llmModel: string;                 // e.g. 'gemini-2.5-flash-lite' or 'qwen2.5:1.5b-instruct'
  firstSeenAt: string;              // ISO timestamp
  hitCount: number;                 // incremented each time this equivalence matches
  lastUsedAt: string;               // for LRU eviction
};
```

### Lookup path (fast case)

```ts
function lookupLearnedEquivalence(
  fieldId: string,
  appValue: string,
  extValue: string
): LearnedEquivalence | null {
  const appNorm = runNormalizationPipeline(appValue).appNormalized;
  const extNorm = runNormalizationPipeline(extValue).extNormalized;
  const key = `${fieldId}:${appNorm}:${extNorm}`;
  return cache.get(key) ?? null;
}
```

Cache hit → skip the LLM call entirely. Apply the cached disposition like a deterministic rule.

### Write path (after each LLM judgment)

```ts
// inside judgment-llm-executor.ts, after parsing the LLM response
if (judgment.disposition === 'APPROVE' && judgment.confidence >= 0.85) {
  // High-confidence approve is safe to memoize; reject and review are NOT
  // memoized (we want humans to revisit borderlines).
  cache.set({
    fieldId: check.id,
    appNormalized: normApp,
    extNormalized: normExt,
    disposition: 'approve',
    confidence: judgment.confidence,
    ruleApplied: judgment.ruleApplied,
    source: 'llm-judgment',
    llmModel: clientModelName,
    firstSeenAt: now,
    hitCount: 1,
    lastUsedAt: now
  });
}
```

**Only memoize APPROVEs** at confidence ≥ 0.85. Never memoize REJECT (regulatory risk) or REVIEW (ambiguity we want humans to see).

### Cache storage options

| Option | Pros | Cons |
|--------|------|------|
| **In-memory** | fast, no deps | lost on restart, per-process only |
| **Local JSON file** | persists, inspectable, diff-able | file I/O on hot path |
| **SQLite** | queryable, indexed | adds a dep |
| **Redis** | shared across replicas | ops cost, network |
| **Git-tracked static file** | auditable, reviewable via PR | needs human to commit periodically |

Recommendation for v1: **Local JSON file** at `evals/learned-equivalences.json`. Keep it small (top 500 entries by hit count). Load on startup, write-through on each new equivalence, debounce writes to batch ~50 at a time.

**For production scale**: Redis with TTL, backed by the JSON file for cold-start.

### Git-tracked audit trail

Export the cache periodically (nightly cron / CI) as a Git-tracked JSON file that reviewers can inspect in PRs. This gives:

- **Auditability** — every approved equivalence has a paper trail
- **Rollback** — if a wrong equivalence slips in (LLM made a mistake), revert the file
- **Static upgrade path** — popular equivalences can be moved from the learned cache to the hand-curated tables in `judgment-equivalence.ts`

## Guardrails

1. **Never memoize REJECT or REVIEW.** Those require human oversight. REJECT memoization would be catastrophic if the LLM was wrong.

2. **Confidence floor.** Only memoize at `confidence >= 0.85`. The LLM's own calibration signals whether it was sure.

3. **Field allow-list.** Start with `country-of-origin` and `applicant-address` (low-risk, high-variability). Do NOT memoize `alcohol-content`, `government-warning`, or `class-type` — those are regulatory-critical.

4. **Cache invalidation triggers:**
   - Eval regression: if a new eval run shows an accuracy drop attributable to a cached equivalence, drop the entry
   - Manual override: reviewers can delete entries via PR
   - Low hit rate: entries with hitCount < 3 after 30 days get GC'd (maybe they were one-offs)
   - LLM model change: when the upstream model version changes, wipe the cache and rebuild

5. **Poisoning defense:** The LLM must be the only writer. User-supplied data cannot directly populate the cache (prevents an adversary from feeding in a malicious label that learns a bad equivalence).

6. **Telemetry:** Log `cache-hit` vs `cache-miss` rates. If hit rate is below 5% after a month, the cache is probably wasteful; shelve it.

## Expected impact

- **Latency:** Cache hits save 300-700ms. If 40% of country/address judgments hit the cache after a warmup period, p95 drops ~150-300ms on those fields.
- **Cost:** Cloud mode: saves LLM API spend on repeat cases. Local mode: frees GPU for other work.
- **Accuracy:** Essentially unchanged — the cache stores what the LLM already decided. Marginal risk of a wrong LLM output getting cached and stuck (mitigated by the guardrails above).

## Why not just expand the static tables in `judgment-equivalence.ts`?

Two reasons:

1. **Coverage** — country/address variability is open-ended. Hand-curating a table would be a never-ending task and would stale over time.
2. **Drift** — once written, static tables rarely get updated. A learning cache grows organically with real traffic.

But **the cache and the static tables are complementary:** periodically, the most-hit cache entries get promoted into the static table (moving from learned to hand-curated), and the cache shrinks. The static table is the source of truth; the cache is the fast-moving edge.

## Implementation phases

**Phase 1 — Read-only observation (1-2 days)**
- Ship the cache data structure and the read path (lookup on Tier 1b).
- Wire the write path but gate it behind `LLM_LEARNING_CACHE=enabled`.
- Log cache-miss-that-would-have-hit to measure potential savings.
- No user-visible behavior change.

**Phase 2 — Active caching (1 day)**
- Flip the feature flag by default.
- Monitor hit rate and any accuracy regressions.
- Ship dashboards for hit/miss/saved-ms metrics.

**Phase 3 — Audit trail (1 day)**
- Nightly export of the cache to `evals/learned-equivalences.json`.
- PR bot opens a weekly review PR summarizing new entries.
- Reviewers can delete entries or promote them to static tables.

**Phase 4 — Redis backing (optional, 1-2 days)**
- Only if we scale to multiple app replicas.
- Keep the JSON file as the cold-start seed.

## Open questions

- Does the cache key need the beverage type? (e.g., "ale" vs "IPA" is OK for malt but not for wine) — probably yes; add `beverageType` to the key.
- How do we handle LLM model upgrades? (A cached equivalence from `qwen2.5:1.5b` might not match `qwen2.5:3b` judgment.) — bump a cache generation number in the entry; invalidate old gens on upgrade.
- What's the interaction with local vs cloud mode? — they can share a cache (the field equivalence doesn't depend on which LLM decided it), but we should tag the source to diagnose if one model is generating more cache entries than the other.

## Success criteria

- Cache hit rate ≥ 30% on `country-of-origin` within 2 weeks of turn-on.
- P95 latency on country-of-origin judgment drops by at least 150ms.
- Zero accuracy regressions attributed to the cache in the next 3 eval runs.
- Reviewers can audit, edit, and roll back cache entries via PR in under 5 min.
