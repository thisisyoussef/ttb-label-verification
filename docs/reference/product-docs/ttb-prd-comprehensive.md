# TTB Label Verification App
## Product Requirements Document

---

# 1. EXECUTIVE SUMMARY

## What We're Building

A web application that helps TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance agents verify alcohol beverage labels faster and more accurately. An agent uploads a photo of a label, optionally enters the corresponding COLA application data, and the system uses AI vision to extract the label text and validate it against TTB regulations — returning a detailed compliance report in under 5 seconds.

## Why It Matters

The TTB reviews approximately 150,000 label applications per year with a team of 47 agents — down from over 100 agents in the 1980s due to budget cuts. Each agent processes roughly 13 labels per day, spending 5-10 minutes per label on what is largely visual matching work: confirming that the text on the label matches what the applicant wrote on the form. The current process is entirely manual.

A previous scanning vendor pilot failed because processing took 30-40 seconds per label — slower than human review. Agents abandoned it. This tool must process labels in under 5 seconds to be viable.

Even a 3-minute time savings per label would recover approximately 7,500 work hours annually — equivalent to 3.6 full-time agents' worth of capacity. During peak season (Q4, which accounts for roughly 70% of annual business volume), this is the difference between the team keeping up and drowning.

## Strategic Context

This prototype is a standalone proof-of-concept. It does not integrate with the existing COLA system (a .NET application that has been in service since 2003). A contractor quoted $4.2 million for a full COLA rebuild, which was rejected. This prototype is positioned as a tool that could eventually integrate via a lightweight connection — offering a path to value without requiring a system replacement. If the prototype works well, it may inform future procurement decisions. The deployed application and its documentation effectively serve as a procurement demo.

---

# 2. STAKEHOLDER CONTEXT

## Who Will Use This Tool

### Dave Morrison — Senior Agent, 28 Years
Dave represents the veteran agent population. Half the team is over 50. He prints his emails, fights with the existing COLA system daily, and has seen modernization projects come and go — including an automated phone system in 2008 that increased call volume because nobody could figure it out.

Dave will not adopt a tool that makes his life harder. He doesn't want to learn a new system. He wants something that pre-screens labels so he can confirm or override the assessment. If the tool hard-fails on obvious cosmetic differences (like "STONE'S THROW" vs "Stone's Throw"), he will dismiss it as stupid and never open it again.

**What Dave needs:** A tool that demonstrates judgment. One that flags real problems but doesn't waste his time on false alarms. Something he can glance at and know in 2 seconds whether the label is clean or has issues.

### Jenny Park — Junior Agent, 8 Months
Jenny represents the newer agents who are tech-comfortable but still learning the rules. She has a literal printed checklist on her desk that she goes through for every label — checking each field with her eyes, one by one. She manually reads the government warning word-by-word every time.

She caught a label last month where "Government Warning" was in title case instead of all caps. She's proud of catches like that, but she knows she might miss subtler errors as she processes her daily queue.

**What Jenny needs:** A tool that catches what she might miss (punctuation errors in the warning, formatting violations) and teaches her the rules as she works (by showing regulatory citations for each check). She wants to trust the tool's green checkmarks so she can focus her attention on the yellow and red items.

### Janet — Seattle Office, Batch Processor
Janet handles large importers who submit 200-300 label applications at once. She currently processes them one at a time. She has been asking for batch processing for years.

**What Janet needs:** Upload 50 images and a spreadsheet, get a dashboard showing which labels are clean, which need review, which should be rejected. Drill into any individual result. Export the whole batch for her records.

### Sarah Chen — Deputy Director, Label Compliance
Sarah is the internal champion who pushed for this project. She manages the team of 47 agents and needs to justify the investment to leadership.

**What Sarah needs:** Evidence that the tool works — processing speed, accuracy, adoption potential. She will use the deployed prototype to make the case for broader implementation. The tool's polish and professionalism directly impact whether the procurement conversation advances.

### Marcus Williams — IT Systems Administrator
Marcus manages the technical infrastructure. The agency runs on Azure (migrated in 2019, FedRAMP certification took 18 months). Their network firewall blocks outbound traffic to many domains — the previous scanning vendor's features failed because the firewall blocked their ML endpoints.

**What Marcus needs:** A standalone prototype that doesn't touch the COLA system. Clear documentation of what external services are called, where data flows, and confirmation that nothing is persisted. Confidence that a production version could operate within their Azure/FedRAMP environment.

---

# 3. CORE REQUIREMENTS

## 3.1 The Fundamental Workflow

The tool automates the core agent workflow:

