# How to Prompt an LLM for Judgment & Review Systems

> Imported from prompting guidance — April 2026

## Core Principles Applied to TTB Label Review

1. **Separate extraction from normalization from judgment** into distinct LLM calls
2. **Write decision rules as explicit IF/THEN trees**, not vibes
3. **Define output schema before writing a single instruction**
4. **Embed every rule the model needs directly in the prompt** — don't hope it "knows" TTB regs
5. **Create a safe REVIEW path** so the model doesn't confidently guess wrong
6. **Do deterministic normalization in code first** — only pay for LLM calls on genuinely ambiguous cases
7. **Iterative eval loop**: run cases, find failures, add rules for those failures, re-run everything

## Architecture: Three-Call Pipeline

```
Call 1 (extraction): Extract visible text from this label. Return raw field values. No judgment.
Call 2 (code normalization): Deterministic transforms — case, units, abbreviations, taxonomy lookup.
   → If code resolves it: done (APPROVE or REJECT). No LLM needed.
   → If ambiguous: proceed to Call 3.
Call 3 (judgment): Given these normalized values that code couldn't resolve, classify using these explicit rules.
```

## Key Anti-Patterns to Avoid

- Asking one prompt to extract AND judge AND format
- Using vague guidelines ("consider whether meaningful") instead of IF/THEN trees
- Relying on VLM self-assessed confidence as the decision signal
- Not embedding rules directly in the prompt
- Not providing few-shot examples for edge cases
- Temperature > 0 for judgment calls
- Skipping the iterative eval loop
