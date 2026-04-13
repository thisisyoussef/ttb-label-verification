# TTB Label Verification App — Implementation Roadmap
## Product Specification & Build Plan

---

## How This Document Works

This project has two workstreams running in parallel:

**Claude Code** builds screens, states, and interactions. Claude Code's job is to create the complete user experience — every screen, every state, every transition, every error message — without any knowledge of or dependency on how the backend works. Use hardcoded sample data to make everything interactive and demonstrable.

**Codex** builds the intelligence layer — AI extraction, validation logic, comparison engine — and then integrates into whatever Claude Code built. Codex has full autonomy over architecture, tools, models, and implementation decisions. Its constraint is the user experience Claude Code has established, not a predetermined technical contract.

**The integration model:** Claude Code builds a finished product with fake data. Codex replaces the fake data with real data. Codex is responsible for understanding the screens Claude Code built and making them work with real results. If Codex needs the frontend adjusted to accommodate something, it refactors it directly.

---

## Prerequisite: Shared Context (Before Anyone Starts)

Both agents must have access to:

1. **The full assignment document** including all four stakeholder interviews
2. **The product specification** (user stories, UX flows, logic flows) — the companion document to this roadmap
3. **The TTB domain context** — what a COLA is, what Form 5100.31 contains, how agents currently review labels, the government warning requirements, beverage-type differences

A set of **6 test label images** (AI-generated or sourced) should be created before starting. These labels are used throughout development and become part of the final submission:

| Test Label | What It Tests |
|-----------|--------------|
| Perfect spirit label | Everything passes — baseline happy path |
| Spirit label with warning errors | "Government Warning" in title case instead of all caps, missing comma after "machinery" |
| Spirit label with brand name case mismatch | Application says "STONE'S THROW" but label says "Stone's Throw" |
| Wine label missing appellation | Has a vintage year and varietal on the label but no appellation of origin |
| Beer label with forbidden ABV abbreviation | Uses "5.2% ABV" instead of the required "Alc./Vol." format |
| Deliberately low-quality image | Blurry, angled, or poorly lit — tests graceful degradation |

---

## PHASE 1: Single Label Review

### Claude Code — Phase 1: The Core Review Experience

Claude Code builds the complete single-label review experience. Every screen described below should be fully interactive using hardcoded sample data. A stakeholder should be able to sit down and click through the entire flow without any backend running.

---

**Screen 1: The Starting State**

This is what the user sees when they first open the app. The screen has two zones side by side:

*Left zone — Label image upload:*
A large drop area where the user can drag and drop an image file or click to browse. Below the drop area, a note about accepted formats (JPEG, PNG, PDF) and maximum file size (10MB). When an image is dropped, the drop area is replaced by a thumbnail preview of the uploaded image with an option to remove and re-upload.

*Right zone — Application data entry:*
A form representing the key fields from the COLA application (Form 5100.31). At the top of the form, a dropdown for beverage type with three options: Distilled Spirits, Malt Beverage, and Wine. This dropdown controls which fields appear below it:

Always visible fields:
- Brand Name
- Class/Type Designation
- Alcohol Content (ABV)
- Net Contents
- Bottler/Producer Name and Address
- Origin toggle (Domestic or Imported)

Appears only when "Imported" is selected:
- Country of Origin

Appears only when "Wine" is selected:
- Appellation of Origin
- Vintage Year
- Varietal(s)

All fields are optional. The user can submit with partial data or no data at all. Below the form, a small text note: "Application data is optional. Upload just an image for standalone compliance checking."

At the bottom of the screen, a prominent "Verify Label" button. Next to it, a secondary link: "Or: Batch Upload →" that leads to the batch processing screen.

Design direction: This is a government compliance workstation tool. Think utilitarian, not trendy. Muted backgrounds, high contrast, large readable text (minimum 16px body), sharp data presentation. The agents using this range from their 20s to their 60s — half the team is over 50. Prioritize clarity over aesthetics. No hunting for buttons. No clever navigation. One screen, obvious actions.

---

**Screen 2: Processing State**

After the user clicks "Verify Label," the upload area and form are replaced by a processing view. This shows:

- The uploaded image thumbnail (for confirmation)
- A multi-step progress indicator with these steps:
  1. Image received (immediately checks off)
  2. Extracting text and formatting (active spinner)
  3. Running compliance checks (waiting)
  4. Generating report (waiting)
- Each step checks off as it would logically complete. The total processing must feel fast — the target is under 5 seconds.
- If processing exceeds 7 seconds, a subtle message appears: "Taking a bit longer than usual..."

For the hardcoded version, simulate a 3-second delay before showing results.

---

**Screen 3: Results — Comparison View**

This is the most important screen in the entire application. It must communicate three things instantly: the overall recommendation, where the problems are, and what the agent should do about them.

*Top banner:*
A full-width colored banner showing the overall recommendation:
- Green banner: "RECOMMEND APPROVAL" — when every check passes
- Amber banner: "RECOMMEND REVIEW" — when some checks need human eyes but nothing is clearly wrong
- Red banner: "RECOMMEND REJECTION" — when one or more checks clearly fail

Next to the recommendation, a summary count: "8 Pass · 1 Review · 1 Fail"