1. An applicant submits a COLA application (Form 5100.31) with structured data fields (brand name, class/type, ABV, etc.) along with label artwork
2. An agent's job is to compare the application data against the label artwork, field by field
3. The agent also checks that the label meets all TTB formatting and content requirements

This means the tool has two inputs:
- **Label image** — a photo of the actual label artwork
- **Application data** — the structured fields from Form 5100.31 (optional — the tool can also run standalone checks without application data)

And one output:
- **A compliance report** showing field-by-field comparison results with an overall recommendation

## 3.2 Performance Requirement

The complete pipeline — from image upload to results display — must complete in under 5 seconds for a single label. This is non-negotiable. The previous vendor failed at 30-40 seconds. If this tool can't beat an agent eyeballing a label, nobody will use it.

## 3.3 No Data Persistence

No uploaded images, application data, or results are stored after the response is returned. Everything is processed in memory and discarded. This is a deliberate security decision based on Marcus's comments about PII considerations and document retention policies.

## 3.4 Standalone Operation

The prototype does not integrate with the COLA system or any TTB internal systems. It is a self-contained web application. Marcus explicitly directed this.

---

# 4. USER STORIES

## Epic 1: Single Label Review

**US-1.1: Upload Label Image**
As a compliance agent, I want to upload a photo of a label so that the system can extract the text and validate it against TTB requirements.
- Accepts JPEG, PNG, WEBP, PDF up to 10MB
- Drag-and-drop and file picker
- Immediate image preview after upload
- Loading indicator during processing (under 5 seconds)
- Quality warning if the image is blurry, dark, or has glare

**US-1.2: Enter Application Data**
As a compliance agent, I want to enter the COLA application data alongside the label image so that the system can compare what the applicant claimed vs. what's actually on the label.
- Form fields matching Form 5100.31: Brand Name, Fanciful Name, Class/Type, Beverage Type, Alcohol Content, Net Contents, Name & Address, Origin, Country, Formula ID, Appellation, Vintage, Varietal(s)
- Beverage type dropdown dynamically shows/hides wine-specific fields
- All fields optional — agents can run partial comparisons or standalone checks

**US-1.3: View Comparison Results**
As a compliance agent, I want to see a side-by-side comparison of application data vs. extracted label data so that I can quickly identify matches, mismatches, and missing items.
- Overall recommendation banner: Approve / Review / Reject
- Summary count: "8 Pass · 1 Review · 1 Fail"
- Vertical checklist with one row per field: application value, extracted value, status
- Every row expandable to show explanation, regulation citation, and confidence score

**US-1.4: Government Warning Deep Validation**
As a compliance agent, I want to see a detailed character-level comparison of the government warning so that I don't have to manually read it word-by-word anymore.
- 8 individual sub-checks, each with its own pass/fail status
- Character-level diff highlighting showing exactly where the text diverges
- Full canonical text displayed for reference when the warning fails

**US-1.5: Beverage-Type-Aware Validation**
As a compliance agent, I want the checklist to adapt based on whether I'm reviewing spirits, beer, or wine so that I only see relevant checks.
- Different mandatory fields per beverage type
- Different format rules per beverage type
- Conditional checks (age statement, appellation, sulfites) appear only when applicable

**US-1.6: Fuzzy Match Handling**
As a senior compliance agent, I want the tool to distinguish between real mismatches and cosmetic differences so that I don't waste time on false alarms.
- Case differences → REVIEW, not FAIL
- Whitespace/spacing differences → REVIEW
- Completely different text → FAIL
- Each REVIEW explains the nature of the difference

**US-1.7: Image-Only / Auto-Fill Mode**
As a compliance agent, I want to upload just a label image without application data so that I can get a standalone compliance check.
- Runs format validation without comparison
- Extracted fields displayed in editable form
- User can then enter application data and re-run as full comparison

## Epic 2: Batch Processing

**US-2.1: Batch Upload**
As a compliance agent handling large importers, I want to upload multiple label images and application data at once so that I can process 50+ labels in one session.
- Multi-file drag-and-drop (up to 50 images)
- CSV upload for application data with downloadable template
- Automatic matching of images to CSV rows by filename or sequence

**US-2.2: Batch Results Dashboard**
As a compliance agent, I want a summary dashboard of all batch results so that I can quickly triage which labels need attention.
- Summary cards: Approve / Review / Reject counts
- Sortable, filterable results table
- Drill-down into individual results
- CSV export of batch results

## Epic 3: Accessibility & Error Handling

**US-3.1: Accessible for All Agents**
As a compliance agent over 50, I want the interface to be dead simple with large text and obvious controls.
- Minimum 16px body text
- WCAG AA contrast ratios
- Icons alongside colors for colorblind users
- No more than 2 clicks from upload to results
- Single-page application, no navigation to learn

