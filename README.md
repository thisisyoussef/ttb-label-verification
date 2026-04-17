# TTB Label Verification

A proof-of-concept assistant for **TTB alcohol label compliance review**. A reviewer uploads a label image plus the approved application data; the system extracts structured facts from the label, runs deterministic TTB compliance rules, and returns a verdict (**approve · review · reject**) with every decision backed by citations and evidence the human reviewer can audit.

**Live demo:** <https://ttb-label-verification-production-f17b.up.railway.app>
**Staging:** <https://ttb-label-verification-staging.up.railway.app>

---

## Why this architecture

Most "LLM reads a document" prototypes send the whole image to a VLM, trust whatever JSON comes back, and call the model's opinion a verdict. That shape fails the TTB domain on two axes:

1. **Regulatory decisions must cite regulations.** Approvals, rejections, and review calls need to map to 27 CFR, not a language model's impression.
2. **Language models hallucinate confidently.** A single noisy VLM read of a 260-character warning or a 40.3% → 46% ABV misread has real tax and compliance consequences.

This prototype solves both with a deliberate separation of responsibility:

```
┌────────────────────────────────────────────────────────────────┐
│  Input: label image + application CSV row                       │
└────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌────────────────────┐
│ Tesseract OCR    │ │ Warning region   │ │ Gemini VLM         │
│ prepass (full    │ │ OCV (cropped)    │ │ (schema-constrained│
│ image)           │ │                  │ │  JSON output)      │
│ ~500ms           │ │ ~3s              │ │ ~3–5s              │
└────────┬─────────┘ └────────┬─────────┘ └──────────┬─────────┘
         │                    │                      │
         └─── all three fire in parallel ───────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Stage 1 — Extraction reconciler (src/server/extraction-merge)   │
│                                                                  │
│  Field-by-field: route the read to its strongest reader.        │
│    • Decorative / stylized / dense text (brand, class/type,     │
│      fanciful, country, address, varietal, warning) →           │
│      trust the VLM, no cap.                                     │
│    • Numeric / regulatory-exact (ABV, net contents, vintage) →  │
│      Tesseract wins; VLM-only reads capped at 0.80 confidence   │
│      so downstream rules know they're unverified.                │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Stage 2 — Deterministic field judgments                          │
│ (src/server/judgment-field-rules)                                │
│                                                                  │
│  One judge function per field, each returning                   │
│  { disposition, confidence, rule, tier }.                        │
│                                                                  │
│  judgeBrandName · judgeClassType · judgeAlcoholContent ·        │
│  judgeNetContents · judgeApplicantAddress ·                     │
│  judgeCountryOfOrigin · judgeVarietal · judgeVintage            │
│                                                                  │
│  Every rule carries a CFR citation. ABV crosses a wine tax      │
│  boundary → reject, not review. Brand "Lake Placid" vs          │
│  "LAKE PLACID" → brand-case-only → approve. The LLM never       │
│  decides these — the rule engine does.                           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Stage 2a — Government warning: 2-of-3 vote                       │
│ (src/server/government-warning-vote)                             │
│                                                                  │
│  Three independent reads of the warning text:                   │
│    • VLM extraction                                              │
│    • OCV on the cropped warning region                           │
│    • Tesseract full-image cross-check                            │
│                                                                  │
│  Each votes pass / review / fail on fuzzy Levenshtein tiers.     │
│  2-of-3 passes → pass (similarity = 1.0). 2-of-3 fails →         │
│  fail (similarity = 0.0). Mixed → median. Zero single-signal    │
│  jitter can flip a label.                                        │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Stage 3 — LLM uncertainty resolver  (one-directional)            │
│ (src/server/llm-resolver)                                        │
│                                                                  │
│  Only fires when the deterministic cascade left a field at      │
│  status='review' AND confidence < 0.60, and only on fields      │
│  where taxonomies can't cover the long tail (brand, class,      │
│  address, country, varietal). Never on ABV, net contents,       │
│  warning, or vintage — those stay fully deterministic.           │
│                                                                  │
│  Output space is { equivalent, uncertain }. The LLM cannot      │
│  emit reject. It can only upgrade review → pass, with           │
│  confidence capped at 0.82 so the reviewer sees the upgrade     │
│  is LLM-assisted. One batched call per label; zero ambiguous    │
│  fields = zero LLM latency cost.                                 │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Stage 4 — Verdict rollup (src/server/judgment-scoring)           │
│                                                                  │
│  Weighted scoring with safety gates:                             │
│    • Any critical-tier reject → verdict = reject                 │
│    • Any remaining review / reject → verdict = review            │
│    • All pass & confidence ≥ gate → verdict = approve            │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    VerificationReport
           { verdict, checks[], counts, summary }
```

### What sets it apart

