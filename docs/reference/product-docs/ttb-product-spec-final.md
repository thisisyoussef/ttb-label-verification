# TTB Label Verification App — Product Specification
## User Stories, UX Flows, Validation Rules & Domain Research

---

# SECTION 1: USER STORIES

## Epic 1: Single Label Review (Core)

### US-1.1: Upload Label Image
**As** a compliance agent,
**I want to** upload a photo of a label
**So that** the system can extract the text and validate it against TTB requirements.

**Acceptance Criteria:**
- Accepts JPEG, PNG, WEBP, PDF formats
- Supports drag-and-drop and file picker
- Shows image preview immediately after upload
- Displays a loading indicator during AI extraction (under 5 seconds total)
- Handles images up to 10MB
- If image quality is poor (blurry, dark, glare), shows a confidence warning before results

---

### US-1.2: Enter Application Data
**As** a compliance agent,
**I want to** enter the COLA application data (Form 5100.31 fields) alongside the label image
**So that** the system can compare what the applicant claimed vs. what's actually on the label.

**Acceptance Criteria:**
- Form includes fields: Brand Name, Fanciful Name, Class/Type, Beverage Type (dropdown: Distilled Spirits / Malt Beverage / Wine), Alcohol Content, Net Contents, Applicant Name & Address, Origin (Domestic/Imported + Country), Formula ID (optional), Appellation (wine only), Vintage (wine only), Varietal(s) (wine only)
- Beverage type selection dynamically shows/hides wine-specific fields
- All fields are optional — agents can run partial comparisons
- Form supports paste-in for quick data entry

---

### US-1.3: View Comparison Results
**As** a compliance agent,
**I want to** see a side-by-side comparison of application data vs. extracted label data
**So that** I can quickly identify matches, mismatches, and missing items.

**Acceptance Criteria:**
- Left column: Application data as entered
- Right column: AI-extracted label data with confidence scores
- Each field shows one of three statuses: PASS (green), REVIEW (amber), FAIL (red)
- Clicking any field row expands to show: the extracted text, the expected text, the specific TTB regulation being checked (CFR citation), and an explanation in plain English
- Overall recommendation at top: "Recommend Approval" / "Recommend Review" / "Recommend Rejection"
- Count summary: "8 Pass · 1 Review · 1 Fail"

---

### US-1.4: Government Warning Deep Validation
**As** a compliance agent,
**I want to** see a detailed character-level comparison of the government warning statement
**So that** I don't have to manually read it word-by-word anymore.

**Acceptance Criteria:**
- Shows canonical warning text alongside extracted warning text
- Character-level diff highlighting: red for missing/wrong characters, yellow for formatting issues
- Specific sub-checks displayed individually:
  - Text matches word-for-word
  - "GOVERNMENT WARNING" is all caps
  - "GOVERNMENT WARNING" is bold
  - Remainder is NOT bold
  - "Surgeon" and "General" are capitalized
  - Punctuation is correct (commas, periods, colons, parentheses)
  - Appears as continuous paragraph
  - Appears separate from other label information
- If warning is completely missing, shows FAIL with the full canonical text for reference

---

### US-1.5: Beverage-Type-Aware Validation
**As** a compliance agent,
**I want** the checklist to adapt based on whether I'm reviewing spirits, beer, or wine
**So that** I only see relevant checks and don't get false flags for rules that don't apply.

**Acceptance Criteria:**
- When beverage type = Distilled Spirits:
  - ABV is marked MANDATORY
  - Same-field-of-vision check is active (brand + ABV + class/type)
  - Age statement check is active (mandatory if whisky under 4 years)
  - Net contents validates against metric standards of fill
- When beverage type = Malt Beverage:
  - ABV is marked OPTIONAL (unless flavored malt beverage)
  - No same-field-of-vision requirement
  - Net contents validates against U.S. measures (fl. oz, pints, quarts)
  - Geographic style qualification check ("Irish-Style" not "Irish")
