# DESIGN.md
## TTB Label Verification App — Design System

> **Concrete theme tokens live in [`INDUSTRIAL_PRECISION_THEME.md`](./INDUSTRIAL_PRECISION_THEME.md).** That file is the single source of truth for palette, typography, corner radius, and elevation — it maps directly to `tailwind.config.js`. This doc defines the principles and posture; the theme doc defines the values. When they disagree, update both so they agree.

---

# PERSONA GUARDRAILS

The design system must satisfy the full persona spectrum documented in `docs/reference/product-docs/ttb-user-personas.md`.

- **Sarah Chen:** the product must look procurement-ready, serious, and fast enough to survive leadership demos.
- **Dave Morrison:** the primary flows must feel zero-training, preserve reviewer judgment, and never add steps just to satisfy UI taste.
- **Jenny Park:** dense surfaces still need expandable teaching context, citations, confidence signals, and a checklist mental model.
- **Marcus Williams:** the product should signal operational seriousness, no-persistence posture, and future deployment realism even from the interface and supporting docs.
- **Janet:** batch surfaces must feel first-class, not secondary afterthoughts, and should prioritize triage efficiency over decorative presentation.

# DESIGN PHILOSOPHY

## The Metaphor: Precision Instrument

This is not a consumer app. It is not a marketing website. It is a compliance workstation — a precision instrument for people who do focused, repetitive, high-stakes analytical work every day for decades.

Think of a well-designed oscilloscope or a pilot's instrument panel. Every element exists because it conveys information. Nothing is decorative. But it is not ugly — it is refined in the way that professional tools are refined. The typography is chosen for legibility at a glance. The colors are chosen for instant signal recognition. The spacing gives information room to breathe without wasting screen real estate.

The design earns trust by being predictable, dense with useful information, and ruthlessly clear. An agent who uses this tool for the first time should feel like they already know how it works. An agent who uses it 50 times a day should never feel friction.

## Design Direction: Industrial Precision

**Tone:** Analytical, authoritative, calm. Not cold — warm enough that it feels like a tool made by someone who understands the job. But never playful, never trendy, never clever for the sake of cleverness.

**Visual character:** Clean lines, structured grids, high information density with clear hierarchy. A monochromatic foundation with precisely deployed color for status signaling. The kind of interface where a red indicator immediately means something because red is rare and intentional.

**Anti-patterns to avoid:**
- Rounded, bubbly, friendly UI (this is not a consumer product)
- Excessive whitespace and minimal layouts (agents need information density)
- Gradient backgrounds, decorative illustrations, or promotional aesthetics
- Purple accent colors, gradient buttons, or anything that reads as "startup"
- Overly trendy typography (geometric sans-serifs with unusual letterspacing)
- Dark mode by default (government offices have bright overhead lighting — high-contrast light theme is more readable in these environments)

---

# COLOR SYSTEM

## Foundation

The color palette is built on a neutral base with three signal colors. The neutrals do the heavy lifting. The signal colors appear sparingly and always mean something.

**Base / Background:**
A very light warm gray — not pure white (which is harsh under fluorescent office lighting) and not cool gray (which feels sterile). Something with the faintest warm undertone. Think of high-quality paper or a clean whiteboard. This is the canvas everything sits on.

**Surface / Cards:**
Pure white or near-white for cards, panels, expanded detail areas, and form inputs. The subtle contrast between the page background and white surface panels creates depth without shadows or borders.

**Text — Primary:**
Near-black with a very slight warm cast. Not pure #000000 (too harsh) but dark enough for perfect legibility. This is the default for all body text, headings, and data.

**Text — Secondary:**
A medium gray for supporting text, placeholders, captions, and de-emphasized information. Must still meet WCAG AA contrast on white surfaces (4.5:1 ratio minimum).

**Text — Tertiary:**
A lighter gray for very low-priority information like file size labels, version numbers, or disabled states. Use sparingly.

**Borders and Dividers:**
Very light gray — barely visible but enough to define structure. Table row dividers, form field outlines, section separators.

## Signal Colors

These are the three functional colors. They appear ONLY for status indication. They are never decorative.

**Pass / Success — Green:**
A grounded, mature green — not neon, not lime, not mint. Something closer to a forest service green or a financial "positive" green. It should feel authoritative, not cheerful. Used for: Pass badges, Approve recommendation banner, Approve summary card, checkmark icons.

