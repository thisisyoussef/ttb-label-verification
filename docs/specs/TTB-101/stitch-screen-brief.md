---
story: TTB-101
title: single-label intake and processing — Stitch brief
owner: Claude (UI lane)
status: Stitch references returned; implementation in progress
updated: 2026-04-13
---

# Stitch Screen Brief — TTB-101 single-label intake and processing

This brief is for the user to run manually through Google Stitch. Claude implements from the returned references. Stitch owns all visual decisions (color, type, spacing, component styling, iconography) — this brief describes who the user is, what they're trying to do, what states must exist, what it should feel like, and what it must not feel like. Do not include the results screen — that is TTB-102's scope.

## 1. Screen goal

Design the **intake** screen and the **processing** screen for a single-label review in a web app used by U.S. federal alcohol-beverage compliance reviewers. The reviewer uploads a photo of a label, optionally enters the corresponding application data, confirms what kind of beverage it is, and starts a review. The processing screen shows that the system is working through a defined pipeline before results appear.

## 2. Target user and moment

- **Who:** a federal compliance reviewer, typically 45–65, who spends their day reading alcohol labels against regulations on a desktop workstation. Some have decades of experience and mistrust flashy tools. Some are junior and rely on explicit checklists. Leadership will occasionally watch the tool being used.
- **Where:** a brightly-lit government office, desktop monitors, mouse and keyboard, no touch.
- **Moment:** the first thirty seconds of a session. The reviewer has a label in hand (or on screen) and wants to get through the review quickly without being slowed down by the tool.
- **Emotional target:** the reviewer should feel they're using a serious professional instrument that respects their time and judgment — closer to a Bloomberg terminal, an oscilloscope, or a well-designed spreadsheet than a consumer app. Calm, dense, authoritative. The subtext is "someone who understands my job built this." It must not feel playful, marketing-y, "AI magic," or like an early-stage startup product. It must not feel like a kiosk or a tutorial.

## 3. Screen prompt for Stitch

> **Platform: web only.** Design two connected screens for a desktop-first **web application** called "TTB Label Verification Assistant" — a workstation tool for federal alcohol-beverage compliance reviewers. Generate **web output only** (web screens and web HTML/code). Do not generate mobile app screens, iOS or Android layouts, tablet-app chrome, or any non-web artifact. The deliverable is a web interface rendered in a browser on a desktop monitor, with graceful responsive behavior down to tablet and narrow-browser widths. Touch is not the primary input; mouse and keyboard are.
>
> The tool's purpose is to help a reviewer check whether an alcohol label complies with government regulations. The two screens in this brief cover the beginning of that workflow: (1) the reviewer preparing a review, and (2) the reviewer watching the system work. A third results screen exists but is out of scope here.
>
> **Audience and feeling.** The users are career government reviewers, many in their 50s and 60s, working at desktop workstations under fluorescent office lighting. They do this job all day, every day. The tool must feel like a precision instrument — calm, information-dense, authoritative, respectful of their expertise. Think of the feeling of a Bloomberg terminal, an engineering workstation, or a well-designed professional spreadsheet. It must not feel like a consumer SaaS app, a marketing site, a startup product, a kiosk, or anything "AI-futuristic." It should feel like a tool that would sit comfortably next to Excel and Outlook on a government worker's monitor. First-time impression matters: leadership may be in the room. The tool must look unmistakably serious the moment it loads.
>
> **Screen 1 — Intake.** The reviewer arrives here to start a review. They need to do three things, in whatever order feels natural: provide a photo of the label, optionally enter the matching application data they already have, and indicate what kind of beverage they're reviewing (distilled spirits, malt beverage, wine, or let the system detect it). When they're ready, they start the review with one clearly primary action.
>
> Two functional regions are equally important and should sit side by side on a desktop (stacking gracefully on narrower viewports): a **label-image intake region** and an **application-data intake region**. A persistent primary action lives where the reviewer will naturally look to commit ("start the review"). A quieter secondary action lets them clear everything and start over. Somewhere on the screen, always visible while the reviewer is entering data, is a short privacy statement reassuring them that inputs and results are never stored.
>
> Above the working area, a compact top region identifies the application and lets the reviewer switch between single-label mode (active here) and a batch mode (inactive, but present as a choice). The top region should be lightweight — not a marketing header.
>
> The **label-image intake region** must visibly express these states: an inviting empty state that makes it obvious a file can be dropped or browsed; a responsive drag-over state that confirms the drop will work; a confident uploaded state that shows a thumbnail of the label along with the filename and size and a way to remove the image; and two error states for when the file isn't a supported format or is too large. The error states must be instantly recognizable as errors and must explain in plain language what went wrong and what to do about it.
>
> The **application-data intake region** must make it fast to enter information the reviewer already has. All fields are optional — reviewers can run partial comparisons. The reviewer first picks the beverage type from a small set of always-visible choices (not hidden inside a dropdown), then fills in whatever identity, alcohol content, measure, origin, and applicant information they have. The field layout must adapt to beverage type: wine reveals wine-specific fields (appellation, vintage, a repeatable list of varietals with percentages that totals toward 100%); spirits and wine treat alcohol content as mandatory while malt beverage treats it as optional — communicate this difference at the field level without making optional fields feel punishing. Origin is a binary choice (domestic or imported); choosing imported reveals a country field.
>
> The primary action must be unmistakably the most important interactive element on the screen. It is disabled until a label image has been provided, and when disabled it must explain why so the reviewer is never confused about what's blocking them.
>
> **Screen 2 — Processing.** After the reviewer starts the review, this screen replaces the intake working area without destabilizing the page frame (the top identification region and mode choice remain exactly where they were). The reviewer should feel that the same page is "now working" rather than that they navigated somewhere new.
>
> The screen must simultaneously reassure the reviewer that the system has accepted their input and communicate deterministic, step-by-step progress. On one side, pin the intake context they just provided — the label thumbnail, the filename, the file size, the beverage type they chose — so they know their inputs were received. On the other side, show an ordered list of exactly five named steps that progress one at a time: reading the label image, extracting structured fields from it, detecting the beverage type, running deterministic regulation checks, and preparing the evidence for review. Each step should visibly be in one of: not started, currently running, completed, or failed. Only one step runs at a time, and steps happen in order.
>
> A quiet way to cancel the review must be available throughout, without being so prominent that reviewers click it by accident.
>
> Below the step list, reserve an empty space clearly labeled as the place where results will appear. The intent of this empty space is to visually anticipate what's coming next so the reviewer's eyes stay anchored when results arrive.
>
> Also design a **processing-failure variant** of Screen 2: the currently-running step flips to a failed state, subsequent steps remain not-started, and a failure region appears beneath the list that explains in plain language what went wrong, reassures the reviewer that nothing was saved, and offers two clear actions — try the review again, or return to the intake screen with their inputs intact. Never show raw error codes or technical language.
>
> **Across both screens.** Accessibility and trust are non-negotiable. Status and state must never rely on color alone — color can reinforce meaning, but an icon and a label must carry the meaning independently so a colorblind reviewer reads it the same way. All text must be comfortable for older readers under bright office lighting. Everything interactive must be reachable by keyboard. Motion, if any, should serve a functional purpose (signaling progress, confirming a state change) and never be decorative. The two screens must feel like the same page frame with its working content swapped — the reviewer should never feel they've been teleported somewhere new.