- **Seven TTB-required fields validated end-to-end** — brand name, class/type, alcohol content, net contents, name/address of bottler, country of origin (imports), government health warning — plus varietal & vintage for wines. Every one carries a 27 CFR citation.
- **Three independent reads of the government warning** instead of one, with a deterministic 2-of-3 vote. Run-to-run VLM noise on the 260-char warning text can't single-handedly flip a label between pass and fail.
- **LLM as a one-directional uncertainty resolver**, not a second opinion. It can upgrade ambiguous reviews to approvals after deterministic rules abstain; it can never reject, never downgrade. This is the pattern that recovered approval rates without the false-reject regression we saw from a naive "LLM judgment" layer.
- **Cloud/local-agnostic provider swap.** `AI_PROVIDER=cloud` routes extraction through Gemini; `AI_PROVIDER=local` routes through Ollama (Qwen2.5-VL). Judgment has its own swap (`LLM_JUDGMENT_PROVIDER`). Same `ReviewExtractor` interface, same downstream pipeline.
- **Privacy by construction.** `store:false` on every AI call, zero persistence on disk, everything in-memory, no label image or applicant data ever written to a database.

---

## Accuracy & latency — measured, not claimed

The 28-label `cola-cloud-all` corpus is real TTB-approved COLA labels with ground-truth application data. Here's the production run on today's architecture:

```
Remote eval against: http://127.0.0.1:8787
Slice: cola-cloud-all
────────────────────────────────────────────────────────────────────────────────
Loaded 28 cases

[ 1/28] persian-empire-black-widow-distilled-spirits  ✓ approve    5.3s
[ 2/28] persian-empire-arak-distilled-spirits         ✓ review     9.9s
[ 3/28] simply-elegant-simply-elegant-spirits-…       ✓ approve    9.8s
[ 4/28] crafy-elk-cranberry-blueberry-acai-…          ✓ review     8.5s
[ 5/28] leitz-rottland-wine                           ✓ review     8.2s
[ 6/28] leitz-magdalenenkreuz-wine                    ✓ review     4.7s
[ 7/28] leitz-klosterlay-wine                         ✓ review     3.3s
[ 8/28] uncorked-in-mayberry-otis-own-wine            ✓ approve    3.0s
[ 9/28] lake-placid-shredder-malt-beverage            ✓ review     3.7s
…
[27/28] 1840-original-lager-1840-original-lager-…     ✓ approve    8.1s
[28/28] harpoon-ale-malt-beverage                     ✗ reject     7.5s
────────────────────────────────────────────────────────────────────────────────
Result:   27/28 correct (96%)
Verdicts: 9 approve · 18 review · 1 reject · 0 error
Latency:  avg=5.2s  p50=5.8s  p95=9.5s  max=10.3s
```

Full log: [`docs/evals/2026-04-17-cola-cloud-all-production-run.txt`](docs/evals/2026-04-17-cola-cloud-all-production-run.txt)

### How we got here (measured across 8 configurations)

| Config | Change from previous | Correct | Approve | Reject | Avg latency |
|---|---|---:|---:|---:|---:|
| Baseline (pre-pivot) | multi-stage, no resolver | 23/28 | 8 | 5 | 7.0s |
| A | same, cleaned up | 23/28 | 10 | 5 | 5.2s |
| B | **+ LLM uncertainty resolver** | 23/28 | 9 | 5 | 4.9s |
| C | resolver on all reviews | 22/28 | 8 | 6 | 5.2s (regressed) |
| D | simple single-VLM pipeline | 20/28 | 8 | 8 | 6.5s (regressed) |
| E | simple, no resolver | 18/28 | 8 | 10 | 5.7s (regressed) |
| F | simple + few-shot + resolver | 23/28 | 11 | 5 | 9.0s |
| **B2** | **B + warning validator fuzzy match** | **27/28** | **9** | **1** | **5.2s** ✓ |
| H | B2 + expanded VLM trust + 2-of-3 vote | 26/28 | 12–14 | 2 | 4.9s |

**Configs B2 and H** (the shipped architecture) consistently deliver **26–27/28 correct** with **0–2 false rejects** and **avg ~5 seconds**. Earlier research-recommended variants (configs D, E, F — single-VLM pipelines) regressed to 18–23/28 on our corpus, so the OCR reconciler stayed.

The 859-variation synthetic test harness ([`scripts/judgment-variations.ts`](scripts/judgment-variations.ts)) gives an independent correctness view: every `judgeX` rule hit **92.7%** match against its expected disposition across generated legit / ambiguous / illegit perturbations.

---

## Running locally

### Requirements

