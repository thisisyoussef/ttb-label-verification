# TTB-EVAL-001 Batch Real Corpus Run

Date: 2026-04-15
Runner: `npx tsx scripts/evals/run-cola-cloud-batch-fixtures.ts`
Fixture manifest: `evals/batch/cola-cloud/manifest.json`
Raw output: `evals/results/2026-04-15-TTB-EVAL-001-batch-real-corpus.json`

## Corpus summary

- Real COLA Cloud positive slice: 28 checked-in labels (`G-41` through `G-68`)
- Supplemental negative slice: 7 derived fixtures (`G-69` through `G-75`)
- Batch packs executed: 8

## What is captured now

The batch result JSON is no longer verdict-only. For each row it now records:

- expected fixture recommendation
- fixture source and expected field values
- report id
- extraction quality state
- verdict secondary reason
- report summary
- check-level field comparisons for:
  - `brand-name`
  - `class-type`
  - `alcohol-content`
  - `net-contents`
- rule-check summaries for:
  - `government-warning`
  - `abv-format-permitted`
  - `vintage-requires-appellation`
  - `same-field-of-vision`

This makes the output suitable for extraction and validator tuning, not just verdict counting.

## Run summary

| Set | Rows | Pass | Review | Fail | Error |
| --- | ---: | ---: | ---: | ---: | ---: |
| `cola-cloud-all` | 28 | 0 | 16 | 12 | 0 |
| `cola-cloud-spirits` | 9 | 0 | 5 | 3 | 1 |
| `cola-cloud-wine` | 10 | 0 | 9 | 1 | 0 |
| `cola-cloud-malt` | 9 | 0 | 3 | 6 | 0 |
| `cola-cloud-mixed` | 3 | 0 | 3 | 0 | 0 |
| `supplemental-negative` | 7 | 0 | 5 | 2 | 0 |
| `supplemental-negative-reject` | 5 | 0 | 3 | 1 | 1 |
| `cola-cloud-mixed-negative` | 6 | 0 | 5 | 1 | 0 |

## Field-level metrics

### `cola-cloud-all`

| Check | Rows | Extracted present | Exact/cosmetic match | Value mismatch | Pass | Review | Fail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `brand-name` | 27 | 27 | 13 | 14 | 2 | 25 | 0 |
| `class-type` | 27 | 25 | 0 | 27 | 0 | 27 | 0 |
| `alcohol-content` | 26 | 19 | 5 | 20 | 2 | 24 | 0 |
| `net-contents` | 27 | 18 | 7 | 20 | 3 | 24 | 0 |

### `cola-cloud-spirits`

| Check | Rows | Extracted present | Exact/cosmetic match | Value mismatch | Pass | Review | Fail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `brand-name` | 8 | 8 | 3 | 5 | 1 | 7 | 0 |
| `class-type` | 8 | 8 | 0 | 8 | 0 | 8 | 0 |
| `alcohol-content` | 8 | 8 | 4 | 4 | 0 | 8 | 0 |
| `net-contents` | 8 | 7 | 3 | 5 | 3 | 5 | 0 |

### `cola-cloud-wine`

| Check | Rows | Extracted present | Exact/cosmetic match | Value mismatch | Pass | Review | Fail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `brand-name` | 9 | 9 | 6 | 3 | 2 | 7 | 0 |
| `class-type` | 9 | 9 | 0 | 9 | 0 | 9 | 0 |
| `alcohol-content` | 9 | 4 | 0 | 9 | 0 | 9 | 0 |
| `net-contents` | 9 | 1 | 1 | 8 | 0 | 9 | 0 |

### `cola-cloud-malt`

| Check | Rows | Extracted present | Exact/cosmetic match | Value mismatch | Pass | Review | Fail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `brand-name` | 9 | 9 | 3 | 6 | 0 | 9 | 0 |
| `class-type` | 9 | 9 | 0 | 9 | 0 | 9 | 0 |
| `alcohol-content` | 8 | 7 | 1 | 6 | 2 | 6 | 0 |
| `net-contents` | 9 | 9 | 2 | 7 | 0 | 9 | 0 |

## Rule-level metrics

### `cola-cloud-all`

| Rule | Rows | Pass | Review | Fail | Info |
| --- | ---: | ---: | ---: | ---: | ---: |
| `government-warning` | 27 | 0 | 15 | 12 | 0 |
| `abv-format-permitted` | 8 | 8 | 0 | 0 | 0 |
| `vintage-requires-appellation` | 7 | 7 | 0 | 0 | 0 |
| `same-field-of-vision` | 9 | 0 | 9 | 0 | 0 |

### `supplemental-negative`

| Rule | Rows | Pass | Review | Fail | Info |
| --- | ---: | ---: | ---: | ---: | ---: |
| `government-warning` | 6 | 0 | 5 | 1 | 0 |
| `abv-format-permitted` | 3 | 2 | 0 | 1 | 0 |
| `vintage-requires-appellation` | 1 | 1 | 0 | 0 | 0 |
| `same-field-of-vision` | 1 | 0 | 1 | 0 | 0 |

## High-signal findings

1. **This is now detailed enough to tune extraction, not just verdicts**
   The per-row JSON includes expected values, extracted values, and comparison outcomes, so you can inspect exactly where rows drift.

2. **Brand extraction is mixed, class extraction is systematically poor**
   In the full positive pack, `brand-name` has 13 of 27 exact/cosmetic matches, while `class-type` has 0 of 27.

3. **Net contents extraction is especially weak on wine**
   In the wine-only pack, `net-contents` was extracted on only 1 of 9 scored rows.

4. **Government warning is the main reject driver**
   In the full positive pack, `government-warning` returned 12 fails and 15 reviews, with zero passes.

5. **Same-field-of-vision remains intentionally unresolved**
   Distilled spirits rows still land in `review` for `same-field-of-vision`, which means those rows cannot currently auto-approve even when extraction is otherwise decent.

6. **Negative separation is now inspectable at the rule level**
   The reject-style negative pack did not cleanly separate because warning-based edits often still degraded to `review`, while ABV-format and some overprint/occlusion cases reached `fail`.

## Example row-level diagnosis

`persian-empire-black-widow-distilled-spirits.webp`

- expected brand: `Persian Empire`
- extracted brand: `Black Widow`
- expected class: `other specialties & proprietaries`
- extracted class: `SPIRITS DISTILLED FROM GRAPES AND RAISINS`
- alcohol content: cosmetic-only mismatch (`40% Alc./Vol.` vs `40% ALC/VOL`)
- net contents: exact match
- warning: `review`
- same-field-of-vision: `review`
- final outcome: `review`

This is a good example of why the richer artifact matters: the row is not just “review”; it is specifically a brand/class extraction miss plus unresolved warning/spatial checks.