**Review / Caution — Amber:**
A warm amber — not yellow (too alarming for a middle-tier status) and not orange (too close to error). Think of aged brass or warm honey. It signals "look at this" without creating urgency. Used for: Review badges, Review recommendation banner, Review summary card, warning triangle icons.

**Fail / Error — Red:**
A commanding, saturated red — not pink, not dark maroon. A red that says "this is wrong" without screaming. It should be impossible to miss but not anxiety-inducing. Used for: Fail badges, Reject recommendation banner, Reject summary card, X icons, error messages, invalid form field borders.

**Confidence / Info — Blue:**
A single blue tone for informational elements that aren't status-related: confidence score indicators, regulation citation links, informational banners (like the standalone mode notice). This is the only "neutral signal" color.

## Colorblind Safety

The three-tier status system CANNOT rely on color alone. Every status indicator must include:
- An icon that is recognizable in grayscale (checkmark, warning triangle, X circle)
- A text label ("Pass," "Review," "Fail")
- The color as reinforcement, not as the sole signal

The green and red must be distinguishable by people with protanopia and deuteranopia (the most common forms of color blindness). Test the palette with a colorblind simulator. If the green and red are indistinguishable, the icons and text labels carry the full information load.

---

# TYPOGRAPHY

## Font Selection

**Primary / Body:** Choose a highly legible sans-serif designed for dense data display. Ideal qualities: clear character differentiation (distinguishable I/l/1 and O/0), comfortable at small sizes, professional without being generic. Avoid: Inter (overused), Roboto (Google default feel), Arial (Microsoft default feel), system fonts. Look for something with the character of a well-designed engineering or scientific typeface — IBM Plex Sans, Atkinson Hyperlegible, Source Sans Pro, or similar. The priority is legibility for 50+ year old agents reading under fluorescent lighting, not aesthetic novelty.

**Monospace / Data:** For the government warning diff view, extracted text display, and any character-level comparisons, use a monospaced font that aligns characters vertically. This is critical for the diff feature — characters must line up between the expected and extracted text rows. Choose something with good readability at moderate sizes: JetBrains Mono, IBM Plex Mono, Fira Mono, or similar. This font also serves the "precision instrument" metaphor — monospace text signals technical accuracy.

**Display / Headings:** The same family as the body font, in a heavier weight. No separate display typeface is needed — the tool's headings are functional labels ("Results," "Batch Dashboard"), not creative statements. Bold weight of the primary font is sufficient.

## Type Scale

This audience includes agents in their 50s and 60s. Sarah benchmarked usability against her 73-year-old mother. Type sizes must be generous.

- **Page headings:** 24-28px, bold weight. Used for "TTB Label Verification" app title and major section headings.
- **Section headings:** 18-20px, semibold. Used for "Results," "Cross-Field Checks," "Batch Dashboard."
- **Table headers / Labels:** 14-16px, semibold or uppercase with letter-spacing. Column headers, form labels, sub-section labels.
- **Body text / Data:** 16px minimum. All form field text, all table cell text, all explanatory text in expanded detail panels. This is not negotiable — 14px body text is too small for this audience.
- **Supporting text:** 14px. File size labels, confidence scores, regulation citations, placeholder text. This is the absolute minimum size anywhere in the application.
- **Small text:** 12px. Used ONLY for ancillary information that the agent never needs to read during their primary workflow — version numbers, footnotes. Avoid wherever possible.

## Text Formatting

- **Bold** for field labels, column headers, and the "GOVERNMENT WARNING" text in the diff view. Nowhere else — bold loses its emphasis when overused.
- **Monospace** for any extracted text, the government warning diff, and data values where character-level accuracy matters.
- **Standard weight** for everything else — explanations, descriptions, instructions.
- **No italic** unless quoting regulation text. Italic is hard to read at small sizes and under fluorescent lighting.
- **No underlining** except for links.

---

# SPACING & LAYOUT

## Grid

The app uses a structured grid with generous but not wasteful spacing. The overall feel is "dense but organized" — like a well-designed spreadsheet or a Bloomberg terminal, not like a mobile app with excessive whitespace.

**Page margins:** Generous horizontal margins on desktop (80-120px per side on a 1440px screen) to keep content centered and comfortable. The content area should be approximately 1200px maximum width.

**Section spacing:** 32-40px between major sections (banner to table, table to cross-field checks, cross-field checks to image).

**Row spacing:** Within the results table, 12-16px vertical padding per row. Enough to be comfortable but tight enough that 10-14 rows are visible without scrolling on a standard desktop monitor.