- When beverage type = Wine:
  - Appellation/vintage/varietal cross-dependency checks active
  - Sulfite declaration check active
  - Varietal percentage totaling check active (must equal 100%)
  - Net contents validates milliliters/liters format

---

### US-1.6: Fuzzy Match Handling
**As** a senior compliance agent (Dave),
**I want** the tool to distinguish between real mismatches and obvious cosmetic differences
**So that** I don't waste time on false alarms like case differences in brand names.

**Acceptance Criteria:**
- Brand name comparison: case-insensitive match → REVIEW (not FAIL)
- Whitespace normalization: extra spaces → REVIEW
- Punctuation differences in brand name → REVIEW with note
- Class/type: case-insensitive → PASS (e.g., "Vodka" vs "VODKA")
- ABV: numeric value match regardless of format ("45%" vs "45% Alc./Vol.") → PASS with format check separately
- If brand name is completely different text → FAIL
- Each REVIEW item shows: "Likely cosmetic difference — recommend agent verification"

---

### US-1.7: Image-Only Mode (Auto-Fill)
**As** a compliance agent,
**I want to** upload just a label image without entering application data
**So that** I can get a standalone compliance check when I don't have the application handy.

**Acceptance Criteria:**
- If no application data is entered, tool runs "standalone validation" mode
- Checks all format rules (ABV format, warning text, net contents format) without comparison
- Extracted fields are displayed in an editable form so the agent can review/correct
- Agent can then optionally enter application data and re-run as a comparison
- Standalone results clearly labeled: "Standalone Check — No Application Comparison"

---

## Epic 2: Batch Processing

### US-2.1: Batch Upload
**As** a compliance agent handling large importers (Janet),
**I want to** upload multiple label images and their corresponding application data at once
**So that** I can process 50+ labels in one session instead of one at a time.

**Acceptance Criteria:**
- Multi-file drag-and-drop for images (up to 50 at once for prototype)
- Application data uploaded as CSV with columns mapping to Form 5100.31 fields
- System automatically matches images to application rows by filename or sequence
- Progress bar showing processing status: "Processing 23/50..."
- If matching fails, system prompts user to manually associate images with rows

---

### US-2.2: Batch Results Dashboard
**As** a compliance agent,
**I want to** see a summary dashboard of all batch results
**So that** I can quickly triage which labels need attention.

**Acceptance Criteria:**
- Summary stats at top: "32 Approve · 12 Review · 6 Reject"
- Sortable table with columns: #, Brand Name, Beverage Type, Status, Issues Count, Severity
- Filter buttons: "Show All" / "Failures Only" / "Reviews Only" / "Approved Only"
- Click any row to drill into individual label result (same view as single label)
- "Export to CSV" button for batch results
- Ability to mark individual labels as "Reviewed" or "Confirmed" to track progress

---

## Epic 3: UX & Accessibility

### US-3.1: Accessible for All Agents
**As** a compliance agent over 50 who isn't tech-savvy,
**I want** the interface to be dead simple with large text and obvious controls
**So that** I can use it without training or help.

**Acceptance Criteria:**
- Minimum 16px body text, 14px minimum anywhere
- High-contrast color scheme (WCAG AA minimum)
- No more than 2 clicks to get from upload to results
- No dropdown menus deeper than 1 level
- No horizontal scrolling on any screen
- Tab-navigable for keyboard users
- Color-blind safe status indicators (use icons + color, not color alone)
- Single-page application — no page transitions or navigation to learn

---

### US-3.2: Error States
**As** a compliance agent,
**I want to** see clear, helpful error messages when something goes wrong
**So that** I know what to do next instead of being stuck.

