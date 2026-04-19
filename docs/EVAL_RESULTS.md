# Eval Results

This document collects the accuracy and latency evidence that is currently checked into the repository, plus one live stage-timing probe run executed locally on 2026-04-19 via [`scripts/stage-timings.ts`](../scripts/stage-timings.ts).

The main point of this page is provenance. Some configuration names only survive in the historical README and inline comments; others have full per-label logs under `docs/evals/`. This document keeps those sources separate.

Related documents:

- [docs/ARCHITECTURE_AND_DECISIONS.md](./ARCHITECTURE_AND_DECISIONS.md)
- [docs/GOVERNMENT_WARNING.md](./GOVERNMENT_WARNING.md)
- [docs/REGULATORY_MAPPING.md](./REGULATORY_MAPPING.md)

## 1. Evidence Sources

There are three different evaluation surfaces in the repo.

1. **Historical configuration summary** in the older README and inline source comments. This is where the Baseline / A / B / C / D / E / F / B2 / H naming comes from.
2. **Checked-in single-label and batch run logs** under [`docs/evals/`](./evals/), especially the 2026-04-17 experiment sweep.
3. **Structured result JSON** under [`evals/results/`](../evals/results/), including:
   - remote single-label corpus runs
   - cloud vs local batch-style runs
   - synthetic variation results

## 2. Historical Configuration Comparison

The following table is the repository's own configuration summary as recorded in the pre-update README and related experiment notes. It is useful because it compares the named configurations directly, but not every row has a one-to-one standalone log artifact.

| Config | Description | Correct | Approve | Reject | Avg latency | Provenance |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Baseline | pre-pivot multi-stage baseline | 23/28 | 8 | 5 | 7.0s | historical README summary |
| A | cleaned-up multi-stage baseline | 23/28 | 10 | 5 | 5.2s | historical README summary |
| B | A + one-directional LLM resolver | 23/28 | 9 | 5 | 4.9s | historical README summary |
| C | resolver on all review rows | 22/28 | 8 | 6 | 5.2s | historical README summary |
| D | simple single-VLM pipeline | 20/28 | 8 | 8 | 6.5s | historical README summary |
| E | simple pipeline, no resolver | 18/28 | 8 | 10 | 5.7s | historical README summary |
| F | simple + few-shot + resolver | 23/28 | 11 | 5 | 9.0s | historical README summary |
| B2 | B + warning-validator fuzzy handling | 27/28 | 9 | 1 | 5.2s | historical README summary |
| H | B2 + expanded VLM trust + 2-of-3 warning vote | 26/28 | 12-14 | 2 | 4.9s | historical README summary + `src/server/extraction-merge.ts` comments |

### What this table says architecturally

- D and E prove that removing the reconciler was a bad trade.
- C proves that letting the resolver touch too much of the pipeline regressed outcomes.
- F is the batch candidate: more approvals, higher latency.
- B2 and H show that the warning path, not just the extractor, is the decisive architecture lever.

## 3. Artifact-Backed 2026-04-17 Single-Label Sweep

These rows are backed by checked-in run logs under [`docs/evals/`](./evals/).

| Run artifact | Correct | Approve | Review | Reject | Avg | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `2026-04-17-latency-opt-baseline.txt` | 25/28 | 12 | 13 | 3 | 5.4s | 6.5s | 7.5s | 7.9s |
| `2026-04-17-latency-opt-opt1.txt` | 27/28 | 12 | 15 | 1 | 5.0s | 6.2s | 7.3s | 7.3s |
| `2026-04-17-latency-opt-opt3.txt` | 26/28 | 12 | 14 | 2 | 5.1s | 5.9s | 8.2s | 9.3s |
| `2026-04-17-latency-opt-opt4v2.txt` | 27/28 | 10 | 17 | 1 | 8.1s | 7.5s | 16.9s | 25.4s |
| `2026-04-17-latency-opt-opt4v2b.txt` | 26/28 | 13 | 13 | 2 | 5.2s | 6.3s | 7.7s | 8.1s |
| `2026-04-17-latency-opt-opt5-sealed-verdict.txt` | 27/28 | 12 | 15 | 1 | 6.0s | 6.3s | 12.3s | 16.4s |
| `2026-04-17-latency-opt-opt5b-sealed-verdict.txt` | 24/28 | 10 | 14 | 4 | 5.4s | 6.4s | 8.1s | 8.4s |
| `2026-04-17-final-verification-single-label-run1.txt` | 24/28 | 10 | 14 | 4 | 5.6s | 6.0s | 10.3s | 19.5s |
| `2026-04-17-final-verification-single-label-run2.txt` | 24/28 | 10 | 14 | 4 | 6.4s | 6.1s | 8.4s | 38.1s |
| `2026-04-17-final-verification-single-label-run3.txt` | 27/28 | 13 | 14 | 1 | 4.5s | 5.5s | 7.1s | 7.4s |
| `2026-04-17-consolidated-single-label-with-retries.txt` | 26/28 | 14 | 12 | 2 | 6.6s | 6.3s | 16.7s | 23.5s |
| `2026-04-17-consolidated-single-label-clean-28-of-28.txt` | 28/28 | 17 | 11 | 0 | 5.6s | 6.3s | 10.5s | 10.9s |
| `2026-04-17-cola-cloud-all-production-run.txt` | 27/28 | 9 | 18 | 1 | 5.2s | 5.8s | 9.5s | 10.3s |
| `2026-04-17-opts-v2-final-single-label.txt` | 26/28 | 11 | 15 | 2 | 5.4s | 6.3s | 7.9s | 8.5s |
| `2026-04-17-opts-v2-streaming-run1.txt` | 24/28 | 10 | 14 | 4 | 5.2s | 5.8s | 7.9s | 8.1s |
| `2026-04-17-opts-v2-streaming-run2.txt` | 26/28 | 11 | 15 | 2 | 5.7s | 6.3s | 11.2s | 11.5s |