- Node.js 20+ (Node 18 won't work — Vite 7 uses `crypto.hash`)
- npm 10+
- `GEMINI_API_KEY` in `.env` for the cloud track (Ollama is optional for local track)
- `tesseract` installed (`brew install tesseract` on macOS; `apt-get install tesseract-ocr tesseract-ocr-eng` on Linux) for the OCR pre-pass and warning OCV

### Quick start

```bash
npm install
cp .env.example .env          # add GEMINI_API_KEY
npm run dev                   # http://localhost:5176 (web) + :8787 (API)
```

### Running the golden eval locally

```bash
# 1. Start the API with the production-recommended env
AI_PROVIDER=cloud \
  LLM_JUDGMENT=disabled \
  LLM_RESOLVER=enabled \
  LLM_RESOLVER_THRESHOLD=0.60 \
  REGION_DETECTION=disabled \
  PORT=8787 \
  npm run dev:api

# 2. Run the 28-label corpus in another shell
BASE_URL=http://127.0.0.1:8787 npx tsx scripts/remote-eval.ts --slice=cola-cloud-all

# 3. Or run the synthetic rule harness (no server needed)
npx tsx scripts/judgment-variations.ts
```

### Feature flags (all optional)

| Flag | Default | Effect |
|---|---|---|
| `AI_PROVIDER` | `cloud` | `cloud` = Gemini, `local` = Ollama |
| `LLM_RESOLVER` | `disabled` | Enable the one-directional review→pass resolver |
| `LLM_RESOLVER_THRESHOLD` | `0.60` | Confidence ceiling that triggers the resolver |
| `LLM_JUDGMENT` | `disabled` | Old full-field judgment layer (regressed; kept for A/B) |
| `EXTRACTION_TRUSTED_TIER` | *expanded* | Set to `minimal` to revert to pre-Config-H VLM trust set |
| `EXTRACTION_PIPELINE` | multi-stage | Set to `simple` to skip the OCR reconciler |
| `EXTRACTION_FEW_SHOT` | `disabled` | Enable 3-shot prompt appendix |
| `REGION_DETECTION` | `disabled` | Opt-in per-field region detection (+4.5s latency, regressed on our corpus) |

---

## Where things live

```
src/
├── client/                       React 19 reviewer UI
├── server/
│   ├── llm-trace.ts              Pipeline orchestrator (parallel OCR + OCV + VLM)
│   ├── gemini-review-extractor.ts        Cloud VLM path
│   ├── ollama-vlm-review-extractor.ts    Local VLM path (swappable)
│   ├── extraction-merge.ts               Reconciler: VLM-trusted fields vs OCR-verified
│   ├── government-warning-validator.ts   Canonical 27 CFR 16.21/16.22 checks
│   ├── government-warning-vote.ts        2-of-3 vote across VLM + OCV + OCR
│   ├── government-warning-subchecks.ts   Presence, exact-text, heading, continuity, legibility
│   ├── judgment-field-rules.ts           Per-field judge functions + CFR rules
│   ├── llm-resolver.ts                   One-directional uncertainty resolver
│   ├── judgment-scoring.ts               Weighted verdict rollup with safety gates
│   └── review-report.ts                  Final VerificationReport builder
└── shared/contracts/             Zod schemas shared between client and server

evals/
├── labels/                       Real COLA-approved label images + manifests
├── results/                      Checked-in eval run artifacts
└── llm/                          Golden-case harness (vitest + LangSmith)

scripts/
├── remote-eval.ts                Run the 28-label corpus against any URL
├── judgment-variations.ts        859 synthetic tests of each judgeX rule
└── debug-warning-fail.ts         Single-label warning-check probe

docs/evals/                       Checked-in production eval logs
```

---

## Deployment

CI → Railway is fully automated via GitHub Actions ([`.github/workflows/railway-post-deploy.yml`](.github/workflows/railway-post-deploy.yml)):

- **Push to `main`** → CI → `railway-deploy` against the `staging` environment
- **`promote-production` workflow_dispatch** → copies `main` to `production` branch → CI → `railway-deploy` against the `production` environment

Build uses **Nixpacks** so `tesseract-ocr` and `tesseract-ocr-eng` are installed as APT packages at build time. Without them the pipeline degrades gracefully but loses the OCR reconciler signal (~35% of auto-approves).

---

## Additional docs

- [`docs/reference/submission-baseline.md`](docs/reference/submission-baseline.md) — assumptions register, evidence map, and open gaps
- [`docs/process/DEPLOYMENT_FLOW.md`](docs/process/DEPLOYMENT_FLOW.md) — full CI / Railway flow
- [`docs/specs/FULL_PRODUCT_SPEC.md`](docs/specs/FULL_PRODUCT_SPEC.md) — product shape and story map
- [`evals/README.md`](evals/README.md) — eval harness details
- [`docs/evals/2026-04-17-cola-cloud-all-production-run.txt`](docs/evals/2026-04-17-cola-cloud-all-production-run.txt) — latest 28-label production run log