**US-3.2: Graceful Error States**
As a compliance agent, I want clear error messages that tell me what happened and what to do.
- Every error in plain English, no technical jargon
- Bad image → suggest re-upload
- Timeout → offer retry
- Low confidence → warn but still show results

---

# 5. SCREENS & UX FLOWS

## Flow A: Single Label Review

### Screen 1 — Starting State
Two zones side by side. Left: image upload drop zone. Right: application data form. Beverage type dropdown at the top of the form controls which fields are visible — selecting "Wine" reveals appellation, vintage, and varietal fields; selecting "Malt Beverage" hides them. All form fields are optional. A prominent "Verify Label" button at the bottom, with a secondary "Or: Batch Upload →" link.

Design direction: Government compliance workstation. Utilitarian. Muted backgrounds, high contrast, large readable text. No decorative elements. Think Bloomberg terminal meets a government form — functional, data-dense, zero ornamentation. The agents using this are 20s to 60s, half over 50. Sarah benchmarked usability against her 73-year-old mother.

### Screen 2 — Processing State
After clicking "Verify Label," the upload area and form are replaced by a processing view showing the uploaded image thumbnail and a multi-step progress indicator: Image received → Extracting text → Running checks → Generating report. Each step checks off as it completes. Target: under 5 seconds total. If processing exceeds 7 seconds, a subtle message: "Taking a bit longer than usual..."

### Screen 3 — Results View
The most important screen. Must communicate three things in under 1 second: the overall verdict, where the problems are, and what to do about them.

**Overall banner:** Full-width colored banner. Green: "RECOMMEND APPROVAL." Amber: "RECOMMEND REVIEW." Red: "RECOMMEND REJECTION." Summary count adjacent.

**Results checklist:** A vertical table — one row per checked field. This mirrors the printed checklist Jenny has on her desk. Each row shows: field name, application value, extracted label value, status indicator (checkmark / warning triangle / X circle with color). Status indicators must use icons alongside colors for colorblind users.

**Expandable detail:** Every row clicks open to show:
- Exact text extracted from the label
- Exact text from the application (if provided)
- Plain-English explanation of the status
- Specific TTB regulation being checked (CFR citation)
- Confidence score for the extraction

**Government warning expanded view:** Deeper than other fields. Shows 8 individual sub-checks (text match, caps check, bold check, remainder not bold, Surgeon/General capitalization, punctuation, continuous paragraph, separated from other info) — each with its own pass/fail status. Also shows a character-level diff: the canonical text and extracted text side by side, with any differences highlighted character by character. When the warning fails, the full canonical text is displayed for reference.

**Cross-field checks:** Below the main checklist. Shows relationship-based checks: same-field-of-vision (spirits), vintage-requires-appellation (wine), varietal-percentages-total-100 (wine), imported-requires-country (all). Only shows checks relevant to the beverage type.

**Image reference:** The original uploaded image displayed at the bottom for quick visual verification.

**Actions:** "New Review" clears everything. "Export" saves or prints results.

### Screen 4 — Standalone Mode
When no application data is entered: banner says "STANDALONE COMPLIANCE CHECK" in a neutral color. Results show extracted fields with format checks only — no comparison column. Extracted values are editable. Call-to-action: "Enter application data for full comparison →" pre-fills the form with extracted values.

## Flow B: Batch Processing

### Screen 5 — Batch Upload
Toggle or tab switches between Single and Batch mode. Multi-file drop zone for images (up to 50). CSV drop zone for application data. Downloadable CSV template link. After upload: confirmation showing file counts and matching status. "Process Batch" button.

### Screen 6 — Batch Processing Progress
Progress bar: "Processing 23/47..." Results stream in as each label completes — a growing table showing brand name, beverage type, and status. Users can click into completed results while others still process.

### Screen 7 — Batch Dashboard
Three summary cards: Approve (green), Review (amber), Reject (red) with counts. Filter buttons: All / Failures / Reviews / Approved. Sortable results table: row number, brand name, beverage type, status, issue count, view button. Default sort: failures first (highest severity). Click "View" to drill into individual result (same as Screen 3). "Back to Dashboard" returns. "Export CSV" downloads all results.

---

# 6. DOMAIN: TTB LABEL REQUIREMENTS

## 6.1 What Is a COLA?

A Certificate of Label Approval (COLA) is an authorization issued by the TTB on Form 5100.31 that approves an alcohol beverage label for market. Before any bottle of wine (over 7% ABV), distilled spirits, or malt beverage can be sold in the United States, its label must be reviewed and approved. The TTB processes these through the COLAs Online system, which has been operational since June 2003.