### Read the sweep correctly

The best and worst runs are both informative.

- Best case: `28/28` on the clean consolidated run
- Stable production-like case: `27/28` at `5.2s` average
- Worst warning-regression cases: the 24/28 runs with 4 rejects

This is a stochastic pipeline. The goal is not one magic run; it is reducing the spread and especially reducing false rejects.

## 4. Recurring False-Reject Families

The prompt asked for the five false rejects. The checked-in evidence does not point to one canonical set of five in a single final run. Instead, the 2026-04-17 sweep shows five recurring false-reject families that dominate the regressions.

| Label | Seen in checked-in runs | Failing checks on reject runs | Dominant root cause | Current status |
| --- | --- | --- | --- | --- |
| `harpoon-ale-malt-beverage` | almost every regressed run; still the lone reject in the production run | `government-warning:fail`, sometimes plus address/country review | wraparound or unstable warning read | still the hardest warning case |
| `pleasant-prairie-brewing-peach-sour-ale-malt-beverage` | baseline, retries, final-verification runs, opt4v2b, opt5, opt5b, streaming | warning fail plus sometimes applicant-address or class review | warning variance on noisy small-text label | mostly softened by better warning handling |
| `drekker-brewing-company-piano-necktie-malt-beverage` | baseline, final-verification runs, opt5b, streaming | warning fail, sometimes address review | warning variance | improved but still appears in regressed runs |
| `pilok-broumy-malt-beverage` | final-verification run1, opt3, opt4v2b, opt5b, streaming-run2 | warning fail plus brand/class/country review | warning fail on a label that is already extraction-hard | remains a stress case |
| `1840-original-lager-1840-original-lager-malt-beverage` | final-verification run2, `opts-v2-final-single-label` | warning fail plus brand review | warning instability on a compact beer label | appears intermittently, not in best runs |

### The pattern behind all five

These five are not a random mix of rule bugs. They are overwhelmingly warning-driven.

That is why the most valuable architecture changes were:

- fuzzy warning handling
- 2-of-3 vote across warning readers
- downgrade paths for "not in this photo" and low-confidence warning evidence

## 5. Per-Stage Latency Breakdown

The review route emits an `X-Stage-Timings` header from [`src/server/register-review-routes.ts`](../src/server/register-review-routes.ts). The repository ships the probe script but not a committed timing snapshot, so the following table comes from a local run on 2026-04-19 against the running API via [`scripts/stage-timings.ts`](../scripts/stage-timings.ts).

| Label | Total | provider-wait | ocr-prepass | warning-ocv | deterministic-validation | Notable extra |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| simply-elegant-bourbon | 5075ms | 4016ms | 585ms | 1054ms | 2ms | spirits-colocation 1034ms |
| harpoon-ale | 9005ms | 4557ms | 1072ms | 799ms | 6ms | llm-judgment 927ms on the probed server instance |
| leitz-rottland-wine | 4348ms | 4344ms | 303ms | 779ms | 0ms | report-shaping 1ms |
| manzone-barolo-wine | 3734ms | 3729ms | 315ms | 1015ms | 0ms | report-shaping 2ms |
| persian-empire-arak | 5128ms | 3907ms | 298ms | 1100ms | 0ms | spirits-colocation 1219ms |

### What the timing table proves

