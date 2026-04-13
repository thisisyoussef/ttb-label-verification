# Stitch Screen Brief

## Story

- Story ID: `TTB-003`
- Title: batch triage workflow and processing pipeline

## Screen goal

Produce the batch-review workstation flow: batch intake, matching review, progress, dashboard triage, and drill-in shell.

## Target user moment

A reviewer handling many labels needs to upload a batch, trust the matching and progress, then work the failures and reviews first from a stable dashboard.

## Screen prompt for Stitch

Design a batch-review companion to a TTB label verification workstation. Show a batch upload screen for many label files plus one CSV, a progress view with believable status, and a data-dense batch dashboard with approve/review/reject counts, filter controls, a sortable triage table, and a drill-in path back to individual label evidence. Keep the style industrial, calm, and government-workstation oriented.

## Required sections and components

- batch upload screen
- CSV matching summary
- batch progress screen
- batch dashboard with summary counts
- triage table with filter and sort controls
- row drill-in affordance
- export action

## Required states to visualize

- empty batch intake
- files uploaded and ready
- unmatched or ambiguous match state
- active processing
- mixed dashboard results
- empty filtered table state

## Copy anchors and terminology

- `Batch Upload`
- `Batch Processing`
- `Batch Results`
- `Start Batch Review`
- `Export Results`
- `View Details`

## Constraints and must-avoid notes

- do not invent a different visual language from single-label review
- keep table density readable
- no persistence language or workflow-tracking assumptions
- no decorative analytics-dashboard styling

## Returned Stitch references

- Stitch image reference: pending
- Stitch HTML/code reference: pending
