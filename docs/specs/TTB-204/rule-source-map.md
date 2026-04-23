# Rule Source Map

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Rules touched

| Rule ID | Applies To | Severity | Source Docs | Deterministic or Advisory | Uncertainty Fallback | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `GOV-WARN-EXACT` | labels with a required U.S. warning | blocker | `27 CFR 16.21`; `docs/reference/product-docs/ttb-implementation-roadmap-final.md`; `docs/reference/product-docs/ttb-product-spec-final.md` | deterministic when warning text is readable | `review` when warning read is low-confidence or image quality is weak | whitespace is normalized before comparison; wording and punctuation must stay exact; body-letter case differences stay reviewable noise rather than a hard fail when the wording otherwise matches; once the full canonical warning is present, clear non-warning metadata tails such as URLs, numeric print codes, and social handles are trimmed from the warning seam instead of being treated as warning wording |
| `GOV-WARN-FORMAT` | labels with a required U.S. warning | blocker | `27 CFR 16.22`; TTB health warning guidance; product docs | mixed | `review` when boldness, continuity, legibility, or separation are uncertain | the separate uppercase/bold requirement applies to the opening `GOVERNMENT WARNING` heading only; boldness is judged relative to the words immediately after the heading and does not hard-fail from one uncorroborated visual `no` signal |

## Source URLs

- eCFR API part 16 XML:
  - `https://www.ecfr.gov/api/versioner/v1/full/2026-04-01/title-27.xml?subtitle=A&chapter=I&subchapter=A&part=16`
- TTB distilled spirits health warning guidance:
  - `https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning`