**Acceptance Criteria:**
- Image upload fails → "We couldn't process this image. Please check that it's a JPEG, PNG, or PDF under 10MB."
- AI extraction low confidence → "The image quality is low. Results may be incomplete. Consider uploading a clearer photo."
- AI extraction timeout → "Processing is taking longer than expected. Please try again."
- Network error → "Connection issue. Please check your network and try again."
- No errors should show raw error codes, stack traces, or technical jargon

---

# SECTION 2: UX FLOWS (Screen-by-Screen)

Detailed screen descriptions are provided in the Implementation Roadmap document. This section summarizes the flow sequence and key states.

## Flow A: Single Label Review (Happy Path)

**Screen 1 → Screen 2 → Screen 3**

1. **Starting State:** User sees image upload zone (left) and application data form (right). Beverage type dropdown controls which form fields appear.
2. **Processing State:** After clicking "Verify Label," a multi-step progress indicator shows extraction and validation in progress. Target: under 5 seconds.
3. **Results State:** Top banner shows overall recommendation with summary counts. Vertical checklist shows each field with pass/review/fail. Every row is expandable to show detailed explanation, regulation citation, and confidence score. Government warning row has special deep-check sub-view with character-level diff.

## Flow B: Standalone Mode

Same as Flow A, but user uploads image with no application data. Results show extracted fields with format compliance checks only (no comparison column). Extracted values are editable, and user can click "Run Full Comparison" to use them as application data.

## Flow C: Batch Processing

1. **Batch Upload:** Multi-file drop zone for images + CSV upload for application data. Shows file counts and matching confirmation.
2. **Batch Processing:** Progress bar with results streaming in row by row.
3. **Batch Dashboard:** Summary cards (approve/review/reject counts), filterable and sortable results table, drill-down into individual results, CSV export.

---

# SECTION 3: VALIDATION RULES

## Universal Requirements (All Beverage Types)

### Government Health Warning Statement

Required on all beverages with 0.5% ABV or higher.

The exact required text:

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

Format requirements:
- "GOVERNMENT WARNING" must be in ALL CAPITAL LETTERS
- "GOVERNMENT WARNING" must be in BOLD type
- The remainder of the statement must NOT be bold
- "Surgeon" and "General" must be capitalized
- All punctuation must be present and exact: colon after WARNING, parentheses around (1) and (2), comma after "General", period after "defects", comma after "machinery", period after "problems"
- Must appear as one continuous paragraph
- Must appear separate and apart from all other label information
- Minimum type sizes: 1mm for containers 237ml or less, 2mm for 237ml to 3 liters, 3mm for over 3 liters
- Foreign government warning statements are not permitted alongside the U.S. warning

### Brand Name
- Must appear on the label
- Must match the Brand Name field on the COLA application
- Must not be misleading about the product's age, origin, identity, or characteristics

### Name and Address
- Must show the name (or trade name) and address (city and state) as listed on the permit
- Must be preceded by a qualifying phrase such as "Bottled By," "Produced By," "Imported By"
- No intervening text between the qualifying phrase and the name/address

### Country of Origin
- Required on ALL imported beverages (per U.S. Customs and Border Protection regulations)
- Must comply with CBP format requirements

---

## Distilled Spirits — Specific Rules