The application contains structured data (brand name, class/type, alcohol content, net contents, permit information, origin, etc.) alongside the actual label artwork. An agent's job is to verify that the artwork matches the application data and that the label complies with all federal regulations.

Processing typically takes 5-15 business days. Common reasons for rejection include errors in the health warning statement, incorrect net contents format, missing mandatory information, misleading claims, and incorrect product classification.

## 6.2 The Government Health Warning Statement

This is the most commonly rejected element of COLA applications and the tool's showcase validation feature.

**The exact required text:**

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

**Required on:** All alcohol beverages containing 0.5% ABV or more, for sale or distribution in the United States. This applies to domestic and imported products, including those for sale to the Armed Forces.

**Format requirements:**
- "GOVERNMENT WARNING" must be in ALL CAPITAL LETTERS and BOLD type
- The remainder of the statement must NOT be in bold type
- "Surgeon" and "General" must be capitalized
- All punctuation must be present and exact: colon after "WARNING", parentheses around "(1)" and "(2)", comma after "General", period after "defects", comma after "machinery", period after "problems"
- Must appear as one continuous paragraph — not broken across separate sections
- Must appear separate and apart from all other label information
- Must be readily legible under ordinary conditions and on a contrasting background
- Cannot exceed a maximum number of characters per inch (varies by container size)
- Warning statements required by foreign governments are NOT permitted alongside the U.S. warning

**Minimum type sizes (by container):**
- 3mm for containers larger than 3 liters
- 2mm for containers 237ml to 3 liters
- 1mm for containers 237ml or less

**Common errors (per TTB guidance):**
- "Government Warning" in title case instead of all caps
- Missing comma after "General" or "machinery"
- Missing period after "defects" or "problems"
- Splitting the statement across multiple text blocks
- Embedding the warning within other label text instead of keeping it separate
- Making the text too small to read
- Using the wrong text entirely (paraphrasing instead of the exact mandated wording)

## 6.3 Beverage-Type-Specific Requirements

### Distilled Spirits

**Mandatory fields on the brand label (same field of vision):**
- Brand Name
- Class/Type Designation (e.g., "Vodka," "Kentucky Straight Bourbon Whiskey")
- Alcohol Content (as percentage by volume)

These three must appear in the same field of vision — defined as a single side of the container where all can be viewed simultaneously without turning it. For cylindrical containers, this is 40% of the circumference.

**Mandatory fields on any label:**
- Net Contents (metric standards of fill: 50mL, 200mL, 375mL, 750mL, 1L, 1.75L)
- Name and Address (as listed on permit, preceded by "Bottled By," "Imported By," etc.)
- Government Health Warning Statement
- Country of Origin (imported products only, per CBP regulations)

**Conditional requirements:**
- Age Statement: Mandatory for whisky aged less than 4 years, grape brandy aged less than 2 years
- State of Distillation: Required for certain U.S. whisky types if not distilled in the state shown in the address
- Commodity Statement: Required if neutral spirits are used (must state percentage and commodity source)
- Sulfite Declaration: Required if product contains 10+ ppm sulfur dioxide
- Coloring Disclosure: Required if caramel coloring, artificial coloring, FD&C Yellow #5, cochineal extract, or carmine is used

**Alcohol content format rules:**
- Must be stated as percentage of alcohol by volume
- "ABV" abbreviation is NOT permitted
- Allowed abbreviations: "Alc.", "Alc", "Vol.", "Vol", "%"
- Proof may optionally appear in parentheses alongside the mandatory percentage
- Tolerance: ±0.3 percentage points from the labeled content

### Malt Beverages (Beer)

**Mandatory fields on the brand label:**
- Brand Name
- Class/Type Designation (e.g., "Ale," "Lager," "Stout," "Malt Beverage")
- Name and Address (domestic)
- Net Contents (U.S. measures)

**Mandatory fields on any label:**
- Government Health Warning Statement
- Name and Address (imported)
- Country of Origin (imported products only)

**Conditional requirements:**
- Alcohol Content: OPTIONAL at the federal level — required ONLY for malt beverages containing alcohol derived from added flavors or non-beverage ingredients (other than hops extract). If stated, the same format rules apply.
- Ingredient Declarations: Required if product contains aspartame, sulfites, FD&C Yellow #5, or cochineal extract/carmine