## 4. Required functional regions

### Intake screen

- Top identification region with the application's name, its one-line purpose, and a mode choice between single-label (active) and batch (inactive).
- Label-image intake region.
- Application-data intake region, whose structure adapts to the chosen beverage type.
- Persistent privacy assurance visible while entering data.
- Primary action ("start the review") and secondary action ("clear everything"), with disabled and enabled variants of the primary action.

### Processing screen

- Same top identification region and mode choice as the intake screen, visually unchanged.
- Pinned context of what the reviewer submitted (thumbnail, filename, size, beverage type).
- Ordered five-step progress list.
- Cancel affordance.
- Placeholder region that clearly anticipates where results will render next.
- Failure region (in the processing-failure variant) with plain-language reassurance and two recovery actions.

## 5. Required states and variations to render

- **Label-image intake:** empty, drag-over, uploaded, unsupported-file-type error, oversized-file error.
- **Primary action:** disabled (with an explanation of why) and enabled.
- **Beverage-type affordance:** default state (auto-detect) and wine state (which reveals wine-specific fields including the repeatable varietal rows with a running percentage total).
- **Origin choice:** domestic selected (country field hidden) and imported selected (country field revealed).
- **Processing list:** mid-run state with one step running, one or more steps completed, and the remainder not yet started.
- **Processing failure:** current step flipped to failed, remaining steps not started, failure region present with recovery actions.

## 6. Copy anchors

Use these exact strings verbatim. They are product content, not placeholder text.