| Field | Required? | Rules |
|-------|-----------|-------|
| Alcohol Content | MANDATORY | Must be stated as percentage of alcohol by volume. "ABV" abbreviation is NOT allowed. Allowed abbreviations: "Alc.", "Alc", "Vol.", "Vol", "%". Proof may appear optionally in parentheses. Tolerance: ±0.3 percentage points. |
| Same Field of Vision | YES | Brand name, alcohol content, and class/type designation must all be visible on the same side of the container simultaneously (40% of circumference for cylindrical containers). |
| Net Contents | MANDATORY | Must use metric standards of fill (e.g., 50mL, 200mL, 375mL, 750mL, 1L, 1.75L). |
| Class/Type | MANDATORY | Must be a recognized TTB class/type (e.g., "Vodka," "Kentucky Straight Bourbon Whiskey") or include a statement of composition. Must appear in the same field of vision as brand and ABV. |
| Age Statement | CONDITIONAL | Mandatory for whisky aged less than 4 years and grape brandy aged less than 2 years. Acceptable formats: "X Years Old," "Aged X Years," "Aged not less than X years." |
| State of Distillation | CONDITIONAL | Required for certain types of U.S. whisky if not distilled in the state shown in the address. |
| Commodity Statement | CONDITIONAL | Required if neutral spirits are used — must state percentage and commodity source. |
| Sulfite Declaration | CONDITIONAL | Required if product contains 10 ppm or more sulfur dioxide. |
| Coloring Disclosure | CONDITIONAL | Must disclose caramel coloring, artificial coloring, FD&C Yellow #5, cochineal extract, or carmine if used. |

---

## Malt Beverages (Beer) — Specific Rules

| Field | Required? | Rules |
|-------|-----------|-------|
| Alcohol Content | OPTIONAL* | Optional at the federal level. *Required only for malt beverages containing alcohol from added flavors or non-beverage ingredients (other than hops extract). If stated, same format rules apply: "ABV" abbreviation not allowed. Tolerance: ±0.3%. |
| Same Field of Vision | NO | No same-field-of-vision requirement for malt beverages. |
| Net Contents | MANDATORY | Must use U.S. measures. Complex rules by size: fluid ounces or fractions of a pint for under a pint; "1 Pint" exactly for that measure; pints and fluid ounces or fractions of a quart between pint and quart; etc. |
| Class/Type | MANDATORY | Must identify the type of malt beverage (e.g., "Ale," "Lager," "Stout"). Geographically significant styles made outside the named country must be qualified with "style" (e.g., "Irish-Style Red Ale" if made in USA, not "Irish Red Ale"). |
| Ingredient Declarations | CONDITIONAL | Required if product contains aspartame, sulfites, FD&C Yellow #5, or cochineal extract/carmine. |

---

## Wine — Specific Rules

| Field | Required? | Rules |
|-------|-----------|-------|
| Alcohol Content | MANDATORY | Required for wines 7% ABV and higher (under TTB jurisdiction). Table wines (7-14% ABV) may use "Table Wine" or "Light Wine" in lieu of a specific percentage. "ABV" abbreviation not allowed. |
| Appellation of Origin | CONDITIONAL | Not required on all labels. Becomes mandatory when a vintage date or varietal designation appears on the label. If using an American Viticultural Area (AVA), 85% of grapes must come from that area. State or county: 75%. |
| Varietal Designation | OPTIONAL | If used, it becomes the class/type and triggers the appellation requirement. When multiple varietals are listed, percentages of each must be shown and must total 100%. |
| Vintage Year | OPTIONAL | If included, appellation of origin becomes mandatory. |
| Sulfite Declaration | CONDITIONAL | Required if the product contains 10 or more parts per million of sulfur dioxide. If claiming no sulfites, TTB lab analysis must be submitted. |
| Net Contents | MANDATORY | Milliliters for containers under 1 liter, liters with decimals for containers over 1 liter. Minimum type size: 1mm for containers 187ml or less, 2mm for larger. |

---

## Cross-Field Dependency Rules

These rules involve relationships between multiple fields and must be checked as a group:

**Wine dependencies:**
- Vintage year present on label → appellation of origin MUST also be present
- Varietal designation present on label → appellation of origin MUST be present on the brand label
- Multiple varietals listed → percentages MUST be shown and MUST total 100%

**Spirits dependencies:**
- Brand name, ABV, and class/type → MUST appear in same field of vision
- Class/type indicates whisky + product aged less than 4 years → age statement MUST be present

**All types:**
- Product is imported → country of origin MUST be present on label

---

## The Three-Tier Result System

Every checked field must produce one of three outcomes:

**PASS (Green, Checkmark Icon)**
Exact match and correct format. No agent action needed.

**REVIEW (Amber, Warning Triangle Icon)**
Fuzzy match or minor formatting concern. The agent should look at this but it's probably fine. Examples: case differences in brand name, minor spacing variation, low extraction confidence on a field, ABV within tolerance but not exact.

Each REVIEW item must explain what triggered it and why it didn't fail: "Case difference detected — text matches when compared without case sensitivity. Likely the same brand name. Recommend agent verification."

**FAIL (Red, X Circle Icon)**
Clear violation. Missing required field, wrong government warning text, forbidden ABV format, missing appellation when vintage is present. These would result in a correction request or rejection in the real workflow.

Each FAIL must cite the specific TTB regulation violated and explain in plain English what needs to be fixed.

**Overall Recommendation Logic:**
- Any FAIL present → "Recommend Rejection"
- Any REVIEW present, no FAILs → "Recommend Review"
- All PASS → "Recommend Approval"

---

# SECTION 4: WHAT TO RESEARCH

Before building, research these topics to ensure accuracy and completeness:

### TTB Regulatory Research
- [ ] Read the TTB Beverage Alcohol Manuals (BAM) for each commodity: distilled spirits, malt beverages, and wine — these are the official guides to mandatory labeling
- [ ] Review the TTB mandatory labeling checklists for each beverage type (available as PDFs on ttb.gov) — these are the exact checklists agents use
- [ ] Read 27 CFR Part 16 (the Alcoholic Beverage Labeling Act regulations) for the full government warning requirements
- [ ] Review the TTB's "Avoiding Common Errors" guidance pages for each commodity — these tell you what actually gets rejected most often
- [ ] Check the TTB's Public COLA Registry to see examples of real approved labels and their associated application data
- [ ] Look at TTB's "Anatomy of a Label" interactive tools for each beverage type — visual guides to where things go on a label
- [ ] Research TTB's recent labeling modernization rules (T.D. TTB-158 and T.D. TTB-176) for the most current requirements
- [ ] Review the proposed "Alcohol Facts" NPRM from January 2025 to understand where regulations may be heading

### Technology & Integration Research
- [ ] Research image quality assessment techniques — how to programmatically determine if a photo is blurry, underexposed, or has glare before sending it to an AI model
- [ ] Investigate how vision models handle curved text on bottles — label text that wraps around a cylindrical surface is a common real-world challenge
- [ ] Explore approaches for detecting bold vs. regular text weight in images — this is critical for the government warning validation
- [ ] Research character-level text diff algorithms that produce clean, readable visual output
- [ ] Look into how existing OCR/vision tools handle decorative and script fonts common on alcohol labels
- [ ] Research the COLAs Online system architecture and Form 5100.31 field structure — understanding the source system helps model the comparison data correctly

### Competitive & Analogous Research
- [ ] Look at what the previous "scanning vendor" pilot might have been — understand why it failed (30-40 second processing times) and what architecture decisions led to that
- [ ] Research how other government agencies have implemented AI-assisted document verification (customs declarations, passport processing, tax form scanning)
- [ ] Look at commercial label compliance services (e.g., Bevlaw, Park Street) to understand how they describe the compliance checking process

---

# SECTION 5: WHAT TO CONSIDER

### Design Considerations

**The tool recommends — it does not decide.** The agent always has final authority. Every result screen must make clear that this is a recommendation for the agent's consideration, not an automated approval or rejection. Dave has seen modernization projects fail because they tried to replace agent judgment. This tool augments it.

**Match the agent's existing mental model.** Jenny described a printed checklist she goes through for every label. Your results screen should feel like a digital version of that checklist — vertical, sequential, one item at a time. Don't reinvent the workflow with cards, dashboards, or visualizations. A checklist is a checklist.

