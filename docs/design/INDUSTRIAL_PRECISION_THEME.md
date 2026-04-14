# Industrial Precision Theme

This document is the **single source of truth** for the TTB Label Verification Assistant's visual theme. It was chosen in the Google Stitch run for story TTB-101 on 2026-04-13 and promoted here to keep theming centralized and organized across the whole product.

If theme values change, they change here first, then propagate to the Tailwind config, the CSS variables, and any downstream token consumers.

## Source

- Origin: Google Stitch "Industrial Precision" preset, customized with the seed color `#455A64` during the TTB-101 Stitch run.
- First used: TTB-101 single-label intake + processing screens.
- Companion doc: [`MASTER_DESIGN.md`](./MASTER_DESIGN.md) — durable product design baseline (principles, metaphor, accessibility posture).
- Consumer: [`../../tailwind.config.js`](../../tailwind.config.js) — the runtime token mapping used by all `src/client/**` code.
- Screenshot: `assets/industrial-precision-theme.png` — see the assets README if it is missing.

## Mode

- Light theme only for this product. Government offices are brightly lit; dark mode is not appropriate.
- Stitch exposes a Dark toggle; we do not ship it. Do not introduce a dark theme without a product decision recorded here.

## Seed color

- `#455A64` — a muted blue-gray. Every other palette color is derived from this seed by Stitch's Material You mapping.

## Color palette (Material You M3 semantic tokens)

Each role has a family of tokens (`primary`, `on-primary`, `primary-container`, `on-primary-container`, optional `primary-dim`, etc). Use the semantic role, not the raw hex.

| Role | Hex | Tailwind token | Purpose |
| --- | --- | --- | --- |
| Primary | `#546067` | `primary` | Primary action, active nav underline, focused field accent, active step label. |
| Primary (dim) | `#48545b` | `primary-dim` | Gradient bottom stop on primary buttons. |
| On primary | `#f0f9ff` | `on-primary` | Text/icons on primary surfaces. |
| Primary container | `#d7e4ec` | `primary-container` | Soft primary surface; unused at the moment — reserve for chips and future highlights. |
| On primary container | `#47545a` | `on-primary-container` | Text on primary-container. |
| Secondary | `#49636f` | `secondary` | Quieter blue accent; currently drives the intake-context pill on the processing screen. |
| Secondary container | `#cbe7f5` | `secondary-container` | Soft blue fill for info chips (e.g. beverage-type pill). |
| On secondary container | `#3c5561` | `on-secondary-container` | Text on secondary-container. |
| Tertiary | `#1c6d25` | `tertiary` | Success/pass signal only. Deterministic check done state, green verdicts in TTB-102. |
| Tertiary container | `#9df197` | `tertiary-container` | Soft green fill for done-state step icons. |
| On tertiary container | `#005c15` | `on-tertiary-container` | Text/icons on tertiary-container. |
| Error | `#9f403d` | `error` | Fail/reject signal only. Reject verdicts, failed step, validation errors, Remove action. |
| Error container | `#fe8983` | `error-container` | Soft red fill for failure callouts (used at low opacity). |
| On error container | `#752121` | `on-error-container` | Text on error-container. |
| Caution | `#8e5f0a` | `caution` | Review/caution signal only. Review verdicts, review status badges, `wrong-case` highlight in the warning diff. Chosen as an "aged brass" warm amber per `MASTER_DESIGN.md`. Added for TTB-102. |
| On caution | `#ffffff` | `on-caution` | Text/icons on caution surfaces. |
| Caution container | `#ffe0b3` | `caution-container` | Soft amber fill for review verdict banners, review badges, and `wrong-case` highlight. |
| On caution container | `#4d3700` | `on-caution-container` | Text on caution-container. |
| Neutral | — | see surface/outline rows | Warm neutral scale (see below). |
| Background | `#f9f9f8` | `background`, `surface`, `surface-bright` | Page canvas. Warm off-white. |
| Surface container lowest | `#ffffff` | `surface-container-lowest` | Panels, cards, elevated surfaces. |
| Surface container low | `#f2f4f3` | `surface-container-low` | Form panel, processing sidebar, quiet recessed surfaces. |
| Surface container | `#ebeeed` | `surface-container` | Standard recessed surface. |
| Surface container high | `#e5e9e8` | `surface-container-high` | Hover state for recessed surfaces, segmented-control track. |
| Surface container highest | `#dee4e2` | `surface-container-highest` | Deepest recessed surface; segmented-control background. |
| Surface dim | `#d4dcda` | `surface-dim` | Reserved. |
| On background | `#2d3433` | `on-background`, `on-surface` | Primary body text. Near-black with a warm cast. |
| On surface variant | `#5a6060` | `on-surface-variant` | Secondary text; labels, captions, helper copy. |
| Outline | `#767c7b` | `outline` | Strong dividers where needed. |
| Outline variant | `#adb3b2` | `outline-variant` | Hairline borders. |

