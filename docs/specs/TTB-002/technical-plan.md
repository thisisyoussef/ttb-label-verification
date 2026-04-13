# Technical Plan

## Scope

Implement the real single-label review pipeline behind the approved UI.

## Modules and files

- `src/shared/contracts/review.ts` — expand from seed shape to full report/evidence contract.
- `src/server/index.ts` — replace or extend the seed review route with the real intake/review route.
- `src/server/**` planned logical modules:
  - upload validation
  - request normalization
  - extraction adapter
  - beverage inference
  - deterministic validators
  - recommendation aggregation
  - response shaping
- `docs/specs/TTB-002/evidence-contract.md` — UI-facing payload definition.
- `docs/specs/TTB-002/rule-source-map.md` — story-level rule traceability.
- `docs/specs/TTB-002/privacy-checklist.md` — no-persistence proof.
- `docs/specs/TTB-002/performance-budget.md` — measured timing budget.
- `docs/specs/TTB-002/eval-brief.md` — expected quality bar against the six-label corpus.

## Contracts

- Request contract:
  - label file
  - optional application data
  - optional explicit beverage type
- Internal extraction contract:
  - extracted fields
  - confidences
  - warning-specific visual signals
  - image quality signal
- Response contract:
  - overall recommendation
  - summary counts
  - ordered field checks
  - warning detail payload
  - cross-field checks
  - standalone/comparison mode metadata
  - latency and no-persistence metadata where appropriate

## Risks and fallback

- Risk: the contract expands faster than the current scaffold architecture.
  - Fallback: keep the server modular inside `src/server/**` even if the initial entrypoint remains small.
- Risk: visual judgments such as boldness or same-field-of-vision are not reliably deterministic.
  - Fallback: expose confidence and downgrade to `review`; never manufacture a strong `pass`.
- Risk: the warning diff logic becomes entangled with extraction logic.
  - Fallback: keep extraction, normalization, deterministic comparison, and response shaping as distinct modules.
- Risk: the under-5-second target is missed.
  - Fallback: preserve a single extraction pass baseline and measure every stage explicitly before release.

## Testing strategy

- unit:
  - request validation
  - beverage inference
  - warning exact-text comparison
  - fuzzy match utilities
  - recommendation aggregation
- integration:
  - review endpoint with representative files and application inputs
  - six-label eval slices
- contract:
  - expanded `review.ts` schema validation
  - seeded and real result compatibility while integration is in flight
- UI behavior:
  - response shape must support the frozen `TTB-001` UI without structural redesign