**Speed is a feature, not an optimization.** Sarah explicitly said the previous vendor failed because it was too slow. Under 5 seconds is not a nice-to-have — it's the difference between adoption and abandonment. If the tool can't beat a human eyeballing a label, nobody will use it.

**The app is a procurement demo.** Marcus said this prototype could "potentially inform future procurement decisions." That means the deployed URL might be shown to leadership. The landing state (before any upload) needs to look professional and explain what the tool does. A janky or confusing first impression kills the procurement conversation.

**Don't persist anything.** Marcus mentioned PII considerations and document retention policies. The simplest way to handle this for a prototype is to persist nothing — process in memory, return results, discard everything. Mention this explicitly in the README as a deliberate security decision.

**The standalone prototype is strategic, not limited.** Marcus explicitly said not to integrate with COLA. But frame this as an advantage in your README: a standalone tool that can be integrated via API in the future is a $0 path to value, versus the $4.2 million COLA rebuild that went nowhere.

### Validation Logic Considerations

**Fuzzy matching is the make-or-break design decision.** If the tool hard-fails on "STONE'S THROW" vs "Stone's Throw," Dave will dismiss it instantly and never use it again. If it shows "Case difference detected — recommend agent review," Dave thinks the tool is smart. Getting this threshold right determines agent trust and adoption.

**The government warning is the showcase feature.** This is the most commonly rejected element in real COLA applications. If your tool catches a missing comma after "machinery" or title-case "Government Warning" — errors that humans miss during word-by-word reading — you've proven the tool's value in one demo.

**Beverage type gates everything.** Getting the beverage type wrong means applying the wrong rules. A beer that's flagged for "missing ABV" when ABV is optional for beer will erode trust. A wine missing its appellation check because the tool thinks it's a spirit is a missed violation. The beverage type detection must be reliable.

**Not every check has equal weight.** A missing government warning is a guaranteed rejection. A brand name in different case is a judgment call. Your results should communicate this severity difference — not just pass/review/fail, but whether the issue is a minor note or a showstopper.

### Performance Considerations

**The AI extraction call is the bottleneck.** Everything else in the pipeline — comparison, validation, aggregation — should be near-instantaneous since it's rule-based logic, not AI inference. The total 5-second budget is essentially "AI extraction time + a few hundred milliseconds of processing."

**Batch processing multiplies the bottleneck.** 50 labels at 3 seconds each = 150 seconds serial. You need concurrent processing but must respect AI provider rate limits. Find the parallelism sweet spot that balances speed and reliability.

**Don't make two AI calls when one will do.** If you can combine image quality assessment with text extraction in a single vision model call, you save a full round trip. Every additional AI call is 1-3 seconds added.

---

# SECTION 6: EDGE CASES

### Image Edge Cases
- **Multiple label panels in one photo:** User photographs both front and back of a bottle in a single image. The system should attempt to extract from both visible labels.
- **Rotated or sideways images:** Label photographed at 90° or upside down. The vision model should handle common rotations.
- **Glare and reflections:** Glass bottles often have reflective surfaces. The extraction should attempt to read through mild glare and flag low confidence rather than failing silently.
- **Curved text:** Text that wraps around a cylindrical bottle surface appears distorted at the edges. This is extremely common and the extraction must handle it.
- **Decorative and script fonts:** Alcohol labels frequently use elaborate typography. Standard OCR may struggle with these. The AI vision model is the better approach here.
- **Extremely small text:** The government warning on small containers (under 237ml) can be as small as 1mm type. This may be difficult to extract from a photo.
- **Partially obscured labels:** Parts of the label hidden by the photographer's hand, a shelf, or another bottle.
- **High-resolution images:** Users may upload very large images (8+ megapixels). The system should handle these without crashing but may need to resize for API limits.