- App title: "TTB Label Verification Assistant"
- One-line purpose: "AI-assisted compliance checking"
- Mode options: "Single" and "Batch"
- Privacy assurance: "Nothing is stored. Inputs and results are discarded when you leave."
- Label-image intake, empty primary: "Drop a label image or click to browse"
- Label-image intake, empty secondary: "JPEG, PNG, WEBP, or PDF. Up to 10 MB."
- Label-image intake, drag-over: "Drop to upload"
- Label-image intake, remove: "Remove"
- Beverage-type options: "Auto-detect", "Distilled Spirits", "Malt Beverage", "Wine"
- Alcohol content hint: "e.g., 45% Alc./Vol."
- Net contents hint: "e.g., 750 mL"
- Applicant address hint: "Name, city, and state exactly as on the permit."
- Mandatory and optional tags: "MANDATORY", "OPTIONAL"
- Varietal running total: "Total: 85% (must equal 100% to qualify)"
- Primary action: "Verify Label"
- Primary action disabled explanation: "Add a label image to verify."
- Secondary action: "Clear"
- Unsupported-file error: "We couldn't use that file. Please upload a JPEG, PNG, WEBP, or PDF."
- Oversized-file error: "That file is 12.4 MB. The limit is 10 MB."
- Processing heading: "Reviewing this label"
- Processing cancel: "Cancel review"
- Processing steps, in order: "Reading label image", "Extracting structured fields", "Detecting beverage type", "Running deterministic checks", "Preparing evidence"
- Processing results placeholder: "Results will render here"
- Processing failure heading: "We couldn't finish this review."
- Processing failure body: "The connection dropped while reading the label. Your label and inputs are still here — nothing was saved."
- Processing failure actions: "Try again", "Back to intake"

## 7. Feelings and intents

Aim for:

- Calm, authoritative, information-dense.
- Professional instrument, not product.
- Easy to trust: clear what the system is doing, what it needs, what it found.
- Stable: the page frame doesn't jump between intake and processing.
- Respectful of older and less-tech-savvy reviewers: legible, keyboard-reachable, never ambiguous about what to click.
- Legible for a colorblind reviewer: every status read the same way without color.

Avoid:

- Consumer-app warmth, playfulness, or friendliness.
- Marketing, promotional, or launch-announcement tone.
- Startup or SaaS aesthetics.
- "AI magic" language or imagery — the tool assists, it does not decide.
- Decorative motion, hero illustrations, stock photography, mascots.
- Any impression that the reviewer must learn the tool before using it.
- Any impression that something has been saved or sent elsewhere without the reviewer's knowledge.

## 8. Returned Stitch references

Returned by the user on 2026-04-13 as four inline HTML artifacts, saved under `docs/specs/TTB-101/stitch-refs/`:

- `stitch-refs/intake-initial.html` — intake, empty/initial state
- `stitch-refs/intake-populated-wine.html` — intake, uploaded + wine beverage type selected (full wine variant with varietals table)
- `stitch-refs/processing-active.html` — processing, step 2 active
- `stitch-refs/processing-failure.html` — processing, step 3 failed with failure region

No separate Stitch image link was provided; the HTML artifacts are the primary reference.

### Visual direction chosen by Stitch (to preserve)