*Results checklist:*
Below the banner, a vertical table — one row per checked field. This should feel like a digital version of the printed checklist Jenny described having on her desk. Each row shows:

| Field Name | Application Value | Label Value (Extracted) | Status |
|-----------|------------------|----------------------|--------|
| Brand Name | OLD TOM DISTILLERY | Old Tom Distillery | 🟡 Review |
| Class/Type | Kentucky Straight Bourbon Whiskey | Kentucky Straight Bourbon Whiskey | 🟢 Pass |
| Alcohol Content | 45% | 45% Alc./Vol. (90 Proof) | 🟢 Pass |

And so on for every field relevant to this beverage type.

Status indicators must be accessible to colorblind users — use icons alongside colors. A green checkmark for Pass. An amber warning triangle for Review. A red X circle for Fail.

Every row is clickable/expandable. Clicking a row reveals a detail panel with:
- The exact text extracted from the label
- The exact text from the application (if provided)
- A plain-English explanation of why this field got its status (e.g., "Case difference detected. The text matches when compared without case sensitivity. This is likely the same brand name in different capitalization.")
- The specific TTB regulation being checked (e.g., "Per 27 CFR 5.64, the brand name on the label must match the Brand Name field on the application.")
- A confidence indicator showing how certain the AI was about its extraction (e.g., "Extraction confidence: 97%")

*Government Warning special treatment:*
The government warning row, when expanded, shows a deeper level of detail than other fields. It breaks down into individual sub-checks, each with its own pass/fail status:

- Text matches word-for-word
- "GOVERNMENT WARNING" is in all capital letters
- "GOVERNMENT WARNING" appears in bold type
- Remainder of the statement is not bold
- "Surgeon" and "General" are properly capitalized
- All punctuation is correct (commas, periods, colon, parentheses present)
- Statement appears as one continuous paragraph
- Statement is visually separate from other label information

Additionally, the expanded warning section shows a character-level text comparison. The expected canonical text and the extracted text are displayed together, with any differences highlighted — missing characters, wrong characters, wrong capitalization — so the agent can see exactly where the warning diverges from the required text. This eliminates the need for agents to manually read the warning word-by-word.

When the warning fails, the detail section should also show the exact canonical text in full for reference, so the agent can tell the applicant exactly what it needs to say.

*Cross-field checks section:*
Below the main checklist, a separate section for checks that involve relationships between fields. For example:
- Spirits: "Brand name, alcohol content, and class/type appear in the same field of vision" — Pass/Review/Fail
- Wine: "Vintage date is present and appellation of origin is also present" — Pass/Fail
- Wine: "Varietal percentages total 100%" — Pass/Fail
- All types: "Product is imported and country of origin is present" — Pass/Fail

These only appear when relevant to the beverage type.

*Image reference:*
At the bottom of the results screen, the original uploaded image is displayed for reference. The agent should be able to glance at the actual label to verify anything the tool flagged.

*Actions:*
A "New Review" button clears everything and returns to Screen 1. An "Export" option lets the agent save or print the results.

---

**Screen 4: Standalone Mode (No Application Data)**

When the user uploads an image but enters no application data, the results screen adapts:

- Banner says "STANDALONE COMPLIANCE CHECK" (in a neutral color, not red/amber/green since there's nothing to compare against)
- The results table shows only the extracted fields and their format compliance — no comparison column
- Each row shows what was extracted and whether it meets TTB formatting rules (e.g., ABV format is valid, warning text is correct)
- Below the results, a prominent call-to-action: "Enter application data for full comparison →" — clicking this takes the user back to the form with the extracted values pre-filled, so they can quickly run a comparison without re-typing

---

**Error States Claude Code Must Handle:**

Build visual states for each of these scenarios:

- User tries to upload a non-image file → Friendly message: "Please upload a JPEG, PNG, or PDF file."
- User tries to upload a file over 10MB → "This file is too large. Please upload an image under 10MB."
- Processing takes too long → "Processing is taking longer than expected. This can happen with complex labels. Please wait or try again."
- The backend returns an error → "Something went wrong while analyzing this label. Please try again. If the problem persists, try uploading a clearer image."
- The AI extraction returns low confidence → Yellow warning banner above results: "Image quality may affect accuracy. Some results have lower confidence. Consider uploading a clearer photo."
- No text could be extracted at all → "We couldn't read any text from this image. This may be due to image quality, angle, or lighting. Please try uploading a clearer photo."

These should never show raw technical errors, status codes, or stack traces. Every message should tell the user what happened and what they can do about it.

---

**What Claude Code Should Research (Phase 1):**
- How compliance and audit tools in government settings present pass/fail results — look at IRS, FDA, and customs inspection UIs for patterns agents are already familiar with
- Accessible color palettes for three-tier status indicators that work for colorblind users — explore icon-only approaches as primary, color as reinforcement
- Character-level text diff displays — how do code review tools (GitHub, GitLab) and document comparison tools (Word track changes) present granular differences? The government warning diff view should feel intuitive to non-technical users
- Form UX patterns for conditional field visibility — how do the best form builders handle fields that appear/disappear based on a dropdown selection without confusing the user

**What Claude Code Should Consider (Phase 1):**
- The primary user (Dave, 28 years experience, prints his emails) has zero tolerance for confusing UI. If he has to figure out how to use this, he won't. Every action must be self-evident.
- Jenny has a literal printed checklist on her desk. The results view should feel like a digital version of that physical artifact — vertical list, one item per row, checkbox-like indicators.
- The results table will have variable length depending on beverage type (spirits have more checks than beer). The layout must handle 8-14 rows gracefully without becoming overwhelming.
- The government warning expanded view is the most data-dense component. It has 8 sub-checks, a full text block, a character diff, and a confidence score. This must be structured clearly, not dumped as a wall of information.
- Sarah described agents who vary widely in tech comfort. Consider adding subtle instructional hints (not a tutorial) — placeholder text in fields showing expected format, a one-line description of what the tool does on the landing state.

**Edge Cases Claude Code Must Handle (Phase 1):**
- User uploads an image and immediately clicks "Verify" before entering any application data — this is the standalone mode path and should work without error
- User fills in application data but forgets to upload an image — show a clear, non-aggressive error pointing to the image upload zone
- User switches beverage type after filling in wine-specific fields — the wine fields should hide, and the data entered in them should not persist or cause problems
- User uploads a very tall or very wide image (panoramic screenshot vs vertical phone photo) — the preview and image viewer must handle extreme aspect ratios
- The results table has a mix of PASS, REVIEW, and FAIL — the expanded detail panels for all three states must be visually distinct so the agent can scan status without reading
- User clicks "New Review" — all state must be fully cleared, no remnants of the previous review

---

**Claude Code Phase 1 Deliverable:**
A fully interactive single-label review application. Upload an image, fill in application data, click verify, see processing animation, see detailed results with expandable rows and government warning deep-check. Works end-to-end with hardcoded sample data. Every screen, every state, every error message is built and demonstrable.

---

### Codex — Phase 1: The Intelligence Engine

Codex builds the complete extraction and validation pipeline. Its goal is to accept a label image (and optional application data) and return a result that powers every element of the frontend's results screen.

---

**Capability 1: Label Text Extraction**

The system must be able to accept an image of an alcohol beverage label and extract all relevant text from it using an AI vision model. The extraction should return:

- Every identifiable field on the label: brand name, class/type designation, alcohol content, net contents, government warning statement, bottler/producer name and address, country of origin, age statement, sulfite declaration, appellation of origin, vintage year, varietal designations
- For each field, a confidence score (0 to 1) indicating how certain the AI is about the extraction
- For the government warning specifically: whether the prefix "GOVERNMENT WARNING" appears to be in all capitals, whether it appears visually bolder than the surrounding text, whether the statement appears to be one continuous block of text, and whether it appears visually separated from other label content
- If a field is not present on the label, it should be reported as absent rather than guessed

The extraction must complete within approximately 3 seconds for a single label image. This is the primary performance bottleneck — the entire pipeline target is under 5 seconds, and every downstream step should be near-instantaneous.

The extraction prompt to the AI model is the single most critical engineering artifact in the entire project. It determines the quality of everything downstream. Codex should invest significant effort crafting, testing, and iterating this prompt against all 6 test labels until results are consistently accurate.

---

**Capability 2: Beverage Type Detection**

The system must determine whether a label is for distilled spirits, a malt beverage (beer), or wine. This determination controls which validation rules apply.

If the user provides application data including the beverage type, use that value. Otherwise, the system should infer the beverage type from the extracted class/type text. Common indicators:
- Spirits: whiskey, bourbon, vodka, gin, rum, tequila, brandy, liqueur, cordial
- Malt beverages: ale, lager, stout, porter, IPA, malt beverage, beer
- Wine: wine, pinot, chardonnay, merlot, cabernet, rosé, champagne, cider (>7% ABV)

If ambiguous, default to distilled spirits (most common and most strict rules).

---

**Capability 3: Field-by-Field Comparison**

When application data is provided, the system must compare each application field against the corresponding extracted label field. The comparison should produce one of three outcomes for each field:

**Pass** — The values match. For text fields, this means exact match. For alcohol content, the numeric value matches within the ±0.3 percentage point tolerance allowed by TTB regulations.

**Review** — The values are likely the same but have cosmetic differences that need human verification. Specifically:
- Case differences (e.g., "STONE'S THROW" vs "Stone's Throw") should trigger Review, not Fail. This is a direct requirement from stakeholder interviews — veteran agent Dave explicitly described this scenario and said it requires judgment, not automatic rejection.
- Minor whitespace or spacing differences should trigger Review.
- Very small textual differences (1-2 characters different) should trigger Review.
- When a numeric match exists but the format differs (e.g., "45%" in the application vs "45% Alc./Vol. (90 Proof)" on the label), the value comparison should Pass but the format should be checked separately.

**Fail** — The values clearly don't match, or a required field is entirely missing from the label.

Every result must include a plain-English explanation of why it received its status, and the specific TTB regulation being checked (the CFR citation). These explanations appear in the frontend's expandable detail panels.

---

**Capability 4: Format Compliance Checking**

Independent of whether values match the application, the system must check whether each field on the label meets TTB formatting requirements. Key format rules:

*Alcohol Content Format:*
- The abbreviation "ABV" is not permitted on any alcohol beverage label per TTB regulations. The approved formats use "Alc." and "Vol." (e.g., "45% Alc./Vol.")
- For distilled spirits, proof may optionally appear in parentheses alongside the mandatory percentage statement
- For malt beverages, alcohol content is optional at the federal level unless the product contains alcohol from added flavors
- For all types, the tolerance is ±0.3 percentage points from the labeled content

*Net Contents Format:*
- Distilled spirits must use metric measures (mL, L)
- Malt beverages must use U.S. measures (fluid ounces, pints, quarts) with specific rules per size range
- Wine must use metric measures (milliliters for containers under 1 liter, liters for larger)

*Government Warning Format:*
See Capability 5 below — this is complex enough to warrant its own section.

---

**Capability 5: Government Warning Deep Validation**

The government warning is the most commonly rejected element of COLA applications. The system must perform an exhaustive check with the following sub-validations:

The exact required text is:

GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

Sub-checks:
1. **Presence** — Is any government warning text present on the label?
2. **Text accuracy** — Does the text match word-for-word? Perform a word-by-word comparison and identify any discrepancies.
3. **Capitalization of prefix** — Are the words "GOVERNMENT WARNING" in all capital letters? (Title case like "Government Warning" is a common and rejected error.)
4. **Bold formatting of prefix** — Does "GOVERNMENT WARNING" appear visually bolder or heavier than the rest of the statement? (Required by regulation. The remainder must NOT be bold.)
5. **Internal capitalization** — Are "Surgeon" and "General" properly capitalized?
6. **Punctuation** — Are all punctuation marks present? Specifically: colon after "WARNING", parentheses around "(1)" and "(2)", comma after "General", period after "defects", comma after "machinery", period after "problems".
7. **Continuous paragraph** — Does the statement appear as one unbroken block of text, not split across separate sections?
8. **Separation** — Does the statement appear visually separate from other label content?

For the text comparison, the system should produce a character-level diff showing exactly where the extracted text diverges from the canonical text. This diff is displayed in the frontend.

---

**Capability 6: Cross-Field Dependency Validation**

Some validation rules involve relationships between multiple fields. The system must check:

*Wine-specific:*
- If a vintage year appears on the label, an appellation of origin must also be present. Missing appellation when vintage is shown is a rejection-worthy error.
- If a varietal designation appears on the label, an appellation of origin must be present on the brand label.
- If multiple varietals are listed, their percentages must be shown and must total 100%.

*Spirits-specific:*
- The brand name, alcohol content, and class/type designation must all appear in the same field of vision (defined as 40% of a cylindrical container's circumference). The system should assess whether the spatial positions of these three elements suggest they're on the same side of the container. If the system cannot determine this from a single image, it should flag it for human review rather than passing or failing.
- If the class/type indicates whisky and the product is aged less than 4 years, an age statement is mandatory.

*All types:*
- If the product is imported, a country of origin statement must be present on the label.

---

**Capability 7: Image Quality Assessment**

Before or alongside extraction, the system should assess the quality of the uploaded image. If the image is blurry, dark, rotated, or has glare, the system should:
- Still attempt extraction (don't reject outright — agents currently reject bad images, and doing better than that is a differentiator)
- Include a quality score in the response
- Flag any fields where extraction confidence is low due to image quality
- The frontend uses this score to show a warning banner suggesting the user upload a clearer image

---

**Capability 8: Overall Recommendation**

After all checks are complete, the system must produce an overall recommendation:
- **Approve** — Every field passed. No issues found.
- **Review** — Some fields have cosmetic differences or uncertain extractions, but nothing is clearly wrong. An agent should look at the flagged items.
- **Reject** — One or more fields have clear violations: missing required information, wrong government warning text, forbidden ABV format, missing appellation when vintage is present, etc.

The response must also include a summary count of how many fields passed, how many need review, and how many failed.

---

**Capability 9: No Data Persistence**

The system must not store uploaded images, application data, or results after the response is returned. Everything is processed in memory and discarded. This is a deliberate security design decision — Marcus from IT mentioned PII considerations and document retention policies. For a prototype, the simplest and safest approach is to persist nothing.

---

**Capability 10: Performance Target**

The complete pipeline — from receiving the image to returning the full result — must complete in under 5 seconds for a single label. This is a hard requirement derived from stakeholder interviews. The previous scanning vendor pilot failed because processing took 30-40 seconds, and agents abandoned it. If this tool is slow, nobody will use it.

The extraction step (the AI vision call) will be the bottleneck. Everything downstream — comparison, validation, aggregation — should be near-instantaneous since it's deterministic logic, not AI inference.

---

**What Codex Should Research (Phase 1):**
- The TTB Beverage Alcohol Manuals for each commodity — these are the authoritative source for what's required on each label type and how it must be formatted
- The TTB mandatory labeling checklists (PDF documents on ttb.gov) — these are the literal checklists agents use during review and define every field and check
- 27 CFR Part 16 (Alcoholic Beverage Labeling Act regulations) — the complete legal requirements for the government warning
- 27 CFR Parts 4, 5, and 7 — labeling regulations for wine, distilled spirits, and malt beverages respectively
- TTB's "Avoiding Common Errors" guidance pages — these describe the most frequent reasons labels are rejected and directly inform which checks to prioritize
- How vision models handle bold text detection — the government warning requires "GOVERNMENT WARNING" to be bold, and the system needs to assess this from an image
- How vision models handle curved, distorted, or partially obscured text on bottle surfaces
- String similarity algorithms for fuzzy matching — understanding the spectrum from exact match to near-miss to clear mismatch for the three-tier result system
- The TTB Public COLA Registry — real examples of approved labels with their application data, useful for understanding what correct labels actually look like

**What Codex Should Consider (Phase 1):**
- The AI extraction prompt is the single most important engineering artifact in the project. A mediocre prompt produces mediocre results that cascade through the entire pipeline. Invest heavily in prompt iteration against all 6 test labels.
- Keep AI calls to a minimum. Every additional model call adds 1-3 seconds. Ideally, the entire pipeline uses one vision model call for extraction and everything else is deterministic rules. Two calls maximum.
- The comparison engine must be deterministic, not AI-driven. String comparison, format checking, and cross-field validation should be rule-based logic that produces consistent, reproducible results. Don't ask the AI "does this match?" — extract the text with AI, then compare it with rules.
- Dave's "STONE'S THROW" example is the acid test. If the system hard-fails on case differences, agents will dismiss it. If it wisely flags case differences as "Review," agents will trust it. This single design decision determines adoption.
- The government warning is the showcase. TTB says it's the #1 reason for rejections. If the tool catches a missing comma after "machinery" that a human would miss during word-by-word reading, you've proven the value proposition in one demo.
- Consider what happens when the AI hallucinates a field — reporting text that isn't actually on the label. Low confidence scores should protect against this, but the system should never present a hallucinated extraction as high-confidence.

**Edge Cases Codex Must Handle (Phase 1):**
- The image contains both front and back label panels — the extraction should attempt to read both and correctly attribute fields to the appropriate panel
- The government warning is present but partially cut off at the image edge — report what was extracted with low confidence rather than claiming it's missing
- The ABV contains both percentage and proof ("45% Alc./Vol. (90 Proof)") — the numeric comparison should use the percentage value, and the proof should not cause a mismatch
- A wine label lists "Red Wine" as the class/type but also has a varietal ("Merlot") elsewhere — the system must determine which is the official class/type designation
- The brand name contains numbers or symbols ("1792 Small Batch", "JACK & COLA") — fuzzy matching must handle special characters correctly
- The application data contains the ABV as just a number ("45") while the label says "45% Alc./Vol." — numeric extraction and comparison must normalize these
- The label is for a spirit aged exactly 4 years — the age statement is NOT required (the rule is "less than 4 years"), so the system should not flag its absence
- The label text is in English but the brand name is in another language or script — the system should extract what it can and flag low-confidence characters
- The net contents says "75cL" (centiliters, common in European imports) instead of "750 mL" — the system should recognize these as equivalent or flag for review

---

**Codex Phase 1 Deliverable:**
A working endpoint that accepts a label image and optional application data, and returns a complete result covering every element the frontend needs to render its results screen. Tested against all 6 test labels with correct results and processing time under 5 seconds.

---

### Integration Gate 1

Codex wires real results into the frontend's existing UI, refactoring the frontend's data consumption as needed.

**Verification checklist:**
- Upload each of the 6 test labels individually. Results render correctly.
- For the perfect label: all fields pass, green banner, correct summary count.
- For the warning error label: warning field fails, expanded detail shows the specific sub-check failures and character diff.
- For the brand name mismatch label: brand name shows as Review (not Fail), with the case difference explanation.
- For the wine label: cross-field check shows failure (vintage present, appellation missing).
- For the beer ABV label: ABV format check shows failure (forbidden "ABV" abbreviation).
- For the low-quality image: quality warning appears, some fields show lower confidence.
- Upload an image with no application data: standalone mode renders correctly.
- Try uploading a non-image file: error message appears.
- Total processing time for each label is under 5 seconds.

---

## PHASE 2: Batch Processing

### Claude Code — Phase 2: Batch Upload & Dashboard

---

**Screen 5: Batch Upload**

A separate mode accessed via the "Batch Upload" link from the main screen, or a toggle/tab at the top of the app. The batch upload screen has:

*Image upload zone:*
A large drop area that accepts multiple image files at once. Shows a count after upload: "47 images uploaded" with a scrollable strip of filename thumbnails. Maximum 50 files for the prototype.

*Application data upload:*
A second drop area for a CSV file containing application data for all labels. A downloadable CSV template link is provided so users know the expected column format. The template columns should match the application data fields: filename, beverage type, brand name, class/type, alcohol content, net contents, name and address, origin, country, appellation, vintage, varietals.

After both are uploaded, the screen shows a confirmation: "47 images matched to 47 application rows" (or an error if counts don't match).

A "Process Batch" button starts the batch.

Application data CSV is optional — the batch can run in standalone mode for all labels if no CSV is provided.

---

**Screen 6: Batch Processing Progress**

While the batch processes:
- A progress bar showing completion: "Processing 23/47..."
- Results stream in as they complete — a growing table showing each label's brand name, beverage type, and status (pass/review/fail) as it finishes
- The user can already click into completed results while others are still processing

---

**Screen 7: Batch Results Dashboard**

After processing completes (or while results are still streaming in), the dashboard shows:

*Summary cards:*
Three large cards at the top showing counts — Approve (green), Review (amber), Reject (red). These give an instant picture of the batch.

*Filter and sort controls:*
Toggle buttons to filter: "Show All" / "Failures Only" / "Reviews Only" / "Approved Only"
Sort dropdown: by status (failures first), by brand name, by issue count.

*Results table:*
A sortable table with columns: Row number, Brand Name, Beverage Type, Overall Status, Number of Issues, and a "View" action button.

Clicking "View" on any row opens the full individual result — the same results screen from Screen 3, showing the complete comparison and checklist for that specific label. A "Back to Dashboard" action returns to the batch view.

*Export:*
An "Export CSV" button generates a downloadable CSV with the batch results: row number, filename, brand name, beverage type, recommendation, issue count, and a summary of issues for each label.

---

**What Claude Code Should Research (Phase 2):**
- How spreadsheet tools and data dashboards present large result sets with filtering — look at Airtable, Notion databases, and Google Sheets for sortable/filterable table patterns that non-technical users understand
- How file upload interfaces handle multi-file drag-and-drop — look at WeTransfer, Google Drive upload, and Dropbox for patterns around progress feedback and error handling with many files
- CSV template download patterns — how do banking and government import tools provide template files and communicate expected formats

**What Claude Code Should Consider (Phase 2):**
- Janet handles 200-300 labels at once. Even with a 50-label prototype cap, the dashboard must feel like it scales. A table of 50 rows must be scannable in seconds, not minutes. Default sort should put failures first — that's what Janet needs to see immediately.
- The drill-down from dashboard to individual result and back must be seamless. If Janet loses her place in the batch every time she views a detail, the tool is useless at scale.
- The CSV template download is a critical detail. If Janet has to guess the column format, she'll get it wrong and the batch will fail. The template must be self-documenting with example rows.
- Streaming results (showing each label as it completes rather than waiting for all to finish) dramatically improves the experience. Even if technically complex, it lets Janet start reviewing immediately instead of staring at a progress bar.

**Edge Cases Claude Code Must Handle (Phase 2):**
- User uploads 50 images but no CSV — the batch should run all 50 in standalone mode, not error out
- User uploads images and a CSV but the filenames don't match any CSV rows — show a clear matching error with specific files that couldn't be matched
- Batch processing is underway and the user accidentally navigates away — consider warning them that processing will be interrupted
- The batch dashboard has all 50 results as "Approve" — the empty states for the "Failures" and "Reviews" filters should say something helpful, not just show a blank table
- CSV export with special characters in brand names — the exported file must handle Unicode correctly

**Claude Code Phase 2 Deliverable:**
Fully interactive batch processing experience with hardcoded sample data. Upload multiple images, see processing progress, see dashboard with summary cards and filterable/sortable table, drill into individual results, export CSV.

---

### Codex — Phase 2: Batch Processing Capability

---

**Capability 11: Batch Processing**

The system must accept multiple label images and an optional CSV of application data, and return individual results for each label.

Key requirements:
- Accept up to 50 images in a single request
- Parse the CSV and match each row to its corresponding image (by filename or by sequence order)
- Process each image-application pair through the same pipeline used for single labels
- Process labels concurrently to keep total batch time reasonable
- Handle partial failures gracefully: if one label fails to process (bad image, API error), include it in results with an error status but continue processing the rest of the batch
- If the CSV has fewer rows than images, or vice versa: process what can be matched, flag the unmatched ones
- Return results in a structure that includes per-label results and batch-level summary counts

**Capability 12: CSV Template**

Provide a downloadable CSV template file with the correct column headers. The template should include one or two example rows showing the expected data format for each column.

---

**What Codex Should Research (Phase 2):**
- Rate limiting policies of the AI provider being used — how many concurrent vision requests can be made without hitting throttling
- Approaches for concurrent image processing — balancing parallelism with rate limits and reliability
- CSV parsing edge cases — encoding detection, delimiter handling, quoted fields with commas, line endings across operating systems

**What Codex Should Consider (Phase 2):**
- Batch processing is the single label pipeline run N times. Do not build a separate pipeline for batch — reuse the exact same logic and wrap it in concurrency management.
- Partial failure is the default assumption. In a batch of 50, at least one will fail (bad image, API timeout, malformed data). The system must never let one failure kill the entire batch.
- The AI provider may throttle concurrent requests. Find the parallelism sweet spot that maximizes throughput without triggering rate limits. Start conservative and increase.
- The batch response must include enough information for the frontend to render the dashboard without making additional API calls — summary counts, per-label brand names and statuses, and full detail for drill-down.

**Edge Cases Codex Must Handle (Phase 2):**
- CSV has more rows than images, or images exceed CSV row count — process what matches, flag the rest
- CSV has duplicate filename references — flag as an error rather than silently processing one and ignoring the other
- One image in the batch causes an AI API timeout — report that specific label as an error, continue processing the remaining labels
- CSV uses semicolons instead of commas as delimiters (common in European locales) — detect and handle, or flag clearly
- The batch hits the AI provider's rate limit mid-processing — implement backoff and retry rather than failing
- Empty or whitespace-only rows in the CSV — skip gracefully
- A CSV with correct headers but all fields empty except filename — process each as standalone (no application data)

**Codex Phase 2 Deliverable:**
Working batch processing capability that handles up to 50 labels at once, returns individual results per label plus batch summary, and handles edge cases gracefully.

---

### Integration Gate 2

Codex connects the batch backend to the batch frontend.

**Verification checklist:**
- Upload all 6 test labels as a batch with a matching CSV. Dashboard shows correct summary.
- Filter to "Failures Only" — shows the expected failing labels.
- Drill into each result — individual results render correctly.
- Export CSV — opens and has correct data.
- Try a batch with no CSV (standalone batch) — all labels process in standalone mode.
- Try a batch with mismatched counts — appropriate error or partial processing.
- Batch processing time is reasonable for the number of labels.

---

## PHASE 3: Polish & Production Readiness

### Claude Code — Phase 3: Refinement

---

**Standalone / Auto-Fill Mode Refinement:**
When results appear in standalone mode (no application data), the extracted values should be presented in an editable format. The user can correct anything the AI got wrong, then click a "Run Full Comparison" action that uses those edited values as the application data and re-runs the comparison. This effectively turns the extraction into a pre-filled form.

**Error State Refinement:**
Review every error state and ensure the messages are warm, helpful, and actionable. No technical jargon. No blame. Every error should answer: "What happened?" and "What should I do?"

**Accessibility:**
- Status indicators use icons alongside colors (checkmark, warning triangle, X) so colorblind users can distinguish them
- All interactive elements are keyboard-navigable in a logical tab order
- Text meets minimum contrast ratios (4.5:1 for normal text)
- Form fields have visible labels (not just placeholders)
- The app is usable at 200% browser zoom without breaking

**Responsive Behavior:**
Primary users are on desktop workstations, but the layout should not break on a tablet. At narrow widths, the upload zone and form should stack vertically. The results table should scroll horizontally if needed. Summary cards should stack.

**Empty and Loading States:**
Every component should have a meaningful state before any interaction:
- The main area before any upload: brief welcome text explaining what the tool does and who it's for
- The image drop zone: clear instruction text with supported formats listed
- Form fields: helpful placeholder text showing expected format (e.g., "e.g., Kentucky Straight Bourbon Whiskey" in the Class/Type field)
- Batch dashboard before any processing: "Upload labels to begin batch processing"

**What Claude Code Should Consider (Phase 3):**
- Accessibility is not optional polish — half the team is over 50, and Sarah specifically benchmarked usability against her 73-year-old mother. Test with browser zoom at 150% and 200%. Test with high-contrast mode. Test with a screen reader if possible.
- The auto-fill / standalone refinement is a significant trust-building feature. When agents see the AI correctly extract all fields from a label image, they gain confidence in the tool's intelligence before they even run a comparison.

---

### Codex — Phase 3: Hardening & Optimization

---

**Extraction Prompt Refinement:**
Based on testing during integration, iterate on the AI extraction prompt to handle edge cases discovered during real usage. Common issues: labels with decorative fonts, labels where text wraps around curved surfaces, labels with multiple panels visible in one photo, labels with non-English text alongside English-required fields.

**Performance Verification:**
Profile the pipeline and verify every single-label request completes in under 5 seconds on the deployed infrastructure. If any requests exceed this threshold, identify the bottleneck and optimize. The AI extraction call will be the dominant cost — consider whether the prompt can be simplified while maintaining accuracy.

**Input Validation:**
Verify the system handles malformed input gracefully: corrupted image files, empty uploads, extremely large files, CSV files with wrong columns, CSV files with encoding issues. Every invalid input should produce a helpful error, never a crash.

**Security Posture:**
- Confirm no uploaded data is persisted anywhere — not in logs, not in temporary files, not in any database
- Confirm the AI model provider does not retain submitted images (verify their data retention policy)
- Implement basic rate limiting to prevent abuse of the AI API

**What Codex Should Consider (Phase 3):**
- Test with real-world label images beyond the 6 test labels. AI-generated test labels are cleaner than real photos. Find or photograph actual bottle labels to test extraction robustness.
- The extraction prompt may need iteration based on integration testing. Common failure modes: decorative fonts misread, curved text mangled, glare regions producing garbled output, warning statement punctuation subtly wrong.
- Production infrastructure may have different latency characteristics than local development. Profile end-to-end on the deployed environment, not just locally.
- Document the AI provider's data handling policy in the README. Marcus explicitly flagged that their firewall blocked the previous vendor's ML endpoints. Knowing and documenting where data flows builds trust.

---

### Integration Gate 3

Final end-to-end verification on the production deployment.

**Verification checklist:**
- Both agents' work is tested together on the live production URLs
- Run all 6 test labels in single mode — all produce correct results
- Run all 6 test labels as a batch — dashboard renders correctly
- Test standalone mode — extraction and auto-fill work
- Test error states — bad image, oversized file, no image submitted
- Cross-browser check: Chrome and Firefox at minimum
- Check that the app loads quickly and feels snappy
- Have someone who hasn't seen the project try to use it cold — watch where they get confused
- Verify processing times on production infrastructure

---

## PHASE 4: Documentation & Submission

---

**README — What It Must Cover:**

*Overview:*
What the tool does, who it's for (TTB compliance agents), the problem it solves (automating the visual matching work that takes agents 5-10 minutes per label).

*Live Demo:*
Link to the deployed application.

*How to Run Locally:*
Step-by-step setup instructions for both frontend and backend. Someone should be able to clone the repo and have it running in under 10 minutes.

*Approach:*
Describe the architecture at a conceptual level. How does the system work? What AI model is used and why? What validation logic is deterministic vs. AI-driven? Why was the architecture structured this way?

*Assumptions Made:*
Document every gap that was filled independently. This is explicitly part of the evaluation criteria ("we also value how you fill in gaps independently"). Key assumptions to document:
- The government warning text was researched from 27 CFR Part 16 and TTB.gov and hardcoded, since the assignment only referenced "standard government warning text" without providing it.
- Brand name comparison uses case-insensitive fuzzy matching based on Dave Morrison's interview feedback about cosmetic differences requiring judgment, not automatic rejection.
- Beverage-type-specific validation rules were researched from TTB's Beverage Alcohol Manuals and mandatory labeling checklists.
- No data is persisted after processing, as a deliberate security decision informed by Marcus Williams' comments about PII and document retention.
- The prototype uses a cloud AI API. A production deployment would need to operate within TTB's FedRAMP-authorized Azure environment.
- The tool is intentionally standalone and does not integrate with the COLA system, per Marcus's direction.
- The tool produces recommendations, not decisions. The agent always has final authority.

*Trade-offs and Limitations:*
Document honestly what the tool cannot do and why:
- Same-field-of-vision assessment is simplified since true container geometry analysis from a single photo is unreliable
- Bold text detection for the government warning relies on AI visual assessment and may not be 100% accurate for all font weights
- Batch processing is capped at 50 labels for the prototype
- The tool cannot verify that the physical font size on the label meets TTB minimum type size requirements (1mm, 2mm, 3mm depending on container) since pixel-to-millimeter conversion requires knowing the actual container dimensions

*Business Impact:*
Include the math: 150,000 labels per year, 47 agents, approximately 13 labels per agent per day. The previous pilot failed because it took 30-40 seconds per label. This tool processes labels in under 5 seconds. Even a 3-minute time savings per label across the team would recover approximately 7,500 work hours annually — equivalent to 3.6 full-time agents' worth of capacity.

*Test Labels:*
Describe each of the 6 test labels and what validation scenario it demonstrates. This gives evaluators a guided tour of the tool's capabilities.

*Future Enhancements:*
What a production version would add: integration with the COLA system API, deployment within the Azure/FedRAMP environment, agent workflow tracking and analytics, support for multi-image labels (front + back of the same bottle), historical comparison against previously approved labels, integration with the TTB Public COLA Registry.

---

**Code Cleanup:**
- Remove dead code, debugging artifacts, and leftover comments
- Consistent formatting throughout
- Brief comments on complex logic sections
- All configuration values externalized (no hardcoded API keys or URLs)

**Final Smoke Test:**
- Fresh clone the repo. Follow the README from scratch. Verify it runs.
- Verify the deployed URLs are stable.
- Submit.

---

## PHASE ORDERING SUMMARY

```
Phase 0 ──── Shared setup: test labels, shared context, repo init

Phase 1 ──── Claude Code builds single-label UI with sample data
             Codex builds extraction + validation engine
             Integration Gate 1: Codex wires real data into UI

Phase 2 ──── Claude Code builds batch UI with sample data
             Codex builds batch processing capability
             Integration Gate 2: Codex wires batch backend to batch UI

Phase 3 ──── Claude Code polishes UI: accessibility, errors, responsiveness
             Codex hardens backend: performance, edge cases, security
             Integration Gate 3: Final end-to-end production verification

Phase 4 ──── README, code cleanup, final smoke test, submit
```

---

## WHAT EACH AGENT SHOULD OPTIMIZE FOR

**Claude Code — Optimize for:**
- A user experience that feels like it was designed BY a compliance agent FOR compliance agents
- The printed-checklist mental model — Jenny literally described having one on her desk
- Speed of comprehension — an agent should know the verdict within 1 second of seeing results
- The government warning detail view being genuinely useful, not just a data dump
- Error messages that respect the user's intelligence without assuming technical knowledge
- The batch dashboard being a genuine productivity tool, not just a list of results

**Codex — Optimize for:**
- Extraction accuracy — the AI prompt is the most important artifact in the entire project
- Processing speed — under 5 seconds, no exceptions, validated on production infrastructure
- The three-tier result system (Pass/Review/Fail) actually matching what a human compliance agent would decide — if the tool fails on obvious cosmetic differences, agents will stop trusting it immediately
- The government warning validation being genuinely thorough — this is the most commonly failed element in real COLA submissions and the tool's showcase capability
- Clean separation between AI-powered steps and deterministic validation logic — the AI extracts, the rules engine validates
