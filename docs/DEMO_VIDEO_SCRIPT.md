# Demo Video Script

Target length: 5 to 8 minutes.

This script is designed to cover the evaluation criteria directly: correctness and completeness, code quality and organization, technical choices, UX and error handling, attention to requirements, and creative problem-solving.

## 0:00 - 0:30 | Frame The Submission

Welcome. In this walkthrough, I am using the TTB Label Verification Assistant the way a real reviewer would use it, and I am also calling out the engineering decisions behind it.

The goal here was not to make a generic AI demo. The goal was to build something credible for the TTB brief: fast enough to use, conservative enough to trust, simple enough to adopt, and structured enough that a reviewer can inspect both the product and the code.

## 0:30 - 1:00 | Start In The Real Workflow

I start on the mock Treasury sign-in screen. This keeps the prototype grounded in a realistic workflow without pretending it is already integrated into a live federal identity system.

That is a recurring theme in the project: keep the operational shape realistic, but stay honest about what is prototype scope and what is not.

## 1:00 - 1:40 | Show The Evaluator Surface

Once I am in, I open the Toolbench in the lower right. This is the built-in evaluator surface. It lets me load known label samples, jump between single and batch review, inspect API health, and compare cloud versus local extraction paths.

That surface exists for two reasons:

1. it makes evaluation faster for a reviewer
2. it keeps evaluator-only controls out of the everyday reviewer workflow

## 1:40 - 2:10 | Call Out Cloud And Local Mode

In Actions, extraction mode matters. For this run I am staying on the cloud path because it is the fastest interactive path. But the same typed contract also supports a local mode.

That local mode matters because the stakeholder context explicitly called out government firewalls and restricted outbound-network environments. The product therefore has a path where the deterministic validator stays the same, but extraction can move local when cloud calls are not acceptable.

The tradeoff is honest: cloud is faster; local gives a tighter deployment boundary.

## 2:10 - 2:50 | Load A Realistic Label

Now I load Simply Elegant. The Toolbench fills in both the label image and the declared application values so I can move straight into review.

That sample path is backed by a broader evaluation story, not just a one-off fixture. The repo keeps:

- a checked-in GoldenSet manifest
- a live image-backed quick subset
- COLA Cloud-backed dataset collection and fixture-building scripts
- synthetic negative cases for edge conditions that are hard to source cleanly from public records

So the demo sample is connected to a real evaluation workflow.

## 2:50 - 3:30 | Explain The Intake Design

The intake screen stays intentionally simple. The label is on one side, the declared fields are on the other, and the primary action is obvious.

It also supports one or two images because real labels are not always single-panel. Sometimes the warning, importer statement, or origin evidence lives on a separate panel, and the workflow needs to preserve that without making the reviewer juggle separate sessions.

This is one of the places where the UI is designed to work for people across the team's comfort range, not just for a technically confident evaluator.

## 3:30 - 4:20 | Show Perceived Latency Design

When I click Verify Label, the app responds immediately with a processing view. That is a deliberate latency decision.

We treated latency as both an engineering problem and a product problem:

- perceived latency is handled with immediate state transitions, OCR preview, and silent refine behavior
- actual latency is handled with parallel extraction-related work, timing instrumentation, fast-fail fallback logic, and benchmark-driven tuning

On this branch, the cleanest measured single-label trace landed around 4.36 seconds total, with about 4.35 of that spent waiting on the provider. A broader 28-label production-style run averaged about 5.2 seconds.

Those are the numbers we document. We removed the fake `latencyBudgetMs` field from the visible report payload because measured evidence is more honest than a synthetic contract number.

## 4:20 - 5:10 | Explain The Core Architecture

Now the report is back. This is the core architectural decision in the project:

AI extracts. Rules judge.

The models do structured extraction. OCR and warning-specific checks add independent evidence. Deterministic TypeScript validators decide the report.

That boundary matters because it keeps the system conservative and auditable. If extraction is uncertain, the field stays in review. The prototype does not quietly turn uncertainty into a pass just to look more capable.

## 5:10 - 5:50 | Show Trustworthy Results UX

The results screen is evidence-first. Each row shows the application value, the label value, and how the comparison landed.

Rows are ordered so the riskiest or least certain items appear first. An experienced reviewer can skim quickly. A newer reviewer can open rows and follow the evidence.

This is how the UI stays trustworthy: it accelerates judgment without trying to replace it.

## 5:50 - 6:30 | Call Out The Warning Validator

The government warning path is where a lot of the critical thinking shows up.

The warning is not treated as a vague semantic match. The validator breaks it into subchecks for:

- presence
- exact text
- uppercase-and-bold heading
- continuous paragraph
- legibility

That comes directly from the stakeholder interviews and the regulatory context. It is a good example of turning an implicit requirement into explicit product and code behavior.

## 6:30 - 7:00 | Show Refine Behavior

There is also a refine pass behind the scenes for review-heavy cases. The important design choice is that refine happens after the first useful answer is already on screen.

That means the system can improve bounded ambiguous rows without blocking the first result. It is a latency and trust tradeoff: better evidence when helpful, but never at the cost of making the product feel stalled.

## 7:00 - 7:40 | Cover Engineering Quality

Behind the UI, the repo is organized for reviewability:

- server code is grouped by concern in shallow folders instead of one flat layer
- scripts are grouped by job instead of as a long top-level shelf
- shared contracts sit between client and server
- architecture, evaluator, regulatory, and eval docs point to the same choices from different angles

The delivery process is disciplined too:

- spec-driven story packets define the work
- TDD covers contracts and validators
- trace-driven development is used for prompt and model tuning
- this branch verifies with 99 test files and 579 passing tests, plus typecheck, build, and source-size gates

## 7:40 - 8:30 | Show Batch Mode

Now I switch to batch mode. This is for the reviewer who gets a large importer drop and needs to work through a queue instead of checking one label at a time.

The intake pauses on matching review first, which is an important design decision. The CSV is the application side of the comparison. The images are the label side. The system checks whether those pairings are credible before spending model time.

When the batch starts, results stream in as each item finishes. That handles perceived latency and real throughput together. Clean labels clear quickly. Harder labels stay reviewable without blocking the whole queue.

When the run finishes, the dashboard becomes the triage surface: sort, filter, drill in, move next and previous, and export.

## Closing

So the submission story is straightforward.

It meets the explicit requirements: single review, batch review, deployed app, source code, README, and evaluator documentation.

It also addresses the implicit ones:

- trust instead of automation theater
- measured latency instead of made-up claims
- no persistence by default
- local mode for restricted government environments
- deterministic compliance decisions instead of model-only verdicts
- code organization and documentation that make the reasoning inspectable

The result is a prototype that is practical, conservative, and easy to evaluate.