Signal-color rules (from `MASTER_DESIGN.md`, restated here for theme consumers):

- `tertiary`, `error`, and `caution` appear **only** for status signaling. Never decorative.
- Every signal color is paired with an icon and a text label. Color never carries meaning alone.
- The `primary` family is an action accent, not a status color.

## Typography

| Role | Tailwind family class | Web font | Weights used | Purpose |
| --- | --- | --- | --- | --- |
| Headline | `font-headline` | Public Sans | 400, 600, 700, 800 | Screen titles, section legends, stat numbers. |
| Body | `font-body` | Work Sans | 400, 500, 600 | All body copy, form inputs, step labels. |
| Label | `font-label` | Inter | 400, 500, 600, 700 | Uppercase micro-labels, tags, metadata captions. |
| Monospace | `font-mono` | IBM Plex Mono | 400, 500 | Filenames, extracted text, character-accurate data (TTB-102 diff view). |

Loaded via Google Fonts in `index.html` with `display=swap`. Do not introduce an additional display typeface — the design brief rejects "trendy" display fonts.

Minimums (also in `MASTER_DESIGN.md`):

- Body text ≥ 16px.
- Supporting text ≥ 14px.
- Micro-labels may drop to 10–11px **only** when uppercased with wide letter-spacing and never for content the reviewer reads during their primary workflow.

## Corner radius

Stitch picked the smallest of the four radii in its picker. Our Tailwind scale locks this in:

| Tailwind class | Value | Usage |
| --- | --- | --- |
| `rounded` (default) | `0.125rem` (2px) | Tight corners for tags, segmented-control slices, and chips. |
| `rounded-lg` | `0.25rem` (4px) | Buttons, cards, form panels, drop zone, step rows. |
| `rounded-xl` | `0.5rem` (8px) | Reserved for larger surfaces (used sparingly). |
| `rounded-full` | `0.75rem` (12px) | **Not a true pill**. Reserved — do not use for badges/pills unless redesigning. Use `rounded-full` from Tailwind base only when true circle is needed (e.g., status icons). |

Note: the scale is deliberately tight. The product's "precision instrument" tone is undermined by large pill-shaped corners. When in doubt, choose a smaller radius.

## Elevation

Single ambient shadow, used to lift white surfaces off the warm-neutral background without introducing borders or gradients.

- `shadow-ambient` → `0px 4px 20px rgba(45, 52, 51, 0.06)`

Avoid stacking shadows or using any shadow for decoration.

## Focus and motion

- Focus ring: `outline: 2px solid theme('colors.primary')` with 2px offset, defined globally in `src/client/index.css` under `:focus-visible`.
- Motion: only functional (step transitions, drag-over feedback). `prefers-reduced-motion` is honored globally by the same stylesheet.
- The active-step spinner is the only ongoing animation allowed on the intake/processing flow.

## How theming is centralized

- **Canonical token hex values and role mapping: this file.** Update here first when a token changes.
- **Runtime token mapping: `tailwind.config.js`.** Mirrors the table above; every component consumes theme via Tailwind utility classes (`bg-primary`, `text-on-surface`, `border-outline-variant`, …).
- **CSS escape hatch: `src/client/index.css`.** Uses `theme('colors.*')` inside `@layer` blocks so even custom utilities (e.g., `.step-ring`) stay bound to the Tailwind tokens.
- **No raw hex in `src/client/**`.** Every color reference goes through a Tailwind token. CI-style audit: `grep -r '#[0-9a-fA-F]\{3,6\}' src/client` must return nothing.
- **Fonts load in `index.html` only.** Do not import fonts inside components.

## When updating the theme

1. Update this file (tokens, roles, hex values).
2. Update `tailwind.config.js` so utility classes resolve to the new values.
3. If the token added is not a drop-in for an existing role, document the new role in the table above before use.
4. Re-run the "no raw hex" audit: `grep -r '#[0-9a-fA-F]\{3,6\}' src/client` should return nothing.
5. Visually verify the intake and processing screens at desktop, tablet, and narrow-browser widths before declaring the change done.

## Reference screenshot

Drop Stitch's theme-picker screenshot at `assets/industrial-precision-theme.png` to keep the design-time context next to the spec. See `assets/README.md`.
