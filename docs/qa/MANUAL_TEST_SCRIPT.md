# Manual QA Walkthrough — TTB Label Verification

Last updated: 2026-04-14

## Prerequisites

- [ ] Dev server running: `npm run dev` (Vite on 5176, API on 8787)
- [ ] Fixture mode enabled: `VITE_ENABLE_DEV_FIXTURES=true` in `.env` or dev mode
- [ ] Browser at 1440px width (desktop baseline)

---

## 1. First-Run Experience

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1.1 | Open the app in a fresh tab | Auth screen renders with government banner | [ ] |
| 1.2 | Enter any User ID and click Continue | Mode selector appears (Local / Cloud) | [ ] |
| 1.3 | Select Cloud and continue | Intake screen loads with two-column layout | [ ] |
| 1.4 | Verify the Welcome Prompt is visible | "Getting started" card with 3 numbered steps appears above the form | [ ] |
| 1.5 | Verify the JSON paste hint appears below the drop zone | "You can also paste JSON to pre-fill the form." is visible | [ ] |
| 1.6 | Verify the beverage type hint appears | "This adjusts which fields appear..." is visible below the selector | [ ] |
| 1.7 | Type anything in Brand Name | Welcome Prompt disappears, form fields remain | [ ] |
| 1.8 | Select "Wine" beverage type | Wine-specific fields appear, beverage hint disappears | [ ] |

## 2. Happy Path (Single Review)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 2.1 | Load "Perfect spirit label" scenario from picker | Image and form pre-fill | [ ] |
| 2.2 | Click Verify Label | Processing screen with step list and elapsed timer | [ ] |
| 2.3 | Watch processing complete | Elapsed timer counts up, steps complete with checkmarks | [ ] |
| 2.4 | Results screen appears with fade-in | Verdict banner shows "Recommend approval" (green) | [ ] |
| 2.5 | Verify expand-row hint is visible | "Click any row to see evidence..." appears below first row | [ ] |
| 2.6 | Click any field row | Evidence panel expands, hint disappears | [ ] |
| 2.7 | Press ArrowDown | Focus moves to next row | [ ] |
| 2.8 | Press Escape | Expanded row collapses | [ ] |
| 2.9 | Verify N-key hint next to New Review button | "Press N to start a new review." is visible | [ ] |
| 2.10 | Press N | Returns to Intake, form fields preserved, image cleared | [ ] |

## 3. Core-Six Scenarios

| # | Scenario | Expected Verdict | Key Check | Pass |
|---|----------|-----------------|-----------|------|
| 3.1 | Perfect spirit label | Approve (green) | All checks pass | [ ] |
| 3.2 | Warning text defect (spirits) | Reject (red) | Warning diff shows wrong-case/missing segments | [ ] |
| 3.3 | Cosmetic brand mismatch | Review (amber) | Brand name row shows "Review" not "Fail" | [ ] |
| 3.4 | Wine missing appellation | Reject (red) | Cross-field check shows fail for appellation | [ ] |
| 3.5 | Beer forbidden ABV format | Reject (red) | ABV row shows fail with format explanation | [ ] |
| 3.6 | Low quality image | Review (amber) | Confidence meter shows red, standalone banner appears | [ ] |

## 4. Error Paths

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 4.1 | Drag a .heic file onto the drop zone | Error: "We couldn't use that file. Please upload a JPEG, PNG, WEBP, or PDF." | [ ] |
| 4.2 | Click the drop zone again after error | Error message clears, file picker opens | [ ] |
| 4.3 | Drag over the drop zone after an error | Error message clears on drag-over | [ ] |
| 4.4 | Verify disabled state: hover Verify without image | Tooltip: "Add a label image to verify." | [ ] |
| 4.5 | Hover Export button before completing a review | Tooltip: "Complete a review first to export results." | [ ] |
| 4.6 | Load a scenario, enable force-failure, click Verify | Processing fails: cause label + step-specific message + "Your label and inputs are still here" | [ ] |
| 4.7 | Verify "Try again" button works | Processing restarts from step 1 | [ ] |
| 4.8 | Load "Low quality image" scenario | NoTextState: "We couldn't read enough text" with two recovery paths | [ ] |
| 4.9 | Paste invalid JSON `{bad` in JSON paste | Error: "Could not parse JSON: ..." with position detail | [ ] |
| 4.10 | Paste valid JSON with unknown keys | Success with "Ignored unknown fields: ..." warning | [ ] |

## 5. Batch Flow

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 5.1 | Switch to Batch mode | Batch intake screen loads | [ ] |
| 5.2 | Upload 3+ images | Images appear in drop zone with thumbnails | [ ] |
| 5.3 | Upload a CSV file | CSV parsed, matching review shows matched pairs | [ ] |
| 5.4 | Click Start Batch | Processing stream begins with progress count | [ ] |
| 5.5 | Watch stream complete | Dashboard loads with summary cards | [ ] |
| 5.6 | Click a filter pill (e.g., "Reviews only") | Table filters to matching rows only | [ ] |
| 5.7 | If filter shows no results | "Show all rows" button appears and works | [ ] |
| 5.8 | Click a table row | Drill-in view shows full results (same as single) | [ ] |
| 5.9 | Click breadcrumb back | Returns to dashboard with filter preserved | [ ] |

## 6. Keyboard Walkthrough

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 6.1 | Tab from Image zone through all fields to Verify | Focus follows visual order, no skips | [ ] |
| 6.2 | Press Enter from Brand Name field | Verify triggers (if image present) | [ ] |
| 6.3 | On Processing screen, press Escape | Cancel review triggers | [ ] |
| 6.4 | On Results, press ArrowDown/ArrowUp | Focus moves between field rows | [ ] |
| 6.5 | On Results, press Enter on a row | Row expands/collapses | [ ] |
| 6.6 | On Results, press Escape | Expanded row collapses | [ ] |
| 6.7 | On Results, press N | New review starts | [ ] |

## 7. Edge Cases

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 7.1 | Switch Single -> Batch -> Single mid-review | Single-mode state preserved | [ ] |
| 7.2 | Wait for session timeout (or mock 15min) | Modal: "Your session is about to expire" with countdown | [ ] |
| 7.3 | Click "Yes, continue session" | Modal closes, session continues | [ ] |
| 7.4 | Click "Clear" on intake with filled fields | Confirmation: "Clear everything?" | [ ] |
| 7.5 | Confirm clear | All fields and image reset | [ ] |
| 7.6 | Cancel clear | Fields preserved | [ ] |

## 8. Responsive Check

| # | Width | Surface | Check | Pass |
|---|-------|---------|-------|------|
| 8.1 | 1024px | Intake | Columns tighter but readable | [ ] |
| 8.2 | 1024px | Results | Pinned column + main area fit | [ ] |
| 8.3 | 768px | Intake | Stacks to single column | [ ] |
| 8.4 | 768px | Processing | Sidebar stacks above main | [ ] |
| 8.5 | 768px | Results | Layout stacks cleanly | [ ] |
| 8.6 | 768px | Warning diff | No horizontal overflow | [ ] |
| 8.7 | 768px | Batch dashboard | Cards and table stack | [ ] |

## 9. Reduced Motion

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 9.1 | Enable "Reduce motion" in OS settings | — | [ ] |
| 9.2 | Run a review through Processing | Step spinner shows static "pending" icon (no spin) | [ ] |
| 9.3 | Skeleton shimmer on Processing | Static gray fill (no shimmer) | [ ] |
| 9.4 | Results fade-in | Instant render (no animation) | [ ] |
| 9.5 | FieldRow chevron rotation | Instant (no transition) | [ ] |
