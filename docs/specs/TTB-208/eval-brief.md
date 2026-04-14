# Eval Brief

## Story

- Story ID: `TTB-208`
- Title: cloud/default latency observability and sub-4-second budget framing

## Goal

Verify that the measurement path is trustworthy enough to support the later optimization story.

## Evaluation focus

- every latency-sensitive route emits coherent stage timing for the executed path
- route totals align with stage totals within a small measurement margin
- fast-fail fallback and late-fail retryable exits are distinguishable
- timing artifacts remain privacy-safe

## Failure modes to catch

- missing provider-attempt span
- negative or overlapping durations
- timing summaries that include user content
- route total reported without enough stage detail to identify the slow leg

## Pass criteria

- timing records exist for the approved success/fallback/error paths
- the packet has enough measured detail to decide which optimization lever matters next
- no privacy checklist item is left unresolved