**Net contents format rules (complex, by container size):**
- Less than 1 pint: fluid ounces or fractions of a pint
- Exactly 1 pint, 1 quart, or 1 gallon: state that exact measure
- Between 1 pint and 1 quart: pints and fluid ounces, or fractions of a quart
- Between 1 quart and 1 gallon: quarts, pints, and fluid ounces, or fractions of a gallon
- Over 1 gallon: gallons and fractions thereof

**Class/type rules:**
- Geographically significant styles made outside the named country must be qualified: "Irish-Style Red Ale" (made in USA), not "Irish Red Ale"

### Wine

**Mandatory fields on the brand label:**
- Brand Name
- Class/Type Designation (e.g., "Red Wine," "Pinot Noir")
- Appellation of Origin (conditional — see below)

**Mandatory fields on any label:**
- Alcohol Content (required for wines 7% ABV and higher)
- Net Contents (milliliters for under 1 liter, liters for larger)
- Name and Address (preceded by "Produced By," "Bottled By," etc.)
- Government Health Warning Statement
- Country of Origin (imported products)

**Conditional requirements:**
- Appellation of Origin: Not required on all labels. BECOMES mandatory when a vintage date or varietal designation appears. If using an AVA (American Viticultural Area), 85% of grapes must come from that area. State or county: 75%.
- Vintage Year: Optional. If included, appellation of origin becomes mandatory.
- Varietal Designation: Optional. If used, it becomes the class/type and triggers the appellation requirement. When multiple varietals are listed, percentages must be shown and must total 100%.
- Sulfite Declaration: Required if product contains 10+ ppm sulfur dioxide. If claiming no sulfites, TTB lab analysis must be submitted with the application.

**Alcohol content rules for wine:**
- Table wines (7-14% ABV) may use "Table Wine" or "Light Wine" in lieu of a specific percentage
- "ABV" abbreviation is NOT permitted (same as spirits and beer)
- Minimum type size: 1mm for containers 187ml or less, 2mm for larger

## 6.4 Cross-Field Dependency Rules

These rules involve relationships between multiple fields and must be validated as a group:

**Wine:**
- Vintage year on label → appellation of origin MUST be present (27 CFR 4.27)
- Varietal designation on label → appellation of origin MUST be on the brand label (27 CFR 4.23)
- Multiple varietals listed → percentages MUST be shown and MUST total 100% (27 CFR 4.23(d))

**Spirits:**
- Brand name + ABV + class/type → MUST appear in same field of vision (27 CFR 5.63)
- Whisky class + aged less than 4 years → age statement MANDATORY (27 CFR 5.74)
- Whisky not distilled in the state shown in address → state of distillation MUST appear (27 CFR 5.66(f))

**All types:**
- Product is imported → country of origin MUST be present (19 CFR 134.11)

---

# 7. THE THREE-TIER RESULT SYSTEM

This is the most important design decision in the entire product. It determines whether agents trust and adopt the tool or dismiss it.

## PASS (Green, Checkmark Icon)
Exact match and correct format. No agent action needed. The field on the label matches the application data and meets all TTB format requirements.

## REVIEW (Amber, Warning Triangle Icon)
Likely correct but has a cosmetic difference or uncertain extraction. The agent should look at this but it's probably fine. This tier exists because of Dave's "STONE'S THROW" vs "Stone's Throw" insight — some differences are technically mismatches but obviously the same thing. A tool that hard-fails on these is a tool nobody uses.

Examples that trigger REVIEW:
- Case differences in brand name
- Minor whitespace or spacing variations
- Low AI extraction confidence on a field
- ABV within tolerance but not exact
- Minor textual differences (1-2 characters)
- Formatting that the AI couldn't fully assess (e.g., bold detection uncertain)

Each REVIEW must explain what triggered it: "Case difference detected — text matches when compared without case sensitivity. Likely the same brand name. Recommend agent verification."

## FAIL (Red, X Circle Icon)
Clear violation that would result in a correction request or rejection. Missing required information, wrong government warning text, forbidden ABV format, missing appellation when vintage is present, completely different brand name.

Each FAIL must cite the specific TTB regulation violated and explain in plain English what needs to be fixed: "Per 27 CFR Part 16, the words 'GOVERNMENT WARNING' must appear in capital letters and bold type. The label shows 'Government Warning' in title case."

## Overall Recommendation
- Any FAIL → "Recommend Rejection"
- Any REVIEW, no FAILs → "Recommend Review"
- All PASS → "Recommend Approval"

**Critical principle:** The tool recommends — it does not decide. The agent always has final authority. Every result screen must make this clear. The tool augments agent judgment; it does not replace it.

---

# 8. WHAT TO RESEARCH