**Column spacing:** 16-24px between table columns.

**Form field spacing:** 16-20px between form fields vertically. Labels directly above fields with 4-6px gap.

## Responsive Behavior

**Desktop (1024px and above):** Two-column layout for Screen 1 (image upload + form). Full-width results table. Full-width batch dashboard.

**Tablet (768px-1023px):** Single-column layout — image upload stacks above the form. Results table becomes scrollable horizontally if needed. Summary cards may wrap to a 2+1 layout.

**Mobile (below 768px):** Fully stacked single-column layout. This is not the primary use case (agents use desktop workstations) but the app should not break. Table rows may need to transform into card layouts on very narrow screens.

---

# COMPONENTS

## Status Badge

The most important visual element in the application. Appears on every result row, in the verdict banner, and on batch dashboard summary cards.

**Structure:** A pill-shaped badge containing an icon and a word.
- Pass: Checkmark icon + "Pass" on a green-tinted background
- Review: Warning triangle icon + "Review" on an amber-tinted background
- Fail: X circle icon + "Fail" on a red-tinted background

**Sizing:** Badges in the results table are compact (fitting within a table row). The badge in the verdict banner is larger. Summary card badges are the largest.

**Consistency:** The same badge component is used everywhere status is shown. Same colors, same icons, same typography. Recognition should be instant.

## Verdict Banner

The full-width banner at the top of the results screen.

**Structure:** A horizontal bar with a tinted background (green/amber/red). Left side: large icon + recommendation text ("RECOMMEND APPROVAL"). Right side: summary count ("8 Pass · 1 Review · 1 Fail").

**Visual weight:** This is the single most prominent element on the results screen. It should be the first thing the agent's eyes land on. The background color should be the tinted version of the signal color (not fully saturated — think 10-15% opacity of the signal color on white) with the text in the full signal color. This keeps it visible without being garish.

## Expandable Row

The results table rows that click open to reveal detail panels.

**Collapsed state:** Field name, application value, extracted value, status badge. A small right-pointing chevron on the far right indicating expandability. Subtle hover effect (slight background change or left border highlight).

**Expanded state:** The chevron rotates to point downward. The detail panel slides open below the row with a smooth animation (200-300ms, ease-out). The panel has a very slightly different background (a shade darker or warmer than white) to visually nest it under its parent row. Clicking the row again (or clicking a different row) collapses it.

**Interaction:** Only one row expanded at a time. Expanding row B auto-collapses row A. This prevents the screen from becoming an overwhelming scroll of detail panels.

## Character Diff Display

Used in the government warning expanded view to show character-level text comparison.

**Layout:** Two text blocks stacked vertically, or side-by-side on wide screens. The top block is labeled "Required text" and the bottom is labeled "Extracted from label." Both use the monospace font.

**Highlighting:**
- Characters that match: default text color, no highlight
- Characters that are wrong (different character in that position): error-color background highlight behind the wrong character
- Characters that are missing: a visible gap marker (like a colored underscore or a small colored block) in the position where the character should be
- Characters with wrong capitalization: caution-color background highlight

The highlighting should be subtle enough to read through — a very light background tint, not a heavy opaque highlight. The text must remain the primary focus.

## Confidence Indicator

A small visual element that communicates how confident the AI extraction was for a given field.

**Structure:** A thin horizontal bar (like a miniature progress bar) that fills proportionally to the confidence percentage, plus a text label: "97%"

**Color behavior:**
- 90-100%: Green fill — high confidence, trust the extraction
- 70-89%: Amber fill — moderate confidence, agent should verify
- Below 70%: Red fill — low confidence, extraction may be unreliable

This appears in the expanded detail panel for each field, not in the collapsed table row. It's supplementary information, not primary.

## Image Drop Zone

The upload area on Screen 1 and Screen 5.

**Empty state:** Dashed border in a light gray. Upload icon centered. Text instructions below. The zone is large enough to be an obvious target — not a small button-like area.

**Drag hover:** Border color changes to the primary accent (blue). Background gains a very light tint of the accent color. Text changes to "Drop to upload." This state must feel responsive and immediate.

**Uploaded state:** Dashed border becomes solid. Interior changes from instructions to the image thumbnail with filename and size information. A small "✕ Remove" action in the corner.

**Error state:** Border and background flash briefly in error color. Error message appears below the zone.

## Form Fields

Standard text inputs with clear, structured labeling.

