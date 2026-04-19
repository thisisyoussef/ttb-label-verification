# Eval Result

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment
- Follow-up: low-contrast applicant-address geography guardrail

## Why this run exists

Low-contrast dark labels can still produce useful text, but the extractor may overcall a bare geography such as `NORTH CAROLINA` as `applicantAddress`. That creates a misleading green informational row even when the model is really just echoing the same location it already assigned to `countryOfOrigin` or `appellation`.

## Commands

```bash
npx vitest run src/server/review-extractor-guardrails.address-url.test.ts
npx vitest run src/server/review-extractor-guardrails.address-url.test.ts src/server/review-extractor-guardrails.test.ts src/server/review-report.test.ts
npx vitest run src/server/review-pipeline.e2e.test.ts
npm run test
npm run typecheck
npm run build
```

## Result

- Guardrail coverage passes for:
  - URL-only applicant-address values
  - bare geography applicant-address values duplicated from `countryOfOrigin`
  - bare geography applicant-address values duplicated from `appellation`
  - valid producer/address lines that include the same geography but are not equal to it
- Real-label review-pipeline replay now covers `evals/labels/assets/supplemental-generated/uncorked-in-mayberry-low-contrast-review.webp` and confirms the guarded extraction path does not emit a standalone green applicant-address row for `NORTH CAROLINA`.
- Adjacent report and guardrail suites stay green.
- Full local verification (`test`, `typecheck`, `build`) is green after the follow-up.

## Notes

- This follow-up is deterministic only. No live model eval was required because the regression is in post-extraction guardrail shaping, not in provider selection or prompt tuning.
- Mutation testing was not run. The change is a narrow guardrail branch with direct scenario tests around the new location-only scrub behavior.