### Application Data Edge Cases
- **Missing beverage type:** The user doesn't specify whether it's spirits, beer, or wine. The system must infer from the class/type text or default safely.
- **Partial application data:** User enters only brand name and ABV, leaving everything else blank. The system should compare what's available and skip what's not.
- **Unicode and special characters in brand names:** Names with accented characters (é, ñ, ü), apostrophes, or ampersands. Comparison must handle these correctly.
- **Numeric formats in ABV:** Application says "45" vs "45%" vs "45% Alc./Vol." — all represent the same thing. The system must normalize before comparing.
- **Net contents unit confusion:** Application says "750ml" (no space, lowercase), label says "750 mL" (space, capitalized). These are the same value.

### Comparison Edge Cases
- **Brand name includes the class/type:** e.g., brand name "STONE'S THROW BOURBON" where "BOURBON" is both part of the brand and the class/type. The comparison should handle this without double-counting.
- **Multiple acceptable class/type designations:** Some products can be legally described multiple ways (e.g., "Gin" or "Distilled Gin"). A mismatch between two acceptable terms should be REVIEW, not FAIL.
- **Flavored spirits classification:** A product labeled as "Gin" but made with post-distillation flavoring should actually be classified as "Distilled Spirits Specialty." The tool may not catch this nuance but should flag unusual class/type combinations.
- **Wine blends with no dominant varietal:** A wine listing 4 varietals at 25% each. The system must verify all percentages are shown and sum to 100%.
- **Imported product with domestic bottler:** The label shows a U.S. bottler's name and address ("Imported by X, Bottled by Y"). Country of origin is still required.

### Government Warning Edge Cases
- **Warning present but in wrong language:** Some imported labels carry their home country's warning alongside (or instead of) the U.S. warning. The U.S. warning must be present, and foreign warnings are actually not permitted.
- **Warning split across label panels:** Part of the warning on the front label, part on the back. The regulation requires it to be a continuous paragraph.
- **Warning using stylized text:** The warning rendered in decorative font that makes "GOVERNMENT WARNING" technically present but difficult to read. TTB requires it to be "readily legible."
- **Extra text inserted into warning:** Applicant adds their own health message within or adjacent to the mandated text. The warning must appear separate and apart from other information.
- **Warning with smart quotes or typographic substitutions:** Curly quotes (") instead of straight quotes, em dashes instead of hyphens. These should be flagged as potential issues.
- **Warning correct but too small:** The text matches perfectly but is printed in a font size below the minimum requirement for the container size. The prototype likely cannot verify physical font size from a photo, but this limitation should be documented.

### Batch Processing Edge Cases
- **CSV encoding issues:** Files saved in different character encodings (UTF-8 vs Latin-1) may corrupt special characters in brand names.
- **CSV with extra or missing columns:** The file has columns the system doesn't expect, or is missing expected columns. Should process what it can and flag what it can't.
- **Mismatched counts:** 47 images uploaded but CSV has 45 rows. The system should process the 45 matched pairs and flag the 2 unmatched images.
- **Duplicate filenames:** Two images with the same name. The system should flag this rather than silently overwriting.
- **One bad image in a good batch:** A corrupted file among 49 valid images. The system must process the 49 good ones and report an error for the bad one, not fail the entire batch.
- **Empty CSV rows:** Blank rows or rows with only whitespace in the CSV file. Should be skipped gracefully.

### Trust and Adoption Edge Cases
- **The tool is wrong and the agent knows it.** The AI misreads a word and flags a false failure. The agent must be able to mentally override and move on. The tool should never block workflow. It recommends — the agent decides.
- **The tool passes something that should fail.** More dangerous than a false alarm. If the tool says "PASS" on a warning with a missing comma, the agent might trust it and approve a non-compliant label. This is why confidence scores matter — an agent should be skeptical of any field with confidence below 90%.
- **An agent trusts the tool too much.** Over time, agents may stop reading the warning themselves and just trust the green checkmark. The tool should always show the extracted text alongside the status, not hide it behind a "Pass" badge. Make the evidence visible even when the result is positive.