- deterministic validation is functionally free compared with model calls
- warning OCV is measurable but bounded
- optional post-extraction AI work such as spirits colocation and legacy judgment is the main tail-latency contributor after provider wait

That is the strongest latency argument for the design: the rule engine adds domain depth at millisecond cost.

## 6. Model Comparison

The repository has strong evidence for Gemini Flash Lite and the local Qwen/Ollama path. It has support code for other providers, but not the same level of checked-in corpus evidence for all of them.

| Model / provider path | Role in repo | Artifact-backed result | What to conclude |
| --- | --- | --- | --- |
| Gemini 2.5 Flash Lite | default cloud extractor | production run `27/28`, `9 approve`, `1 reject`, `5.2s avg` in `docs/evals/2026-04-17-cola-cloud-all-production-run.txt` | current default |
| Gemini full-field judgment layer | legacy judgment-on experiment | `10 pass / 13 review / 4 fail / 1 error`, `5.0s avg` in `evals/results/2026-04-16-cloud-with-judgment-fixed.json` | do not use as final judge |
| Qwen2.5-VL-3B via Ollama | local extractor | `12 pass / 16 review / 0 fail`, `5433ms avg/item` in `evals/results/2026-04-16-local-fullarch-nojudge.json` | viable self-hosted path with conservative review behavior |
| Gemini 2.5 Flash (non-Lite) | supported by extractor tests | no standalone checked-in corpus comparison table in repo | supported, not fully documented by eval artifacts here |
| Claude | not implemented as a first-class extractor in the checked-in runtime | no checked-in corpus result | not evidenced in this repository |

### Why the local Qwen result matters

The local no-judgment run is important not because it beats the cloud run on raw correctness. It matters because it produced:

- `12` approvals
- `16` reviews
- `0` rejects

That is exactly the safety profile a government-hosted fallback wants during early deployment: fewer unsafe hard calls, more escalation to humans, same deterministic validation engine.

## 7. Synthetic Variation Results

The synthetic harness in [`evals/results/judgment-variations.json`](../evals/results/judgment-variations.json) is not a substitute for real labels, but it is extremely useful for validating the judge functions.

| Field | Match rate |
| --- | ---: |
| brand-name | 234/234 (100.0%) |
| class-type | 140/142 (98.6%) |
| alcohol-content | 110/115 (95.7%) |
| net-contents | 81/108 (75.0%) |
| country-of-origin | 37/37 (100.0%) |
| government-warning | 140/168 (83.3%) |
| applicant-address | 4/5 (80.0%) |
| varietal | 30/30 (100.0%) |
| vintage | 20/20 (100.0%) |

### What these numbers reveal

- brand, country, varietal, and vintage logic are strong and stable
- net contents still has known edge cases around conversion and rounding
- warning behavior is intentionally conservative but still leaves headroom for better handling of partial deletions
- address identity remains a review-heavy problem by design

## 8. Expanded Trust Tier Analysis

The expanded trust tier is documented most clearly in [`src/server/extraction-merge.ts`](../src/server/extraction-merge.ts).

Key inline note:

- promoting additional VLM-trusted fields produced **+5 structural approvals**
- the early **-3 warning regressions** were attributed to warning variance, not to the expanded-trust decision itself

That distinction matters. The lesson from Config G / H is not "trust the VLM more everywhere." It is:

1. trust the VLM more on decorative text fields where it is genuinely stronger than OCR
2. never let that trust extend to the warning without a separate stabilizing mechanism

That is why the shipped direction combines expanded field trust **with** the 2-of-3 warning vote.

## 9. Config F As A Batch-Mode Variant

Config F is the one configuration in the historical summary that is clearly optimized for Janet's workflow rather than Sarah's single-label latency budget.

Historical recorded outcome:

- `23/28` correct
- `11` approvals
- `5` rejects
- `9.0s` average latency

That makes sense:

- few-shot prompting can rescue some borderline equivalence cases
- the cost is too high for interactive single-label use
- batch processing can afford that cost if total touched labels goes down

The repo does not currently ship a named "batch mode uses Config F" toggle, but the experiment result is still strategically useful.

## 10. Bottom Line

The evaluation evidence supports five conclusions.

1. **The OCR reconciler is load-bearing.** Simple single-VLM variants were worse.
2. **The warning architecture is load-bearing.** Most false rejects are warning-driven.
3. **The one-directional resolver is the right LLM pattern.** The old judgment layer regressed.
4. **Deterministic validation is effectively free.** The latency budget lives in extraction and optional post-extraction AI calls.
5. **The local path is viable.** It stays conservative, shares the same rule engine, and avoids false rejects on the recorded local corpus run.