## TTB Regulatory Research
- The TTB Beverage Alcohol Manuals (BAM) for distilled spirits, malt beverages, and wine — the authoritative guides to mandatory labeling
- TTB mandatory labeling checklists for each beverage type (PDF documents on ttb.gov) — the exact checklists agents use during review
- 27 CFR Part 16 — the Alcoholic Beverage Labeling Act regulations covering the government warning
- 27 CFR Parts 4, 5, and 7 — labeling regulations for wine, distilled spirits, and malt beverages
- TTB's "Avoiding Common Errors" guidance pages — what actually gets rejected most often
- TTB's "Anatomy of a Label" interactive tools — visual guides to label layout
- TTB's Public COLA Registry — real examples of approved labels with their application data
- TTB labeling modernization rules (T.D. TTB-158 and T.D. TTB-176) — the most current requirements
- The proposed "Alcohol Facts" NPRM from January 2025 — where regulations may be heading

## Technology Research
- Image quality assessment techniques — detecting blur, underexposure, and glare before AI processing
- How vision models handle curved text on cylindrical bottle surfaces
- Bold vs. regular text weight detection in images — critical for government warning validation
- Character-level text diff algorithms for clean, readable visual output
- How OCR/vision tools handle decorative and script fonts common on alcohol labels
- The COLAs Online system and Form 5100.31 field structure — understanding the source data

## Competitive and Analogous Research
- Why the previous scanning vendor pilot failed (30-40 second processing) and what architectural decisions led to that
- How other government agencies implement AI-assisted document verification (customs, passport, tax)
- Commercial label compliance services (Bevlaw, Park Street) — how they describe the compliance process

---

# 9. WHAT TO CONSIDER

## Design Considerations

**The tool recommends, it does not decide.** The agent always has final authority. Dave has seen modernization projects fail because they tried to replace agent judgment. This tool augments it.

**Match the agent's existing mental model.** Jenny has a printed checklist on her desk. The results screen should feel like a digital version of that checklist. Don't reinvent the workflow with cards, dashboards, or novel visualizations.

**Speed is a feature.** Under 5 seconds is the difference between adoption and abandonment. If the tool can't beat a human, nobody will use it.

**The app is a procurement demo.** Marcus said this prototype could inform future procurement decisions. The landing state must look professional. A janky first impression kills the procurement conversation.

**Don't persist anything.** Process in memory, return results, discard everything. Mention this in documentation as a deliberate security decision.

**The standalone prototype is strategically positioned.** Frame it as a $0 integration path (via API) versus the $4.2 million COLA rebuild that went nowhere.

**Don't make the tool blocking.** Dave's 2008 phone system warning. The tool should never force a workflow or require mandatory steps. Let agents use it however they want — upload just an image, enter just a few fields, skip whatever they want. Additive, never blocking.

## Validation Considerations

**Fuzzy matching is the make-or-break decision.** Hard-fail on case differences = tool is dead. Smart REVIEW on case differences = tool is trusted. This single threshold determines adoption.

**The government warning is the showcase.** It's the #1 rejection reason. If the tool catches a missing comma that humans miss during word-by-word reading, you've proven the value proposition in one demo.

**Beverage type gates everything.** Wrong type = wrong rules. A beer flagged for missing ABV (when ABV is optional for beer) erodes trust instantly. A wine missing its appellation check because it was classified as a spirit is a missed violation.

**Not all checks have equal weight.** A missing government warning is a guaranteed rejection. A brand name in different case is a judgment call. Communicate severity, not just pass/fail.

**The AI extracts, rules validate.** Keep AI calls to a minimum (ideally one vision extraction call). All downstream comparison, format checking, and cross-field validation should be deterministic, rule-based logic. This ensures consistency, reproducibility, and speed.

## Performance Considerations

**The AI extraction call is the bottleneck.** Everything else should be near-instantaneous. The 5-second budget is essentially "AI time + a few hundred milliseconds."

**Don't make two AI calls when one will do.** Combine image quality assessment with text extraction in a single call if possible. Every additional call adds 1-3 seconds.

**Batch processing multiplies the bottleneck.** 50 labels × 3 seconds = 150 seconds serial. Concurrent processing is necessary but must respect AI provider rate limits.

---

# 10. EDGE CASES

## Image Edge Cases
- **Multiple label panels in one photo:** Front and back of a bottle visible in a single image. Attempt to extract from both.
- **Rotated or sideways images:** Handle common rotations (90°, 180°, 270°).
- **Glare and reflections:** Glass bottles are reflective. Attempt extraction through mild glare; flag low confidence rather than failing silently.
- **Curved text:** Text wrapping around cylindrical surfaces appears distorted at edges. This is extremely common.
- **Decorative and script fonts:** Elaborate typography is standard on alcohol labels. Standard OCR struggles with these.
- **Extremely small text:** Government warnings on small containers can be 1mm type. May be difficult to extract from photos.
- **Partially obscured labels:** Parts hidden by hands, shelves, or other bottles.
- **Very high-resolution images:** 8+ megapixel photos. Handle without crashing; may need resizing for AI model limits.