- **Type:** Public Sans (headline), Work Sans (body), Inter (labels), IBM Plex Mono (data values).
- **Palette:** Material-You-style semantic tokens — warm off-white `background` (#f9f9f8), near-black `on-surface` (#2d3433), muted slate `primary` (#546067), forest `tertiary` (#1c6d25) for success, brick `error` (#9f403d), quiet blue `secondary` (#49636f).
- **Layout:** two-column intake with dashed drop zone on the left and application panel on the right; two-column processing with pinned intake-context sidebar and step list on the right; results placeholder in a dashed block below the steps.
- **Components:** segmented controls for mode toggle, beverage type, and origin; circular step-state icons with a spinning ring for the active step; error tag pills; border-accented failure region.

### Deviations from the brief to normalize during implementation

Stitch took some liberties that conflict with the brief. Implementation will restore canonical behavior:

1. **Beverage-type options.** Populated-wine screen shows three options (Spirits/Wine/Beer). Canonical per §6 is four options with verbatim strings: "Auto-detect", "Distilled Spirits", "Malt Beverage", "Wine".
2. **Processing step names in the failure variant.** Stitch renamed them ("Validating asset integrity", "OCR Extraction", "Health warning analysis", "Compliance scoring"). Use the canonical five from §6 verbatim.
3. **Technical jargon in the failure variant.** Stitch added codes and system-log lines ("PIPELINE_STATUS: CRITICAL ERROR", timestamp, "REF-2024-XP-091", "CHECKSUM_MATCH: 100% OK", "PARSED_TOKENS: 142 FOUND", "ERR_CONNECTION_DROPPED_LABEL_READ", "STATE: WAIT_FOR_PARENT", "System Log: Pipeline interrupted at Step 3"). Brief §3 forbids raw error codes and technical language. Remove all of it; keep plain-English failure copy from §6.
4. **Decorative chrome** in the intake header/footer: profile avatar, Help/Settings icons, "Privacy Policy" and "Terms of Service" footer links, a "precision_manufacturing" divider icon in the form, and a decorative "Sample Label" thumbnail inside the empty drop zone. None are in the brief. Remove. Keep privacy microcopy in the action bar.
5. **Fixed-position action bar.** Stitch anchors the action bar floating at the bottom with a glass panel covering the footer and form. Make it an in-flow bar at the end of the form column (or spanning below the two columns) so it does not obscure content on narrow viewports.
6. **Extra form fields missing from Stitch output.** The initial intake shows Brand / Fanciful Name / Class/Type / ABV / Origin. Brief §3 requires Net Contents, Applicant Name & Address, Country (conditional on Imported), and Formula ID (optional). Include all of them.
7. **Failure-state sidebar jargon** ("Internal Reference: REF-2024-XP-091", "Verified 300 DPI"). Replace with the pinned intake context actually collected in Screen 1: thumbnail, filename, size, beverage type.

Implementation preserves Stitch's visual skeleton and token palette; it normalizes copy, restores required fields, and removes decoration per the brief.

### Automated run — 2026-04-13T20:46:26.516Z

- flow mode: `automated`
- user review required before implementation: `true`
- project: `ttb-label-verification automated` (`15350665813018316672`)
- model: `GEMINI_3_FLASH`
- device type: `DESKTOP`
- artifact folder: `docs/specs/TTB-101/stitch-refs/automated/2026-04-13T20-46-26-515Z`
- manifest: `docs/specs/TTB-101/stitch-refs/automated/2026-04-13T20-46-26-515Z/manifest.json`
- raw response: `docs/specs/TTB-101/stitch-refs/automated/2026-04-13T20-46-26-515Z/raw-response.json`

#### Generated screens

1. `Intake - TTB Assistant`
   - screen id: `e31dd5aca47143cfabb4388925998790`
   - local HTML copy: `docs/specs/TTB-101/stitch-refs/automated/2026-04-13T20-46-26-515Z/01-intake-ttb-assistant.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2U1NzU1OGZjMTEzZDQ3MjE4ODlhMzVlMDNlMmExZTExEgsSBxCDmeS-iQEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTM1MDY2NTgxMzAxODMxNjY3Mg&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0ujzfGFqyLMlvSwpyAomDRnVg-s1-YzWWcX4AdHz5rpoUQGysKSOZgUFxPkT7CbZtAAyLU1QiancK3fIwXUSNy_1ptCdS3zHwdYFj9joA_yTR6Cp2UrbVKjtR4xIMCxBTbUVGj4CnWZ2xSKczZuA0-E2WsSLZWUI9-94Hx4CUP7zH9iJHWQktd0NM0r__rXJVQXVYMipbAfY2cYbKOVjfj24BZ9oIiiXBpKay8FyVy_-rLauKfrc73PIQch9
2. `Processing - TTB Assistant`
   - screen id: `173bd99c432b4be8bf49f265d9dcd2be`
   - local HTML copy: `docs/specs/TTB-101/stitch-refs/automated/2026-04-13T20-46-26-515Z/02-processing-ttb-assistant.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzA1MWRjZWYwYjk4ZjRjOThiYmZkMDIzMjMxOGVlODQyEgsSBxCDmeS-iQEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTM1MDY2NTgxMzAxODMxNjY3Mg&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0uiLplEUzLUJ77siS0LJXArSKyQp8wkSB6xulk0KnSeLSPWLTW5CEMXYacCjuuBe2lvzgHjh6SjD2KHlIEiAlKS0oP6biXCLb3bsCAGWJvkIm2Kf3BCPDDTjcpPrgd4180vHftQrC5Om5-T4ttA3KvLFG65amy5PJZS33YiENne7B19hmpEzNoYh98pYD2uAkUzJl1eu5K5euSk3HMplfG_nS5NntHWAtnyxQ2LAj8ulNfAZ-WesQGutEVfa
3. `Processing Failure - TTB Assistant`
   - screen id: `cf2435f5e78840ea8da0bc882da5c503`
   - local HTML copy: `docs/specs/TTB-101/stitch-refs/automated/2026-04-13T20-46-26-515Z/03-processing-failure-ttb-assistant.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzM1YjYxOGI4YmFmNzRmY2VhNDMyYTczZjA4MDI4ODk2EgsSBxCDmeS-iQEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTM1MDY2NTgxMzAxODMxNjY3Mg&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0uip5lluwNX-lLCn8XgJakGjlqxX9gVr4O75wc52gs4vcKYl5jxuN3kY5SljEiIMNhb0wYZ4uKZWDWFjEUFyWTliRViW15qoy3BwxmSwcKqdx1_OJxbDJaFfJho8ZrBDp-kv6THH_Zg1pFuzN05wwlgVUHpQjv93e4Hst_GG_WQd5R1k99mWGH_oFF3LfCLaN5aiBJTOqI6dHflUouMU7DFwJLnx_UKyhDSS1rxLneDhIyU7PlIVkQdq5Qzf
