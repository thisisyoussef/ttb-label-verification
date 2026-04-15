# Feature Spec

## Story

- Story ID: `TTB-212`
- Title: local extraction mode: Ollama-hosted Qwen2.5-VL with degraded-confidence guardrails
- Status: deferred by user on 2026-04-15; keep as a backlog packet, not active implementation guidance

## Problem statement

The current extraction roadmap is still cloud-only. That is fine for the primary demo path, but it leaves Marcus with the same unresolved question that burned the prior scanning-vendor pilot: what happens when the product has to run inside a network that blocks outbound ML endpoints?

This app already has the right downstream shape for a local story. Only the first extraction step is model-backed; comparison, warning validation, beverage rules, and aggregation are deterministic and local. The missing piece is a local extraction path that can feed the same `ReviewExtraction` contract into the same pipeline without pretending that local visual reasoning is as strong as cloud vision.

## User-facing outcomes

- Sarah can show a stronger procurement story: the prototype is not locked to internet-only extraction.
- Marcus gets a credible restricted-network path that still respects the no-persistence posture.
- Dave and Jenny keep the same results workflow; only the extraction engine changes.
- Janet can run the same batch pipeline in a local mode without inventing a second result language.

## Acceptance criteria

1. The server supports a `local` extraction mode in addition to the default `cloud` mode.
2. Local mode runs through an Ollama-hosted vision model chosen later by the user; no checked-in default model target is blessed in this packet.
3. Local mode normalizes into the existing `ReviewExtraction` contract so downstream validators, reports, and batch summaries remain unchanged.
4. When local mode is explicitly selected, the server does not silently fall back to cloud providers.
5. Local-mode output applies a degraded-confidence posture for weak or unsupported visual judgments, especially:
   - boldness
   - warning separation
   - paragraph continuity
   - same-field-of-vision style layout claims
6. Route and batch execution continue to work against the same extraction surfaces:
   - `/api/review`
   - `/api/review/extraction`
   - `/api/review/warning`
   - batch item processing and retry
7. The packet records the real local-mode runtime envelope separately from the default cloud SLA.
8. The README and release docs can explain the cloud vs local tradeoff honestly, including where local mode is weaker.

## Edge cases

- Ollama is installed but the target model is missing.
- Ollama is unavailable or times out.
- Local mode receives a PDF upload and needs an in-memory compatibility path or an explicit unsupported error.
- Local extraction gets the text right but overstates formatting confidence.
- Batch retries in local mode repeat a bad extraction pattern across many rows.

## Out of scope

- introducing Anthropic as another cloud provider
- turning local mode into a separate UI workflow
- claiming local parity on formatting or spatial reasoning before evidence proves it
- any active implementation on the current branch until the user explicitly resumes this story