## Application Data Edge Cases
- **Missing beverage type:** System must infer from class/type text or default safely.
- **Partial data:** User enters only brand name and ABV. Compare what's available, skip what's not.
- **Unicode and special characters:** Brand names with accents (é, ñ, ü), apostrophes, ampersands. Comparison must handle correctly.
- **Numeric format variation in ABV:** "45" vs "45%" vs "45% Alc./Vol." — all represent the same value.
- **Net contents unit styling:** "750ml" vs "750 mL" vs "750mL" — all the same value.

## Comparison Edge Cases
- **Brand name includes class/type:** "STONE'S THROW BOURBON" where "BOURBON" is both brand and class. Don't double-count.
- **Multiple acceptable class/type designations:** Some products can be described multiple ways ("Gin" vs "Distilled Gin"). Mismatch between acceptable terms should be REVIEW, not FAIL.
- **Flavored spirits classification:** A product labeled "Gin" but made with post-distillation flavoring may actually be "Distilled Spirits Specialty." The tool may not catch this nuance but should flag unusual combinations.
- **Wine blends with equal varietals:** A wine listing 4 varietals at 25% each. Verify percentages are shown and sum to 100%.
- **Imported product with domestic bottler:** Label shows U.S. bottler info alongside importer info. Country of origin is still required.
- **ABV proof conversion:** "45% Alc./Vol. (90 Proof)" — 90 proof = 45% ABV. The system should validate proof = 2× percentage if both are stated.

## Government Warning Edge Cases
- **Warning in wrong language:** Some imports carry home-country warnings alongside (or instead of) the U.S. warning. Foreign warnings are NOT permitted.
- **Warning split across label panels:** Part on front, part on back. Must be a continuous paragraph on a single panel.
- **Stylized warning text:** Decorative font that makes "GOVERNMENT WARNING" technically present but hard to read. TTB requires "readily legible."
- **Extra text inserted:** Applicant adds their own health message within or adjacent to the mandated text. Must be separate and apart.
- **Smart quotes or typographic substitutions:** Curly quotes instead of straight, em dashes instead of hyphens. Flag as potential issues.
- **Warning correct but too small:** Text matches but font is below minimum type size. The prototype likely cannot verify physical font size from a photo — document this limitation.

## Batch Processing Edge Cases
- **CSV encoding issues:** UTF-8 vs Latin-1 may corrupt special characters.
- **Extra or missing CSV columns:** Process what can be mapped, flag what can't.
- **Mismatched counts:** 47 images but 45 CSV rows. Match what's possible, flag the rest.
- **Duplicate filenames:** Flag rather than silently overwriting.
- **One bad image in a good batch:** Process the good ones, report error for the bad one. Never fail the entire batch.
- **Empty CSV rows:** Skip gracefully.
- **CSV with headers but all fields empty except filename:** Process as standalone for each.

## Trust and Adoption Edge Cases
- **The tool is wrong and the agent knows it.** The AI misreads a word and flags a false failure. The tool must never block workflow — the agent can mentally override and move on.
- **The tool passes something that should fail.** More dangerous than false alarms. If the tool says PASS on a warning with a missing comma, the agent might approve a non-compliant label. Confidence scores should encourage verification.
- **Over-reliance.** Over time, agents may stop checking themselves. The tool should always show evidence (extracted text) alongside status, not hide it behind a PASS badge.

---

# 11. TEST LABEL STRATEGY

Create 6 test label images (using AI image generation) that demonstrate the tool's capabilities. These become part of the final submission and give evaluators a guided tour.

| # | Label | What It Tests | Expected Result |
|---|-------|--------------|----------------|
| 1 | Perfect spirit label — all fields correct, proper warning, correct formats | Happy path baseline | All PASS, Recommend Approval |
| 2 | Spirit label with warning errors — "Government Warning" in title case, missing comma after "machinery" | Government warning deep validation | Warning FAIL with 2 sub-check failures, character diff showing exact issues |
| 3 | Spirit label with brand name case mismatch — application says "STONE'S THROW" but label says "Stone's Throw" | Fuzzy matching / three-tier system | Brand name REVIEW (not FAIL), explanation of case difference |
| 4 | Wine label with vintage year "2021" and varietal "Pinot Noir" but NO appellation of origin | Cross-field dependency validation | Cross-field FAIL: vintage requires appellation |
| 5 | Beer label with ABV stated as "5.2% ABV" instead of "5.2% Alc./Vol." | Format compliance checking | ABV format FAIL: "ABV" abbreviation not permitted |
| 6 | Deliberately blurry or poorly lit image | Image quality handling / graceful degradation | Low confidence warning, REVIEW flags on uncertain fields |

