# Accuracy Architecture Research — April 2026

## Key findings for reaching 95%+ auto-approve on real labels

### Three paradigm shifts from production document verification systems

#### 1. OCV (Optical Character Verification), not OCR
For government warning text, we KNOW the required text (27 CFR Part 16). This is a verification problem, not an extraction problem. Stop asking "what does this say?" and start asking "does this match the known reference?" Pharmaceutical label verification systems (GlobalVision, DMC Inc) achieve near-zero defect rates using this pattern.

#### 2. Region-of-interest cropping before extraction
Running OCR on the whole label dilutes accuracy. Crop the government warning region, upscale 2x, binarize, THEN run OCR on just that region. Research shows attention-guided cropping of under-examined regions recovers information present in the image but not adequately processed by full-image passes (arXiv 2512.07564).

#### 3. Verification prompts, not extraction prompts
Instead of "extract all fields from this label" (hard, low confidence), provide expected values: "The application says brand='X', ABV='Y'. Does the label match?" This transforms open extraction into targeted verification — fundamentally easier for VLMs (TRM Labs: 40% → 98% accuracy with this shift).

### Recommended 7-stage pipeline

1. Image preprocessing (deskew, denoise, DPI normalize)
2. Region extraction (crop warning, brand, ABV, net contents, class/type)
3. Field extraction (OCR on crops, not whole image)
4. Field normalization (deterministic code transforms)
5. Deterministic comparison (Levenshtein, Jaro-Winkler, numeric — no LLM)
6. VLM verification (only for 0.80-0.95 fields, with expected values in prompt)
7. Confidence routing (per-field, not per-document)

### Sources
- Verdantix: Pure VLM architectures erode document AI margins
- arXiv 2510.23066: Multi-stage field extraction (9% → 81% with OCR-first)
- arXiv 2504.11101: Multi-VLM consensus (42% F1 improvement)
- TRM Labs: OCR to VLM migration (40% → 98%)
- GlobalVision: Pharmaceutical label verification
- Tesseract docs: Improving OCR quality via ROI cropping

---

## Experiment Results (2026-04-15 session)

### Methodology
21+ controlled experiments across 4 pipeline configurations, with multiple repeats per config. All experiments used the 7-label fast eval set (6 approved COLA Cloud labels + 1 negative).

### Results by configuration

| Config | Runs | Approve (mean/6) | Approve range | Avg latency |
|--------|------|-------------------|---------------|-------------|
| VLM-only | 5 | 2.0 (33%) | 1-3 | ~3-4s |
| OCR + VLM | 10 | 2.5 (42%) | 1-3 | ~4-5s |
| Full pipeline | 8 | 2.75 (46%) | 2-3 | ~6-12s |

### Full golden set (28 labels): 0% → 35.7% auto-approve, 46% → 0% false rejects

### Key finding: VLM stochasticity (±1 approval per run) exceeds the difference between configurations (0.5 mean). Region detection adds 3-8s latency for +0.25 approvals — not worth the trade-off.

### Recommended: OCR + VLM (no regions) — avg 4s latency, 42% approve, 0% false reject
