# Eval Brief

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening

## Goal

Pick the best measured Gemini latency profile for this repo, prove the public `5000 ms` budget remains the honest contract, and record the non-cutover evidence for the abandoned `4000 ms` stretch target.

## Evaluation focus

- total route duration on the approved latency fixture slice
- warning-text fidelity and field coverage under the winning low-latency profile
- fast-fail fallback correctness
- late-fail retryable behavior

## Failure modes to catch

- speed improves but warning-text extraction regresses
- low-latency model selection weakens beverage or field extraction
- cache-friendly request shaping changes structured-output behavior
- priority-tier downgrade hides a slower standard-tier result
- the default timeout remains so short that the repo self-fails before the real budget
- the visible budget flips below `5000` before the measured route proves it

## Pass criteria

- the story records the winning profile and the losing experiments on the approved release-signoff slice
- extraction quality remains acceptable against the existing eval set
- the story packet records the winning profile, the shipped timeout posture, and the non-cutover condition
