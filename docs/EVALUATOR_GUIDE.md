# Evaluator Guide

This is the shortest path through the prototype if you are assessing whether it is credible, fast enough, and easy enough to use. The lower-right `Toolbench` is the fastest way to get to the interesting surfaces without hunting through fixture files by hand.

Toolbench is an evaluator and developer harness, not the core reviewer workflow. It exists so you can load known samples, jump between single and batch review, reset state, check API health, and compare provider paths from one place.

For latency context while you evaluate:

- the cleanest measured single-label trace on this branch landed around `4.36s` total, with about `4.35s` spent in provider wait time
- the broader 28-label production-style run averaged about `5.2s`
- local mode is slower, but it exists for government-style environments where outbound cloud calls may be blocked or disallowed

## 1. Sign In

![Prototype sign-in screen](screenshots/auth-screen.png)

Use either mock sign-in button. No real credentials are checked in this prototype.

What to look for:

- the sign-in gate is lightweight and gets you into the product quickly
- the app makes it obvious this is a prototype
- the privacy posture is visible throughout the app: inputs and results are intended to be discarded rather than stored

## 2. Load A Known Single-Label Case With Toolbench

![Toolbench sample loader on the single-review intake](screenshots/toolbench-intake.png)

Open `Toolbench` in the lower-right corner, stay on `Samples`, and click `Load random sample` or pick a named label.

Why this is the best evaluator path:

- the label image and declared COLA fields are populated together
- you can move straight to system behavior instead of spending time preparing files
- the sample list makes it easy to test multiple beverage types and edge cases quickly

## 3. Verify The Label And Watch Time-To-First-Answer

With a Toolbench sample loaded, click `Verify Label`.

What to watch for:

- the app can surface OCR preview data before the full review finishes
- the first useful answer lands before any silent cleanup work
- the latency question is not just total wall-clock time, but how quickly the reviewer gets something actionable on screen
- the prototype documents measured latency instead of promising a fake runtime budget in the report payload

If you want to inspect the network path directly, open browser devtools and watch for:

- `POST /api/review/stream?only=ocr`
- `POST /api/review`
- `POST /api/review/refine` only when review rows remain

## 4. Read The Results Screen

![Fresh results screen showing a completed review with evidence expanded](screenshots/results-review-fresh.png)

What to look for:

- the report is evidence-first rather than score-first
- uncertain rows stay visible as `Needs review` instead of being silently forced to pass
- `CHECKING ... FIELDS...` tells you the silent refine pass is still running
- the refine pass improves borderline rows after the first answer instead of making the reviewer wait longer up front
- the row language should make sense to both an experienced reviewer moving quickly and a newer reviewer who needs help following the evidence

This is the key trust interaction in the prototype: the first answer is fast, and any second-pass improvement is additive rather than blocking.

## 5. Use Toolbench Actions To Move Around The Product

![Toolbench Actions tab with reset, mode-switching, health, and provider override controls](screenshots/toolbench-actions.png)

Open `Toolbench` and switch to `Actions`.

What to look for:

- `Reset app` clears state without a reload
- `Open single review` and `Open batch review` move between the two main workflows quickly
- `Check API health` gives an operator-friendly sanity check
- `Provider Override` is explicitly dev-only and exists to force cloud or local extraction during evaluation

If you are testing local mode, this is the quickest way to compare cloud and local extraction without editing `.env` between runs.

## 6. Inspect The Batch Intake

![Clean batch intake screen with image drop zone, CSV drop zone, and required headers](screenshots/batch-intake.png)

Open batch mode either from the top nav or through `Toolbench -> Actions -> Open batch review`.

What to look for:

- the workflow is designed around many images plus one CSV, not one label at a time
- required CSV headers are visible in the UI, which reduces operator guesswork
- the batch surface keeps the file-matching and triage path separate from the single-label reviewer flow
- the footer and helper copy keep repeating the same privacy story: nothing is intended to be stored

## 7. Sanity-Check The Local / Firewall Story

If the government deployment angle matters for your review, do one quick credibility check after the main UI pass:

1. Open `Toolbench -> Actions`.
2. Confirm there is a local extraction option alongside cloud.
3. Read the local-mode section in the README and the Railway/Ollama setup guide.

What to look for:

- the product is honest that local mode trades latency for tighter deployment boundaries
- the cloud and local paths share one report contract and one deterministic validator layer
- the repo explains why local mode exists: outbound restrictions and firewall realities in government environments

## 8. A Good 5-Minute Assessment Script

1. Sign in with either prototype auth button.
2. Open `Toolbench -> Samples -> Load random sample`.
3. Click `Verify Label`.
4. Confirm you see a useful first report before any refine work finishes.
5. Read one row that passed and one row that stayed in review.
6. Open `Toolbench -> Actions -> Check API health`.
7. Use `Open batch review` and inspect the CSV header guidance.

That sequence exercises the single-review flow, the results/evidence model, the refine behavior, the operator utilities, and the batch surface in a few minutes.

## 9. If You Want 10 More Minutes

After the walkthrough, these docs give the best signal fastest:

- [Architecture And Decisions](ARCHITECTURE_AND_DECISIONS.md): the strongest architectural choices, tradeoffs, and why they were made
- [Eval Results](EVAL_RESULTS.md): GoldenSet, COLA Cloud, and latency evidence
- [Government Warning](GOVERNMENT_WARNING.md): the strictest rule path and the most detailed validator write-up
- [Railway / Ollama Setup](process/RAILWAY_OLLAMA_SETUP.md): the clearest local-mode and firewall-context explanation