**Label:** Above the field, in semibold or bold weight, 14-16px. Not inside the field as a floating label — this audience needs static, always-visible labels.

**Input:** Full-width within its column. Visible border in the default border color. Sufficient height for comfortable interaction (40-44px minimum). Placeholder text in the secondary text color showing expected format.

**Focus state:** Border changes to the accent color (blue). A very subtle shadow or glow to indicate focus.

**Error state:** Border changes to error color. Error message appears below the field in error-colored text, 14px.

## Summary Cards

The three cards at the top of the batch dashboard.

**Structure:** Three equal-width cards in a horizontal row. Each card has:
- A large number (the count) as the dominant visual element — 32-40px, bold
- A label below the number ("Approve" / "Review" / "Reject") — 16px
- An icon above or beside the number (checkmark / triangle / X)
- A background tint of the corresponding signal color (very light — 5-10% opacity)
- A left border or top border stripe in the full signal color for definition

**Visual weight:** These cards should feel substantial but not overwhelming. They're summary indicators, not hero elements. The batch results table below them is the primary content.

---

# INTERACTION PATTERNS

## Click Behaviors

- **Expand/collapse:** Single click on a results table row toggles its detail panel. Only one panel open at a time.
- **Drill-down:** Single click on "View →" in the batch table navigates to the individual result. Breadcrumb navigation returns to the dashboard.
- **Mode switching:** Clicking "Single" or "Batch" toggle switches the entire view. State within each mode is preserved when switching (an in-progress batch isn't lost by switching to single mode and back).

## Hover Effects

Minimal but present. Hover states signal clickability — essential for this audience who may not assume interactive elements without visual cues.

- **Table rows:** Subtle background darkening on hover — just enough to indicate "this is clickable." Not too dramatic.
- **Buttons:** Slight darkening or saturation increase. Cursor changes to pointer.
- **Links:** Underline appears on hover (not on default state for secondary links).
- **Drop zones:** Border color intensifies on hover.

## Animations

Restrained. Every animation serves a functional purpose — no decorative motion.

- **Expand/collapse panels:** Smooth height transition (200-300ms, ease-out). Not instant (jarring) and not slow (frustrating for repeated use).
- **Processing steps:** Spinner animation on the active step. Checkmark appears on completed steps with a brief "pop" or "settle" motion.
- **Progress bar:** Smooth fill animation as batch labels complete.
- **Error/warning banners:** Slide in from top with a gentle ease-out. Dismissible with a fade-out.
- **Drag hover:** Border color transition — immediate, not animated (hover states should feel instant).

No page transitions. No fade-in on load. No scroll-triggered animations. No parallax. This is a workstation tool used 50+ times a day — decorative animation becomes irritating with repetition.

## Loading States

- **Single label processing:** The dedicated Screen 2 with step-by-step progress
- **Batch processing:** Progress bar with streaming results table
- **Any other loading moment (button clicked, filter changed):** A subtle inline spinner or skeleton placeholder — never a full-screen loader for sub-second operations

## Keyboard Navigation

- Tab order follows the visual layout: image upload → form fields (top to bottom) → verify button
- Enter key on the verify button triggers verification
- In the results table, arrow keys can navigate between rows; Enter expands/collapses the focused row
- Escape collapses any open detail panel
- In the batch dashboard, Tab moves through filter buttons, then table rows

---

# VISUAL IDENTITY

## App Title

"TTB Label Verification Assistant" — displayed in the top-left corner of the page, in the primary font at heading weight. Not overstyled — just a clean, readable text mark. No logo needed for the prototype (this is a proof-of-concept, not a branded product).

Below or beside the title, a single line of subtle text: "AI-Powered Compliance Checking" — this tells Sarah's leadership audience what the tool does at a glance.

## Page Structure

A single-page application. No sidebar navigation, no hamburger menu, no tabs (except the Single/Batch toggle). The entire interface is one vertical flow:

```
[Title Bar]
[Mode Toggle: Single | Batch]
[Main Content Area — changes based on mode and state]
```

The title bar is compact — one line, not a large header. Screen real estate is for content, not branding.

## Overall Feel

If someone walks past an agent's desk and glances at this tool on their monitor, they should think: "That looks like a serious professional tool." Not: "That looks like a website." Not: "That looks like a startup product." It should feel native to an office environment — the kind of tool that belongs next to Excel and Outlook in a government worker's daily toolkit.

The design should be memorable not because it's flashy, but because it's unusually well-organized and clear. The impression it should leave: "Someone who understands our work built this."
