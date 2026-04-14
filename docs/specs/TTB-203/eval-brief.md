# Eval Brief

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment

## AI behavior being changed

This story introduces the first live vision extraction call, typed extraction shaping, beverage-type resolution, and image-quality signaling.

## Expected gain

- Replace the placeholder extraction gap with a real structured extraction payload.
- Make beverage-type resolution explicit and testable before validator logic lands.
- Surface low-quality and no-text conditions early so later stories can downgrade to `review` instead of manufacturing certainty.

## Failure modes to catch

- application-provided beverage type being ignored
- ambiguous class/type text resolving to the wrong commodity
- missing no-text or low-confidence quality signals
- PDF or image request packaging using a durable upload mechanism
- structured output refusal or partial parse being treated as success
- extraction payload shape drifting from the shared contract

## Eval inputs or dataset slice

- the six baseline cases referenced by `evals/labels/manifest.json`
- additional unit fixtures covering beverage inference and image-quality edge cases

## Pass criteria

- contract tests cover the extraction payload shape
- adapter tests prove `store: false`, structured outputs, and non-persistent file packaging
- route tests prove the extraction endpoint returns the shared contract when injected with a valid extractor
- live six-label eval is recorded when the binary assets are available, or explicitly marked blocked with the exact missing asset paths