---

# 12. DOCUMENTATION REQUIREMENTS

The README is a deliverable with evaluation weight. It's also a procurement artifact — the document Sarah shows to leadership.

## Must Include

**Overview:** What the tool does, who it's for, the problem it solves.

**Live Demo:** Link to the deployed application.

**Setup Instructions:** Step-by-step to run locally. Should take under 10 minutes.

**Approach & Architecture:** Conceptual description of how the system works. What AI model is used and why. What logic is AI-driven vs. deterministic. Why the architecture was structured this way.

**Assumptions Made** (explicitly evaluated — the assignment says "we also value how you fill in gaps independently"):
- Government warning text researched from 27 CFR Part 16 and TTB.gov, since the assignment only referenced "[Standard government warning text]"
- Beverage-type-specific rules researched from TTB Beverage Alcohol Manuals and mandatory labeling checklists
- Brand name comparison uses fuzzy matching based on Dave Morrison's "STONE'S THROW" interview feedback
- No data persisted — deliberate security decision based on Marcus Williams' PII comments
- Prototype uses cloud AI API — production would need FedRAMP-authorized Azure deployment
- Standalone design per Marcus's direction — no COLA integration
- Tool produces recommendations, not decisions — agent always has final authority

**Trade-offs & Limitations:**
- Same-field-of-vision check uses simplified heuristic, not true container geometry
- Bold detection relies on AI visual assessment, not pixel-level analysis
- Batch capped at 50 labels for prototype
- Cannot verify physical font sizes (mm) from a photo — would require knowing actual container dimensions
- The tool cannot assess whether a product's class/type accurately describes the product's composition (e.g., a spirit labeled "Gin" that should be "Distilled Spirits Specialty" based on production method)

**Business Impact Math:**
- 150,000 labels/year ÷ 47 agents = ~3,191 per agent/year = ~13/day
- At 5-10 min per label, that's the full workday
- Previous pilot failed at 30-40 seconds — this tool targets <5 seconds
- 3-minute savings per label × 150,000 labels = ~7,500 hours saved annually
- Equivalent to ~3.6 full-time agents' worth of capacity recovered
- Team has been understaffed since the 1980s (100+ agents → 47) — this tool compensates for a structural deficit that's never getting fixed

**Test Labels:** Describe each of the 6 test labels and what scenario it demonstrates.

**Future Enhancements:**
- Integration with COLAs Online via API (the $0 path vs. $4.2M rebuild)
- Deployment within Azure/FedRAMP environment
- Agent workflow tracking and productivity analytics
- Multi-image support (front + back of the same bottle)
- Historical comparison against previously approved labels
- Integration with the TTB Public COLA Registry
- Real-time agent collaboration features (for the Seattle-to-DC distributed team)

---

# 13. EVALUATION CRITERIA (FROM THE ASSIGNMENT)

The assignment explicitly lists these evaluation criteria. Every product decision should map to one of them:

1. **Correctness and completeness of core requirements** — The comparison engine works accurately. Beverage-type rules are correct. Government warning validation is thorough.
2. **Code quality and organization** — Clean, well-structured, maintainable.
3. **Appropriate technical choices for the scope** — The stack fits the problem. AI is used where it adds value, rules are used where they're sufficient.
4. **User experience and error handling** — Dave can use it. Jenny can learn from it. Janet can process batches with it. Errors are graceful and helpful.
5. **Attention to requirements** — Every buried detail from the interviews is addressed. The government warning is hardcoded from research. Beverage types have different rules. Fuzzy matching exists. Batch processing exists. The 5-second target is met.
6. **Creative problem-solving** — The three-tier result system. The character-level warning diff. The auto-fill mode. The cross-field dependency checks. Features they didn't explicitly ask for but that demonstrate deep understanding.

The assignment also states: "A working core application with clean code is preferred over ambitious but incomplete features." However, per the project owner's direction, we are building the complete feature set. The priority is: everything works, everything is polished, nothing is half-built.

The assignment also says: "Questions? Reach out for clarification—though we also value how you fill in gaps independently." Every gap filled independently (warning text, beverage rules, format requirements) should be documented in the README as evidence of initiative.
