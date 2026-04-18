# Verification-mode extraction for identifier fields

**Status:** Plan (not built).
**Owner:** TTB-000 (this story packet).
**Trigger to build:** after PR #74 (UX envelope + COLA live data + rule tuning) merges and we have a stable eval baseline against `cola-cloud-all`.

## Why

The current extraction pipeline is **bottom-up**: the VLM looks at the
image and decides "what's the brand name here?" The model assigns every
piece of text on the label to a slot in the schema. Two structural
failures follow from that framing:

1. **Slot-assignment errors on identifier fields.** When a label has a
   prominent fanciful name (e.g. "Mill River Reserve") and a quieter
   brand mark ("Stone Creek Distillery"), the VLM sometimes promotes
   the fanciful name into the brand slot — because visually it *looks*
   like the primary label text. The pipeline then compares the wrong
   value against the application's brand and flags a review that never
   should have happened.
2. **Unknown absence vs unknown presence.** The VLM can report a field
   as `present: false` either because the label genuinely has no such
   data (common for `fancifulName`, `country`) or because the model
   wasn't confident (common when the field is small or rotated). The
   pipeline can't tell these cases apart, so it defers to the OCR
   fallback uniformly — but the best reviewer UX would differ.

Humans don't work this way. A human reviewer reads the application, sees
"brand name: Stone Creek Distillery", then scans the label looking for
that specific string. That's **verification**, not extraction. We can
ask the VLM the same way.

## What gets built

### New prompt mode: `verification` for identifier fields

Identifier fields — `brandName`, `fancifulName`, `classType`,
`countryOfOrigin`, `applicantAddress` — are natural-language strings
with no universal canonical form. They flip from bottom-up extraction
to top-down verification:

```
Application states the brand name is "Stone Creek Distillery".
Look at this label.
Is this brand name visible on the label?
- If yes, return the text exactly as it appears on the label
  (casing, punctuation, surrounding context preserved).
- If no, return `present: false` with a confidence < 0.3.
- If you see something similar but not identical, return `present:
  true`, put the exact label text in `visibleText`, and also return
  `alternativeReading` = the label text plus an optional note about
  the discrepancy ("abbreviated", "stylized", "different brand name
  detected in the primary position").
```

The schema for these fields becomes a tagged union:

```ts
type VerificationField =
  | { present: true; visibleText: string; alternativeReading?: string; confidence: number }
  | { present: false; confidence: number; note?: string };
```

Numeric / canonical fields — `alcoholContent`, `netContents`, `vintage`,
`appellation`, `governmentWarning` — **stay as bottom-up extraction**.
These have regular forms ("13.5% Alc./Vol.", "750 mL") that the OCR
regexes and VLM can reliably pull without an application hint, and
verification prompting would leak the expected value into the answer
(the VLM would just echo it back).

### Hybrid prompt structure

The extraction call carries both modes:

```
APPLICATION DATA:
Brand: Stone Creek Distillery
Fanciful name: —
Class/Type: Kentucky Straight Bourbon Whiskey
Country: USA
Applicant address: Louisville, KY

TASKS:
1. Verify the application identifiers against the label image.
   For each field, answer: is this value visible on the label?
   If no, what does the label show in that position?
2. Extract the canonical fields (ABV, net contents, vintage,
   appellation, government warning) from the image.
```

Zero additional API calls — same `generateContent` invocation, better
prompt structure. Token count goes up by ~100-200 tokens for the
application block; this is negligible against the image bytes.

### Schema changes (`src/shared/contracts/review.ts`)

Identifier fields become the tagged union above. The pipeline-side
changes:

- Judge rules for brand/fanciful/class/country/address consume
  `visibleText` instead of `value`. Where `alternativeReading` is set,
  a new "slot-assignment-warning" disposition surfaces the alternative
  so the reviewer sees the model's uncertainty without the pipeline
  second-guessing it.
- Numeric fields keep the current `{ present, value, confidence }`
  shape — no change.

### Judge rule rewrites

- `judgeBrandName`: if `visibleText` matches the application exactly or
  fuzzy-close, pass. If `alternativeReading` is set and differs from
  the application, emit a `brand-alternative-reading` disposition with
  disposition `review` and note "Label shows *X* in the brand position;
  application says *Y*."
- `judgeFancifulName`: new rule. The field was previously extraction-
  only and the pipeline barely used it. Now becomes a verification
  check: application says fanciful name *Y*; is it on the label?
- `judgeClassType`, `judgeCountryOfOrigin`, `judgeApplicantAddress`:
  same pattern. `visibleText` is the authoritative string.

### Eval plan

- Before rollout: snapshot the current `cola-cloud-all` accuracy
  numbers (approve rate, review rate, pass/review/fail per field).
- Build the new prompt behind a feature flag `VERIFICATION_MODE=on`.
- Run `cola-cloud-all` under both modes, diff per-label and per-field.
- Expected wins: brand/fanciful slot-assignment errors drop, because
  the VLM is no longer forced to pick. Expected neutral: numeric
  fields. Expected watch-out: the new prompt must not cause the VLM
  to hallucinate a positive verification when the field is absent —
  if we see `present: true` but the model echoes the application text
  verbatim, tighten the prompt to explicitly require the label-visible
  text.
- Promote when the new mode beats the old on overall review-rate
  without regressing on true-negative (correctly flagged) cases.

## Risks

- **Prompt echo.** The VLM could copy the application string back into
  `visibleText` without actually reading the label. Mitigation: the
  schema requires `visibleText` to include surrounding label context
  (e.g. "distilled and bottled by Stone Creek Distillery, Louisville,
  KY") and the prompt explicitly asks for exact wording as it appears
  on the image.
- **Hidden mismatches.** A labels where the application brand is truly
  absent and a different brand is prominent should flag as review, not
  pass. The `alternativeReading` field handles this; judge rules must
  weigh it when set.
- **Tagged-union migration.** Every downstream consumer of
  `extraction.fields.brandName` etc. needs updating. The Zod schema
  change is the contract boundary — once it ships, all consumers are
  forced to migrate at compile time.

## Follow-up candidates (not in v1)

- Apply the same verification framing to the government warning:
  "Does the label show the canonical government warning text?" vs the
  current "extract what looks like the warning".
- Use `alternativeReading` output to build a training set for
  slot-assignment corrections — labels where the VLM's primary read
  was wrong and the alternative was right become hard test cases.

## Decision needed before building

- Confirm the tagged-union schema shape — the alternative is a wider
  flat object with more optional fields, which is less type-safe.
- Decide whether `classType` is an identifier (verification) or a
  canonical field (extraction). Judge-rule logic currently relies on
  fuzzy matching against a small canonical list (e.g. "Whisky" →
  "Whiskey"), which would continue to work in either mode.
- Confirm `VERIFICATION_MODE` is an env flag for safe rollout vs a
  hard cutover.
